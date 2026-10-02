// @vitest-environment node
//
// Three material faults, found by reading what the admin Materials page actually
// rendered rather than what the code intended. All three were invisible to the
// existing tests, so they are pinned here as source-level facts about the
// migrations, which is the only place they are decided.

import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATIONS = "supabase/migrations";
const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql"));
const read = (name) => readFileSync(`${MIGRATIONS}/${name}`, "utf8");

// The newest migration that actually *defines* the function, not merely names
// it. A later migration that only revokes EXECUTE or pins search_path mentions the
// function without redefining it, and "latest migration mentioning this" then
// returns a file whose body says none of the things the test is asserting.
const latestWith = (needle) =>
  files
    .filter((name) => read(name).includes(`function public.${needle}(`))
    .sort()
    .pop();

// The newest migration that merely *mentions* a string. Used for filenames, where
// the point is which migration last talked about the file rather than which one
// defines something.
const latestMentioning = (needle) =>
  files
    .filter((name) => read(name).includes(needle))
    .sort()
    .pop();

const MATERIAL_RPC = "academy_register_material_file";

// The migration that *registers* a file, which is the earliest one that inserts
// it, not the most recent that mentions it. Later migrations list earlier files in
// their allow list of static materials that exist, and those contain an insert of
// their own for a different file, so "latest migration mentioning this one" found
// the wrong migration and then asserted things its insert never did.
const registering = (filename) =>
  files
    .filter((name) => {
      const sql = read(name);
      if (!sql.includes(filename)) return false;
      if (!/insert into public\.academy_materials/i.test(sql)) return false;
      // A bare mention inside the allow list is not a registration.
      const allowList = sql.indexOf("storage_path not in (");
      return allowList === -1 || sql.indexOf(filename) < allowList;
    })
    .sort()[0];

describe("materials show a filename, not a storage path", () => {
  const rpc = latestWith(MATERIAL_RPC);
  const sql = read(rpc);

  it("strips the random upload prefix instead of recording it", () => {
    // A new upload lands at new/<uuid>-<name> because the random prefix is what
    // stops a signed URL being guessed from a lesson name. That prefix must not
    // become the filename an administrator is shown.
    expect(sql).toMatch(
      /academy_material_original_filename\(p_storage_path\)/,
    );
  });

  it("does not record a bare split_part of the path", () => {
    // This is the actual bug: split_part(path, '/', -1) yields
    // "<uuid>-Cpp_for_Embedded_Systems_and_Robotics.pdf".
    expect(sql).not.toMatch(/split_part\(p_storage_path,\s*'\/',\s*-1\)/);
  });

  it("refreshes the filename when a file is replaced", () => {
    // Otherwise a replaced material keeps advertising the file it no longer has.
    expect(sql).toMatch(/original_filename\s*=\s*public\.academy_material_original_filename/);
  });

  it("defines the helper it depends on", () => {
    expect(sql).toMatch(
      /create or replace function public\.academy_material_original_filename/,
    );
  });

  it("removes only a leading uuid, not the name", () => {
    // Anchored at the start, and the name after it is left alone.
    expect(sql).toMatch(
      /\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}-/,
    );
  });

  it("backfills the rows that already had a uuid in them", () => {
    expect(sql).toMatch(
      /update public\.academy_materials[\s\S]*?original_filename = public\.academy_material_original_filename/,
    );
  });
});

describe("no material points at a file that is not in the tree", () => {
  const removal = latestMentioning("ATE_Robotics_Manual_Mr_Muwatta.pdf");
  const removalSql = read(removal);

  it("deletes the row for the removed robotics manual", () => {
    expect(removalSql).toMatch(
      /delete from public\.academy_materials\s+where storage_path = 'course_material_assets\/ATE_Robotics_Manual_Mr_Muwatta\.pdf'/,
    );
  });

  it("no longer seeds it", () => {
    // The seed is edited as well as the row deleted. Editing alone fixes a fresh
    // database; deleting the row fixes this one.
    const seed = read("20261021000000_academy_course_resource_seeds.sql");
    expect(seed).not.toMatch(/ATE_Robotics_Manual_Mr_Muwatta\.pdf/);
  });

  it("keeps every other seeded material", () => {
    const seed = read("20261021000000_academy_course_resource_seeds.sql");
    expect(seed).toMatch(
      /course_material_assets\/python-for-young-innovators-student-workbook_1\.pdf/,
    );
  });
});

describe("the electronics handout is registered, not just committed", () => {
  const sql = read(registering("Electronics_and_Wiring_for_Beginners.pdf"));

  it("inserts it against the C++ course", () => {
    expect(sql).toMatch(/insert into public\.academy_materials/);
    expect(sql).toMatch(/where c\.slug = 'cpp-embedded-robotics'/);
  });

  it("publishes it", () => {
    // A row that is not published is invisible to students, which is the whole
    // problem this fixes.
    expect(sql).toMatch(/published = excluded\.published|published = true/);
    expect(sql).toMatch(/set[\s\S]*?published = true/);
  });

  it("records it as static, matching the Python workbook", () => {
    // Static because the bytes are committed and served by the app. A storage
    // row would point at an object that does not exist.
    expect(sql).toMatch(/'static'/);
  });

  it("is idempotent, so re-running repairs rather than duplicates", () => {
    expect(sql).toMatch(/on conflict \(storage_path\) do update/);
  });

  it("does not leave a stale static row pointing at a missing file", () => {
    expect(sql).toMatch(
      /storage_kind = 'static'[\s\S]*?storage_path not in \([\s\S]*?\)/,
    );
  });
});
