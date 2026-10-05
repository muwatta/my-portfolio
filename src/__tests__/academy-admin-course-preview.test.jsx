import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AcademyAdminCoursePreview from "../pages/AcademyAdminCoursePreview";
import { getAcademyCoursePreview } from "../lib/academy";

vi.mock("../lib/academy", () => ({
  getAcademyCoursePreview: vi.fn(),
}));

const previewCourse = {
  id: "python-course",
  slug: "python-for-ai-machine-learning",
  title: "Python for Young Innovators",
  description: "Learn Python by building projects.",
  weeks: [
    {
      id: "week-1",
      week_number: 1,
      title: "Starting to Code",
      lessons: [
        {
          id: "lesson-1",
          title: "Session 1: Your First Python",
          objectives: ["Print text"],
          content: { explanation: "Programs give computers instructions." },
          exercises: [{ id: "practice-1", title: "Print a greeting" }],
          assignments: [
            {
              id: "assignment-1",
              title: "My First Welcome Card",
              instructions: "Print three welcome lines.",
              points: 20,
            },
          ],
        },
        {
          id: "lesson-2",
          title: "Session 2: Comments",
          objectives: ["Explain comments"],
          content: {},
          exercises: [],
          assignments: [],
        },
      ],
    },
  ],
};

function renderPreview() {
  return render(
    <MemoryRouter
      initialEntries={[
        "/academy/admin/previews/python-for-ai-machine-learning",
      ]}
    >
      <Routes>
        <Route
          path="/academy/admin/previews/:courseSlug"
          element={<AcademyAdminCoursePreview />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("admin student-facing course preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAcademyCoursePreview.mockResolvedValue({
      data: previewCourse,
      error: null,
    });
  });

  it("shows published course outline and learner content without an enrollment", async () => {
    renderPreview();

    expect(
      await screen.findByRole("heading", {
        name: "Python for Young Innovators",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/student view · read only/i)).toBeInTheDocument();
    expect(screen.getByText(/1 available weeks · 2 published lessons/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Session 1: Your First Python" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Programs give computers instructions.")).toBeInTheDocument();
    expect(screen.getByText("My First Welcome Card")).toBeInTheDocument();
    expect(getAcademyCoursePreview).toHaveBeenCalledWith(
      "python-for-ai-machine-learning",
    );
  });

  it("lets the admin switch lessons in the outline", async () => {
    const user = userEvent.setup();
    renderPreview();
    const lessonButton = await screen.findByRole("button", {
      name: "Session 2: Comments",
    });

    await user.click(lessonButton);

    expect(
      screen.getByRole("heading", { name: "Session 2: Comments" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No published practice yet")).toBeInTheDocument();
    expect(screen.getByText("No published assignments yet")).toBeInTheDocument();
  });

  it("makes the read-only boundary and return path clear", async () => {
    renderPreview();

    const preview = await screen.findByRole("article");
    expect(
      within(preview).getByText(/does not change enrollments, record progress/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /admin dashboard/i }),
    ).toHaveAttribute("href", "/academy/admin");
    expect(
      screen.queryByRole("button", { name: /submit|complete lesson/i }),
    ).not.toBeInTheDocument();
  });

  it("reports a failed preview load instead of showing an empty course", async () => {
    getAcademyCoursePreview.mockResolvedValue({
      data: null,
      error: new Error("Permission denied"),
    });

    renderPreview();

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/course preview could not be loaded/i);
  });
});
