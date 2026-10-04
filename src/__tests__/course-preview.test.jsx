import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { fetchPublicCourses } from "../lib/publicCourses";
import { CoursePreview } from "../features/home/sections/CoursePreview";

vi.mock("../lib/publicCourses", () => ({
  fetchPublicCourses: vi.fn(),
  courseSummary: (course) => course.description,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("homepage course preview", () => {
  it("renders only courses returned by the published catalogue", async () => {
    fetchPublicCourses.mockResolvedValue([
      {
        slug: "published-ai-course",
        title: "Published AI course",
        description: "Available now",
        language: "Python",
      },
    ]);

    render(
      <MemoryRouter>
        <CoursePreview />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Published AI course/ }),
      ).toHaveAttribute("href", "/courses/published-ai-course");
    });
    expect(screen.queryByText("C++ for Embedded Systems")).not.toBeInTheDocument();
  });
});
