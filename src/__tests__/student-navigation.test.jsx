import { describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  current: { isStudent: true, isAdmin: false, isTeacher: false },
}));

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => authState.current,
}));

import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StudentSectionNav from "../components/academy/StudentSectionNav";

describe("student navigation", () => {
  it("shows only supplementary destinations already absent from the main navigation", () => {
    const { container } = render(
      <MemoryRouter>
        <StudentSectionNav />
      </MemoryRouter>,
    );

    const labels = Array.from(container.querySelectorAll("a")).map(
      (link) => link.textContent,
    );

    expect(labels).toEqual([
      "Materials",
      "Course",
      "Projects",
      "Tests",
      "Leaderboard",
    ]);
  });

  it("keeps notifications and live classroom out of the section list", () => {
    const { container } = render(
      <MemoryRouter>
        <StudentSectionNav />
      </MemoryRouter>,
    );
    const labels = Array.from(container.querySelectorAll("a")).map(
      (link) => link.textContent,
    );

    expect(labels).not.toContain("Notifications");
    expect(labels).not.toContain("Live classroom");
    expect(labels).not.toContain("Achievements");
  });

  it("links every section destination to a real route", () => {
    const { container } = render(
      <MemoryRouter>
        <StudentSectionNav />
      </MemoryRouter>,
    );
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) =>
      link.getAttribute("href"),
    );

    expect(hrefs.every((href) => href.startsWith("/academy/"))).toBe(true);
    expect(hrefs).toContain("/academy/leaderboard");
    expect(hrefs).toContain("/academy/projects");
    expect(hrefs).toContain("/academy/exams");
  });
});
