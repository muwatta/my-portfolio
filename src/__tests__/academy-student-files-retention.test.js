import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILE_RULES, validateAcademyFile } from "../lib/academyFiles";

const migrationPath =
  "supabase/migrations/20261335000000_academy_upload_retention_persistent_chat.sql";
const migration = readFileSync(migrationPath, "utf8");
const cleanup = readFileSync(
  "supabase/functions/academy-cleanup-assignment-files/index.ts",
  "utf8",
);
const workflow = readFileSync(
  ".github/workflows/cleanup-assignment-files.yml",
  "utf8",
);

describe("assignment file uploads", () => {
  it("allows the supported source, document, notebook and image formats", () => {
    for (const extension of Object.keys(FILE_RULES)) {
      const mime = FILE_RULES[extension].mime[0];
      expect(
        validateAcademyFile({
          name: `submission${extension}`,
          size: 5 * 1024 * 1024,
          type: mime,
        }).valid,
      ).toBe(true);
    }
  });

  it("applies the same strict 5 MiB limit to every supported type", () => {
    for (const rule of Object.values(FILE_RULES)) {
      expect(rule.maxBytes).toBe(5 * 1024 * 1024);
    }
    expect(
      validateAcademyFile({
        name: "assignment.py",
        size: 5 * 1024 * 1024 + 1,
        type: "text/x-python",
      }),
    ).toMatchObject({ valid: false, error: ".py files must be 5 MB or smaller." });
  });

  it("enforces the upload limit at both Storage and database layers", () => {
    expect(migration).toMatch(/set file_size_limit = 5242880/);
    expect(migration).toMatch(/select 5242880/);
    expect(migration).toContain("image/png");
    expect(migration).toContain("text/x-python");
    expect(migration).toContain("video/mp4");
    expect(migration).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("removes expired objects with the Storage API and preserves submission history", () => {
    expect(cleanup).toMatch(/RETENTION_DAYS = 30/);
    expect(cleanup).toMatch(/\.from\(BUCKET\)\s*\.remove\(filePaths\)/);
    expect(cleanup).toMatch(/update\(\{ file_path: null \}\)/);
    expect(cleanup).not.toMatch(/\.delete\(\)/);
    expect(workflow).toMatch(/schedule:/);
    expect(workflow).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(workflow).toMatch(/academy-cleanup-assignment-files/);
  });

  it("runs a scheduled cleanup daily so files expire at the 30-day threshold", () => {
    expect(workflow).toMatch(/cron: "17 3 \* \* \*"/);
    expect(workflow).toMatch(/workflow_dispatch/);
  });
});

describe("admin controls", () => {
  it("keeps the admin dashboard tied to real Academy outcomes", () => {
    const dashboard = readFileSync("src/pages/AcademyAdminDashboard.jsx", "utf8");
    expect(dashboard).toMatch(/Academy control room/);
    expect(dashboard).toMatch(/overview\?\.verifiedPoints/);
    expect(dashboard).toMatch(/overview\?\.activeLearners/);
    expect(dashboard).toMatch(/overview\?\.pendingSubmissions/);
  });

  it("allows existing admins to appoint other admins and protects the owner", () => {
    const migrations = readdirSync("supabase/migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .map((name) =>
        readFileSync(`supabase/migrations/${name}`, "utf8"),
      )
      .join("\n");
    const guard = [
      ...migrations.matchAll(
        /create or replace function public\.academy_set_user_admin\([\s\S]*?\$\$;/g,
      ),
    ].at(-1)?.[0];
    expect(guard).toMatch(/if not public\.academy_is_admin\(\) then/);
    expect(guard).toMatch(/if should_be_admin then/);
    expect(guard).toMatch(/academy_primary_admin_id\(\)/);
    expect(guard).toMatch(/primary administrator cannot be removed/i);
    const accessPage = readFileSync("src/pages/AcademyAdminAccess.jsx", "utf8");
    expect(accessPage).toMatch(/setAcademyAdmin/);
    expect(accessPage).toMatch(/Grant admin access/);
    expect(accessPage).toMatch(/Administrators can appoint or remove other administrators/);
  });
});
