import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261131000000_academy_material_uploads.sql",
  "utf8",
);
const lib = readFileSync("src/lib/academy.js", "utf8");
const page = readFileSync("src/pages/AcademyAdminMaterials.jsx", "utf8");

describe("an administrator can upload, replace and delete a material file", () => {
  it("has a private bucket rather than a public one", () => {
    // These are paid course documents, so they must not be world readable.
    expect(sql).toMatch(/'course-materials',\s*'course-materials',\s*false,/);
  });

  it("allows a 25 MB ceiling, above the shipped 8.8 MB workbook", () => {
    expect(sql).toMatch(/26214400/);
    expect(lib).toMatch(/const MATERIAL_MAX_BYTES = 25 \* 1024 \* 1024/);
  });

  it("keeps replacing on the same material id so student links survive", () => {
    expect(sql).toMatch(/p_material_id is not null then[\s\S]*?update public\.academy_materials/);
    expect(lib).toMatch(/export async function replaceAcademyMaterialFile/);
    expect(lib).toMatch(/p_material_id: materialId/);
  });

  it("removes the old file only after the new row commits", () => {
    // Otherwise a failed upload would leave the material pointing at nothing.
    const replace = lib.slice(lib.indexOf("export async function replaceAcademyMaterialFile"));
    expect(replace.indexOf("p_material_id: materialId")).toBeLessThan(
      replace.indexOf("remove([current.storage_path])"),
    );
  });

  it("cleans up the uploaded object when the row could not be created", () => {
    expect(lib).toMatch(/Do not leave an orphan in the bucket/);
  });

  it("returns the path on delete so the client can remove the object", () => {
    expect(sql).toMatch(/returns text/);
    expect(sql).toMatch(/delete from public\.academy_materials where id = p_material_id;\s*return coalesce\(path, ''\)/);
  });
});

describe("the existing committed PDFs are not disturbed", () => {
  it("keeps static materials marked static", () => {
    expect(sql).toMatch(/add column if not exists storage_kind text not null default 'static'/);
    expect(sql).toMatch(/update public\.academy_materials set storage_kind = 'static'/);
  });

  it("rejects mixing a storage path with a static one", () => {
    expect(sql).toMatch(
      /academy_materials_storage_kind_ck check \(\s*storage_kind in \('static', 'storage'\)/,
    );
  });

  it("serves a static material without a signed URL", () => {
    // Committed to the repository and served from the app, so a plain path is
    // correct for these and needs no signature. Only uploaded objects need one.
    expect(lib).toMatch(/material\.storage_kind !== "storage"/);
    expect(lib).toMatch(/return \{ data: \{ url: `\/\$\{String\(material\.storage_path\)/);
  });
});

describe("only staff can manage materials", () => {
  it("gates every write function on the teacher check", () => {
    expect(sql).toMatch(
      /create or replace function public\.academy_register_material_file[\s\S]*?academy_is_teacher\(\) then/,
    );
    expect(sql).toMatch(
      /create or replace function public\.academy_delete_material[\s\S]*?academy_is_teacher\(\) then/,
    );
  });

  it("gates the storage bucket write policies too, not just the table", () => {
    expect(sql).toMatch(
      /create policy academy_course_materials_write on storage\.objects[\s\S]*?academy_is_teacher\(\)/,
    );
    expect(sql).toMatch(
      /create policy academy_course_materials_delete on storage\.objects[\s\S]*?academy_is_teacher\(\)/,
    );
  });

  it("revokes the write functions from anon and public", () => {
    expect(sql).toMatch(
      /revoke execute on function public\.academy_register_material_file\(uuid, uuid, text, text, text, integer, boolean, uuid\) from public, anon/,
    );
    expect(sql).toMatch(
      /revoke execute on function public\.academy_delete_material\(uuid\) from public, anon/,
    );
  });

  it("still limits students to published materials", () => {
    const allSql = readFileSync(
      "supabase/migrations/20260923000000_academy_lms_foundation.sql",
      "utf8",
    );
    expect(allSql).toMatch(
      /create policy academy_materials_read on public\.academy_materials\s*for select to authenticated using \(published or public\.academy_is_teacher\(\)\)/,
    );
  });
});

describe("the admin page offers the three actions", () => {
  it("has a real file input, not a typed storage path", () => {
    expect(page).toMatch(/type="file"/);
    expect(page).not.toMatch(/name="storage_path"/);
    expect(page).not.toMatch(/MIME type/);
  });

  it("has replace and delete controls", () => {
    expect(page).toMatch(/Replace file/);
    expect(page).toMatch(/Delete/);
    expect(page).toMatch(/confirmDelete/);
    expect(page).toMatch(/submitReplacement/);
  });

  it("asks before deleting, and says it cannot be undone", () => {
    expect(page.replace(/\s+/g, " ")).toMatch(/This cannot be undone/);
  });

  it("validates the file before it is sent anywhere", () => {
    expect(page).toMatch(/validateAcademyMaterialFile/);
  });

  it("does not force a re-upload when only details are being edited", () => {
    expect(page).toMatch(/Leave empty to save the details without changing the file/);
  });
});
