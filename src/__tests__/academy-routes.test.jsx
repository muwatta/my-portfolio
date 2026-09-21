import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../lib/supabase", () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

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

  it("renders the public student signup route", async () => {
    render(
      <MemoryRouter initialEntries={["/academy/signup"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /Create your account/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Academy sign-up is not configured/i),
    ).toBeInTheDocument();
  });

  it("protects the courses route when unconfigured", async () => {
    render(
      <MemoryRouter initialEntries={["/academy/courses"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Academy sign-in is not configured/i),
    ).toBeInTheDocument();
  });

  it("protects the teacher student control center", async () => {
    render(
      <MemoryRouter initialEntries={["/academy/teacher/students"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Academy sign-in is not configured/i),
    ).toBeInTheDocument();
  });

  it("protects the teacher lesson control center", async () => {
    render(
      <MemoryRouter initialEntries={["/academy/teacher/lessons"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Academy sign-in is not configured/i),
    ).toBeInTheDocument();
  });

  it("protects the student projects route", async () => {
    render(
      <MemoryRouter initialEntries={["/academy/projects"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Academy sign-in is not configured/i),
    ).toBeInTheDocument();
  });

  it.each([
    "/academy/leaderboard",
    "/academy/notifications",
    "/academy/live",
    "/academy/teacher/analytics",
  ])("protects the new Academy route %s", async (route) => {
    render(
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Academy sign-in is not configured/i),
    ).toBeInTheDocument();
  });

  it.each([
    "/academy/admin",
    "/academy/admin/students",
    "/academy/admin/students/student-id",
    "/academy/profile",
  ])("protects the role-specific route %s", async (route) => {
    render(
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Academy sign-in is not configured/i),
    ).toBeInTheDocument();
  });
});
