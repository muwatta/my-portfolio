import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LessonContent from "../components/academy/LessonContent";

describe("LessonContent", () => {
  it("shows a timed weekly learning plan", () => {
    render(
      <LessonContent
        content={{
          weekly_plan: [
            { minutes: 20, label: "Warm-up", activity: "Predict the output." },
            { minutes: 60, label: "Concept studio", activity: "Read and try." },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Your weekly plan" })).toBeInTheDocument();
    expect(screen.getByText("1h 20m")).toBeInTheDocument();
    expect(screen.getByText("Predict the output.")).toBeInTheDocument();
  });

  it("does not show a weekly plan when none is provided", () => {
    render(<LessonContent content={{ explanation: "Learn by doing." }} />);

    expect(
      screen.queryByRole("heading", { name: "Your weekly plan" }),
    ).not.toBeInTheDocument();
  });
});
