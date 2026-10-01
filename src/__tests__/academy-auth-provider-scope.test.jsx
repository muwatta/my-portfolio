// @vitest-environment jsdom
//
// Why this file is separate from academy-routes.test.jsx: that suite asserts
// what the visitor sees, and with Supabase mocked out the auth provider renders
// its children either way. So mounting it, or not, changes nothing there, and a
// test written that way passes both before and after the fix. It did.
//
// This asserts the thing that actually matters: which routes mount the academy
// auth provider. It is a lazy import of a module that pulls in Supabase, 216 KiB
// of it, and it used to wrap every academy route including the two public
// marketing pages that read nothing from the session.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const providerCalls = { count: 0 };

vi.mock("../lib/supabase", () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

vi.mock("../context/AcademyAuthContext", () => ({
  AcademyAuthProvider: ({ children }) => {
    providerCalls.count += 1;
    return <div data-testid="academy-auth-provider">{children}</div>;
  },
}));

import App from "../App";

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

beforeEach(() => {
  providerCalls.count = 0;
});

describe("the academy's public pages do not mount the auth provider", () => {
  // 216 KiB of Supabase behind a spinner, for a page that needs no session.
  it.each(["/academy", "/academy/", "/academy/faq"])(
    "%s skips it",
    async (path) => {
      renderAt(path);
      // Let the lazy route settle, so a provider mounted after the first paint is
      // counted rather than missed.
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(providerCalls.count).toBe(0);
    },
    15000,
  );

  it("still renders the public landing page", async () => {
    renderAt("/academy");
    expect(
      await screen.findByText(/Build things that actually run\./i),
    ).toBeInTheDocument();
  });

  it("still renders the public FAQ", async () => {
    renderAt("/academy/faq");
    expect(
      await screen.findByRole("heading", { name: /how to use the academy/i }),
    ).toBeInTheDocument();
  });
});

describe("routes that read a session still mount the auth provider", () => {
  // The obvious way to break the optimisation is to over-apply it and strip the
  // provider from a page that genuinely needs one.
  it.each([
    "/academy/login",
    "/academy/signup",
    "/academy/forgot-password",
    "/academy/reset-password",
    "/academy/dashboard",
    "/academy/courses",
    "/academy/teacher",
    "/academy/admin",
  ])("%s mounts it", async (path) => {
    renderAt(path);
    expect(await screen.findByTestId("academy-auth-provider")).toBeInTheDocument();
    expect(providerCalls.count).toBeGreaterThan(0);
  }, 15000);
});

describe("routes outside the academy are unaffected", () => {
  it.each(["/", "/portfolio", "/about"])("%s mounts no academy provider", async (path) => {
    renderAt(path);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(providerCalls.count).toBe(0);
  }, 15000);
});
