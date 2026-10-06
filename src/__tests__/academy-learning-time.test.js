import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`supabase/migrations/${name}`, "utf8"))
  .join("\n");
const academy = readFileSync("src/lib/academy.js", "utf8");
const roleFix = readFileSync(
  "supabase/migrations/20261346000000_academy_role_rpc_and_learning_time.sql",
  "utf8",
);

describe("cumulative learning time", () => {
  it("does not truncate the student's session history", () => {
    const overview = academy.match(
      /export async function getAcademyStudentOverview[\s\S]*?(?=\nexport async function)/,
    )?.[0];

    expect(overview).toBeTruthy();
    expect(overview).not.toMatch(/academy_learning_sessions[\s\S]*?\.limit\(/);
  });

  it("does not delete session totals when cleaning up old heartbeat events", () => {
    const cleanupFunctions = [
      ...migrations.matchAll(
        /create or replace function public\.academy_cleanup_live_data\([\s\S]*?\$\$;/g,
      ),
    ];

    expect(cleanupFunctions.length).toBeGreaterThan(0);
    expect(cleanupFunctions.at(-1)[0]).not.toMatch(
      /delete from public\.academy_learning_sessions/i,
    );
    expect(cleanupFunctions.at(-1)[0]).toMatch(
      /delete from public\.academy_learning_session_events/i,
    );
  });

  it("restores the role RPC expected by the admin controls", () => {
    expect(roleFix).toMatch(
      /function public\.academy_set_user_role\(\s*target_user_id uuid,\s*target_role public\.academy_role\s*\)/,
    );
    expect(roleFix).toMatch(
      /grant execute on function public\.academy_set_user_role\(uuid, public\.academy_role\)\s*to authenticated/,
    );
    expect(roleFix).toMatch(/notify pgrst, 'reload schema'/i);
  });
});
