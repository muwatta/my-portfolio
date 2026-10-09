import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261409000000_academy_signup_notifications_cpp_sequence_and_leaderboard.sql",
  "utf8",
);
const app = readFileSync("src/App.jsx", "utf8");
const layout = readFileSync("src/components/academy/AcademyLayout.jsx", "utf8");
const notifications = readFileSync("src/pages/AcademyNotifications.jsx", "utf8");
const alert = readFileSync(
  "src/components/academy/AcademyAdminSignupAlert.jsx",
  "utf8",
);

describe("new signups notify administrators", () => {
  it("creates a private registration notification for each administrator", () => {
    expect(migration).toMatch(/'registration'/);
    expect(migration).toMatch(/after insert on auth\.users/);
    expect(migration).toMatch(/from public\.academy_admins admin/);
    expect(migration).toMatch(/Review registrations to place them in a course/);
  });

  it("lets administrators open their notifications and review registrations", () => {
    expect(app).toMatch(
      /path="\/academy\/admin\/notifications"[\s\S]*?element=\{<AcademyNotifications \/>\}/,
    );
    expect(layout).toMatch(/\/academy\/admin\/notifications/);
    expect(notifications).toMatch(/item\.type === "registration"/);
    expect(notifications).toMatch(/\/academy\/admin\/registrations/);
  });

  it("shows a live signup alert to an administrator who is already online", () => {
    expect(migration).toMatch(/add table public\.academy_notifications/);
    expect(alert).toMatch(/table: "academy_notifications"/);
    expect(alert).toMatch(/row\?\.type === "registration"/);
    expect(alert).toMatch(/\/academy\/admin\/registrations/);
    expect(layout).toMatch(/workspace === "admin" && <AcademyAdminSignupAlert/);
  });
});
