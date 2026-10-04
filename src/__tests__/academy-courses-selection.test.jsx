import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AcademyCourses from "../pages/AcademyCourses";
import {
  getAcademyCourses,
  getActiveCourseForStudent,
  selectAcademyCourse,
} from "../lib/academy";

vi.mock("../lib/academy", () => ({
  getAcademyCourses: vi.fn(),
  getActiveCourseForStudent: vi.fn(),
  selectAcademyCourse: vi.fn(),
}));

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => ({ user: { id: "student-1" } }),
}));

vi.mock("../lib/academyOffline", () => ({
  fetchWithOfflineFallback: async ({ fetcher }) => ({
    ...(await fetcher()),
    offline: false,
  }),
}));

vi.mock("../lib/offlineStore", () => ({
  OFFLINE_STORES: { courses: "courses" },
}));

vi.mock("../components/academy/CourseReviews", () => ({
  default: () => null,
}));

vi.mock("../components/academy/DownloadedCourseManager", () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("course selection guidance", () => {
  it("identifies the current course and explains why the other course is unavailable", async () => {
    getAcademyCourses.mockResolvedValue({
      data: [
        {
          id: "python-course",
          title: "Python for AI and ML",
          duration_weeks: 11,
        },
        {
          id: "cpp-course",
          title: "C++ for Embedded Systems",
          duration_weeks: 24,
        },
      ],
      configured: true,
    });
    getActiveCourseForStudent.mockResolvedValue({
      data: {
        id: "python-course",
        title: "Python for AI and ML",
      },
    });

    render(
      <MemoryRouter>
        <AcademyCourses />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("region", { name: "Your current course" }),
    ).toHaveTextContent("Python for AI and ML");
    expect(
      screen.getByRole("link", { name: "Continue learning" }),
    ).toHaveAttribute("href", "/academy/lessons");

    expect(
      screen.getByText(/This course is locked while you are on/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Locked while you’re on Python for AI and ML",
      }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Ask your teacher or an Academy admin if you need to switch courses/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Your current course" }),
    ).toBeDisabled();
    expect(selectAcademyCourse).not.toHaveBeenCalled();
  });
});
