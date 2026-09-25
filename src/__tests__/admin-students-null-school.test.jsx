import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAcademyTeacherStudents = vi.fn();
const assignAcademyStudentLevel = vi.fn();

vi.mock("../lib/academy", () => ({
  getAcademyTeacherStudents: (...args) => getAcademyTeacherStudents(...args),
  assignAcademyStudentLevel: (...args) => assignAcademyStudentLevel(...args),
}));

vi.mock("../lib/utils", () => ({
  friendlyError: (_error, fallback) => fallback,
}));

import AcademyAdminStudents from "../pages/AcademyAdminStudents";

const school = { id: "school-1", name: "Example School", code: "EX" };

function student(overrides = {}) {
  return {
    id: "student-1",
    display_name: "Ade Student",
    role: "student",
    state: "Lagos",
    school_id: null,
    current_course_id: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    academy_registration_codes: null,
    academy_schools: null,
    academy_courses: null,
    activity: { seconds: 0, lastActive: null },
    enrollment: null,
    completedLessons: 0,
    ...overrides,
  };
}

describe("AcademyAdminStudents", () => {
  beforeEach(() => {
    getAcademyTeacherStudents.mockReset();
    assignAcademyStudentLevel.mockReset();
  });

  it("renders students that have no school and does not crash", async () => {
    getAcademyTeacherStudents.mockResolvedValue({
      data: {
        students: [
          student(),
          student({
            id: "student-2",
            display_name: "Bola Student",
            academy_schools: school,
            school_id: school.id,
          }),
          student({ id: "student-3", display_name: "Chidi Student" }),
        ],
        levels: [],
      },
      error: null,
      configured: true,
    });

    render(
      <MemoryRouter>
        <AcademyAdminStudents />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getAllByText("Ade Student").length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText("Bola Student").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Example School").length).toBeGreaterThan(0);
  });

  it("deduplicates the school filter when several students share a school", async () => {
    getAcademyTeacherStudents.mockResolvedValue({
      data: {
        students: [
          student({ id: "a", academy_schools: school, school_id: school.id }),
          student({ id: "b", academy_schools: school, school_id: school.id }),
          student({ id: "c" }),
        ],
        levels: [],
      },
      error: null,
      configured: true,
    });

    render(
      <MemoryRouter>
        <AcademyAdminStudents />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText("Ade Student").length).toBeGreaterThan(0));

    const schoolSelect = screen.getByLabelText(/filter by school/i);
    const options = Array.from(schoolSelect.querySelectorAll("option"));
    const exampleOptions = options.filter(
      (option) => option.textContent.includes("Example School"),
    );
    expect(exampleOptions).toHaveLength(1);
  });
});
