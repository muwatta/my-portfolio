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
import StudentPrimaryNav from "../components/academy/StudentPrimaryNav";

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
      "Courses",
      "Materials",
      "Projects",
      "Assessments",
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

  it("keeps the matching supplementary section active on nested pages", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/academy/projects/project-1"]}>
        <StudentSectionNav />
      </MemoryRouter>,
    );

    const projectsLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent === "Projects",
    );

    expect(projectsLink?.getAttribute("aria-current")).toBe("page");
  });

  it("keeps primary learning actions together in a clear order", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/academy/practice"]}>
        <StudentPrimaryNav />
      </MemoryRouter>,
    );

    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((link) => link.textContent)).toEqual([
      "Home",
      "Learn",
      "Practice",
      "Assignments",
      "Progress",
      "Profile",
    ]);
    expect(links[2].getAttribute("href")).toBe("/academy/practice");
    expect(links[2].getAttribute("aria-current")).toBe("page");
  });

  it("keeps assignment details under the Assignments destination", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/academy/assignments/assignment-1"]}>
        <StudentPrimaryNav />
      </MemoryRouter>,
    );

    const assignmentsLink = Array.from(
      container.querySelectorAll("a"),
    ).find((link) => link.textContent === "Assignments");

    expect(assignmentsLink?.getAttribute("aria-current")).toBe("page");
  });
});
