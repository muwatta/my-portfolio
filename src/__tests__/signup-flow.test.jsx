import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signUp = vi.fn();

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => ({
    user: null,
    loading: false,
    isConfigured: true,
    signUp,
  }),
}));

vi.mock("../context/useTheme", () => ({
  useTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));

import AcademySignup from "../pages/AcademySignup";

describe("Academy signup submission", () => {
  beforeEach(() => {
    signUp.mockReset();
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

    fireEvent.change(screen.getByLabelText("Academy Registration Number"), {
      target: { value: "ATE-26-014" },
    });
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Test Student" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "password123" },
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
      expect(screen.getByText("Welcome to Muwatta Academy!")).toBeInTheDocument(),
    );
  });
});
