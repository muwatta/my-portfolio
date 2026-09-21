import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

describe("Academy routes", () => {
  it("renders the Academy entry page inside the existing app", async () => {
    render(
      <MemoryRouter initialEntries={["/academy"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Learn Python by building toward AI/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Sign in to Academy/i }),
    ).toHaveAttribute("href", "/academy/login");
  });

  it("shows the configured-state message on the login page when env vars are absent", async () => {
    render(
      <MemoryRouter initialEntries={["/academy/login"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Academy sign-in is not configured/i),
    ).toBeInTheDocument();
  });

  it("protects the student dashboard", async () => {
    render(
      <MemoryRouter initialEntries={["/academy/dashboard"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Academy sign-in is not configured/i),
    ).toBeInTheDocument();
  });
});
