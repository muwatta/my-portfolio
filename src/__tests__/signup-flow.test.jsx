import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signUp = vi.fn();
const resendConfirmation = vi.fn();

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => ({
    user: null,
    loading: false,
    isConfigured: true,
    signUp,
    resendConfirmation,
  }),
}));

vi.mock("../context/useTheme", () => ({
  useTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));

vi.mock("../lib/academy", () => ({
  getAcademySchools: async () => ({
    data: [
      {
        id: "school-cimai",
        name: "CIMAI",
        code: "CIMAI",
        state: "Kwara",
        city: "Ilorin",
      },
    ],
    error: null,
  }),
}));

import AcademySignup from "../pages/AcademySignup";

describe("Academy signup submission", () => {
  beforeEach(() => {
    signUp.mockReset();
    resendConfirmation.mockReset();
  });

  it("calls Supabase signUp once when the submit button is double-clicked", async () => {
    let resolveSignup;
    signUp.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignup = resolve;
        }),
    );

    render(
      <MemoryRouter>
        <AcademySignup />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Test Student" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.com" },
    });
    await screen.findByRole("option", { name: "CIMAI · Ilorin" });
    fireEvent.change(screen.getByLabelText("School"), {
      target: { value: "school-cimai" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Cplusplus2026!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Cplusplus2026!" },
    });

    const submitButton = screen.getByRole("button", {
      name: "Create student account",
    });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    expect(signUp).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", {
        name: "Creating your Academy account...",
      }),
    ).toBeDisabled();

    resolveSignup({ data: { user: { id: "user-id" } }, error: null });
    await waitFor(() =>
      expect(screen.getByText("Welcome to Algorise Tech Explorers!")).toBeInTheDocument(),
    );
  });

  it("lets a student request another confirmation email", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    resendConfirmation.mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <AcademySignup />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Test Student" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " Student@Example.com " },
    });
    await screen.findByRole("option", { name: "CIMAI · Ilorin" });
    fireEvent.change(screen.getByLabelText("School"), {
      target: { value: "school-cimai" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Cplusplus2026!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Cplusplus2026!" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create student account" }),
    );

    const resendButton = await screen.findByRole("button", {
      name: "Resend confirmation email",
    });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(resendConfirmation).toHaveBeenCalledWith("student@example.com");
      expect(
        screen.getByText(/A new confirmation email has been requested/),
      ).toBeInTheDocument();
    });
  });
});
