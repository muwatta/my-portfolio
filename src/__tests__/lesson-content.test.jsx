import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LessonContent from "../components/academy/LessonContent";

describe("LessonContent", () => {
  it("shows the weekly plan without time estimates", () => {
    render(
      <LessonContent
        content={{
          weekly_plan: [
            { minutes: 20, label: "Warm-up", activity: "Predict the output." },
            { minutes: 60, label: "Concept studio", activity: "Read and try." },
            { minutes: 50, label: "Practice", activity: "Try another example." },
            { minutes: 45, label: "Review", activity: "Explain the result." },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Your weekly plan" })).toBeInTheDocument();
    expect(screen.getByText("Predict the output.")).toBeInTheDocument();
    expect(screen.getByText("Read and try.")).toBeInTheDocument();
    expect(screen.queryByText(/\b(20|50|60|45)\s*min\b/i)).not.toBeInTheDocument();
  });

  it("does not show a weekly plan when none is provided", () => {
    render(<LessonContent content={{ explanation: "Learn by doing." }} />);

    expect(
      screen.queryByRole("heading", { name: "Your weekly plan" }),
    ).not.toBeInTheDocument();
  });
});
