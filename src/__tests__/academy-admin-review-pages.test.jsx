import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAcademyTeacherAnalytics = vi.fn();
const getAcademyTeacherClasses = vi.fn();
const getAcademyTeacherCourses = vi.fn();
const saveAcademyClass = vi.fn();

vi.mock("../lib/academy", () => ({
  getAcademyTeacherAnalytics: (...args) =>
    getAcademyTeacherAnalytics(...args),
  getAcademyTeacherClasses: (...args) => getAcademyTeacherClasses(...args),
  getAcademyTeacherCourses: (...args) => getAcademyTeacherCourses(...args),
  saveAcademyClass: (...args) => saveAcademyClass(...args),
}));

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => ({ isAdmin: true }),
}));

import AcademyTeacherAnalytics from "../pages/AcademyTeacherAnalytics";
import AcademyTeacherClasses from "../pages/AcademyTeacherClasses";

const analyticsData = {
  submissions: 3,
  students: [
    {
      id: "s1",
      display_name: "Amanda",
      current_course_id: "course-1",
      academy_courses: { title: "Python" },
      academy_schools: { name: "CIMAI" },
      activity: { seconds: 10000, lastActive: "2026-10-14T10:00:00.000Z" },
      completedLessons: 4,
    },
    {
      id: "s2",
      display_name: "Zainab",
      current_course_id: "course-1",
      academy_courses: { title: "Python" },
      academy_schools: { name: "MMS" },
      activity: { seconds: 100, lastActive: null },
      completedLessons: 0,
    },
    {
      id: "s3",
      display_name: "Musa",
      current_course_id: "course-2",
      academy_courses: { title: "C++" },
      academy_schools: { name: "DGHIA" },
      activity: { seconds: 400, lastActive: "2026-10-13T10:00:00.000Z" },
      completedLessons: 0,
    },
  ],
};

describe("superadmin review pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAcademyTeacherAnalytics.mockResolvedValue({
      data: analyticsData,
      error: null,
    });
    getAcademyTeacherClasses.mockResolvedValue({
      data: [
        {
          id: "class-1",
          name: "Robotics Group A",
          course_id: "course-1",
          academy_courses: { title: "C++ Robotics" },
          creator_name: "Instructor One",
          created_at: "2026-10-01T00:00:00.000Z",
          description: "Build and test simple robots.",
          academy_class_members: [
            {
              student_id: "s1",
              status: "active",
              academy_profiles: { display_name: "Ada Student" },
            },
            {
              student_id: "s2",
              status: "inactive",
              academy_profiles: { display_name: "Ben Student" },
            },
          ],
        },
      ],
      error: null,
    });
    getAcademyTeacherCourses.mockResolvedValue({
      data: [{ id: "course-1", title: "C++ Robotics" }],
      error: null,
    });
  });

  it("starts analytics with least-completed learners and sorts metrics ascending", async () => {
    const { container } = render(<AcademyTeacherAnalytics />);

    await waitFor(() => {
      const names = [...container.querySelectorAll("tbody tr")].map(
        (row) => row.cells[0].textContent.trim(),
      );
      expect(names).toEqual(["Musa", "Zainab", "Amanda"]);
    });

    expect(screen.getAllByText("DGHIA").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Order by"), {
      target: { value: "learningTime" },
    });

    const names = [...container.querySelectorAll("tbody tr")].map(
      (row) => row.cells[0].textContent.trim(),
    );
    expect(names).toEqual(["Zainab", "Musa", "Amanda"]);
  });

  it("shows the course, creator, and actual active class roster", async () => {
    render(
      <MemoryRouter>
        <AcademyTeacherClasses />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Review every class, its course, creator, and current student roster."),
    ).toBeInTheDocument();
    expect(screen.getByText("Robotics Group A")).toBeInTheDocument();
    expect(screen.getAllByText("C++ Robotics").length).toBeGreaterThan(0);
    expect(screen.getByText("Ada Student")).toBeInTheDocument();
    expect(screen.getByText(/by Instructor One/)).toBeInTheDocument();
    expect(screen.getByText(/1 inactive/i)).toBeInTheDocument();
    expect(screen.queryByText("Ben Student")).not.toBeInTheDocument();
  });
});
