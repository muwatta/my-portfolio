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
      await screen.findByText(/Build things that actually run\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Student sign in/i }),
    ).toHaveAttribute("href", "/academy/login");
  });

  // The auth provider is a lazy import of a module that pulls in Supabase, which
  // is 216 KiB. It used to wrap every academy route, so opening the front page
  // fetched a quarter of a megabyte behind a spinner for a page that reads
  // nothing from the session. These assert the provider is still mounted for the
  // routes that need it, and still absent for the two that do not.
  it("renders the FAQ without waiting on the auth provider", async () => {
    render(
      <MemoryRouter initialEntries={["/academy/faq"]}>
        <App />
      </MemoryRouter>,
    );

    // The FAQ is public content. If the provider were wrongly required here, this
    // would render the "not configured" sign-in message instead.
    expect(
      await screen.findByRole("heading", { name: /how to use the academy/i }),
    ).toBeInTheDocument();
    // If the provider were wrongly required here, the sign-in message would
    // replace this page instead.
    expect(screen.queryByText(/Academy sign-in is not configured/i)).toBeNull();
  });

  it("treats a trailing slash on the academy front page as the same public page", async () => {
    // "/academy" is a prefix of every academy route, so this exact match is the
    // only thing stopping the whole application being opted back in.
    render(
      <MemoryRouter initialEntries={["/academy/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Build things that actually run\./i),
    ).toBeInTheDocument();
  });

  it("still mounts the auth provider for the sign-in pages", async () => {
    // Login reads the session, so dropping the provider would break it. The
    // "not configured" message here comes from inside that provider's subtree.
    render(
      <MemoryRouter initialEntries={["/academy/login"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Academy sign-in is not configured/i),
    ).toBeInTheDocument();
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
    "/academy/admin/dashboard",
    "/academy/admin/students",
    "/academy/admin/registrations",
    "/academy/admin/students/student-id",
    "/academy/admin/courses",
    "/academy/admin/assignments",
    "/academy/admin/submissions",
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
