import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

describe("Academy course entry", () => {
  it("renders the course details and application entry", async () => {
    render(
      <MemoryRouter initialEntries={["/academy"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Learn\. Build\. Practice\. Grow\./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/The learning path/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Apply to Academy/i }),
    ).toHaveAttribute("href", "/academy/signup");
    expect(
      screen.getByRole("link", { name: /Start your application/i }),
    ).toHaveAttribute("href", "/academy/signup");
  });
});
