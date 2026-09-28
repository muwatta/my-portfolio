import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATIONS = "supabase/migrations";
const allSql = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`${MIGRATIONS}/${name}`, "utf8"))
  .join("\n");

function latestDefinition(name) {
  const matches = [
    ...allSql.matchAll(
      new RegExp(
        `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
        "g",
      ),
    ),
  ];
  expect(matches.length, `${name} should exist`).toBeGreaterThan(0);
  return matches.at(-1)[0];
}

const register = latestDefinition("academy_register_submission");
const ceiling = latestDefinition("academy_file_ceiling");
const academy = readFileSync("src/lib/academy.js", "utf8");

describe("the bucket refuses oversized uploads", () => {
  it("sets a file size limit on the submission bucket", () => {
    expect(allSql).toMatch(
      /update storage\.objects|update storage\.buckets/,
    );
    expect(allSql).toMatch(/set file_size_limit = 26214400/);
  });

  it("restricts the bucket to types an assignment could reasonably need", () => {
    expect(allSql).toMatch(/allowed_mime_types = array\[/);
    ["image/png", "application/pdf", "video/mp4", "text/x-python"].forEach(
      (mime) => expect(allSql).toContain(mime),
    );
    // An executable must never be an accepted submission type.
    expect(allSql).not.toMatch(/'application\/x-msdownload'/);
    expect(allSql).not.toMatch(/'application\/x-executable'/);
  });
});

describe("the database validates the submission", () => {
  it("has a hard ceiling no assignment can exceed", () => {
    expect(ceiling).toMatch(/20971520/);
    expect(register).toMatch(/p_file_size_bytes > ceiling/);
  });

  it("takes the tighter of the bucket and the assignment limit", () => {
    expect(register).toMatch(/assignment\.max_file_size_bytes is not null/);
    expect(register).toMatch(/larger than this assignment allows/);
  });

  it("will not accept a file from another member's folder", () => {
    expect(register).toMatch(/must be in your own folder/);
  });

  it("checks the extension against what the assignment allows", () => {
    expect(register).toMatch(/allowed_file_types/);
    expect(register).toMatch(/not accepted for this assignment/);
    // Matching on the extension, not the mime type, because a browser can be
    // told anything and the extension is what a teacher downloads.
    expect(register).toMatch(/regexp_replace\(p_original_filename/);
  });

  it("refuses an unrecorded or empty size rather than trusting the client", () => {
    expect(register).toMatch(/file size was not recorded/);
    expect(register).toMatch(/p_file_size_bytes <= 0/);
  });

  it("only accepts an open assignment", () => {
    expect(register).toMatch(/status <> 'published'/);
    expect(register).toMatch(/not open/);
  });
});

describe("attempts and retries", () => {
  it("counts attempts server side rather than trusting the client", () => {
    expect(register).toMatch(/you have used all % attempts/i);
    expect(register).toMatch(/assignment\.retry_limit is not null/);
  });

  it("is idempotent so a queued retry cannot double count", () => {
    expect(register).toMatch(/client_operation_id = p_client_operation_id/);
    expect(register).toMatch(/if created\.id is not null then\s*return created/);
  });

  it("writes an audit event for the submission", () => {
    expect(register).toMatch(/academy_submission_events/);
    expect(register).toMatch(/'submitted'/);
  });
});

describe("the browser no longer writes submissions directly", () => {
  it("goes through the validated function", () => {
    const submit = academy.slice(
      academy.indexOf("export async function submitAssignment"),
      academy.indexOf("export async function", academy.indexOf("export async function submitAssignment") + 10),
    );
    expect(submit).toMatch(/supabase\.rpc\("academy_register_submission"/);
    expect(submit).not.toMatch(/from\("academy_submissions"\)\s*\.insert/);
  });

  it("no longer takes an attempt number from the caller", () => {
    const submit = academy.slice(
      academy.indexOf("export async function submitAssignment"),
      academy.indexOf("export async function", academy.indexOf("export async function submitAssignment") + 10),
    );
    // The count is derived in the database, so a client cannot ask for attempt
    // nine on a single attempt assignment.
    expect(submit).not.toMatch(/attemptNumber/);
  });
});
