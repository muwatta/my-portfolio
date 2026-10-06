import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
const resendConfirmation = vi.fn();

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => ({
    user: null,
    loading: false,
    isConfigured: true,
    signIn,
    resendConfirmation,
  }),
}));

vi.mock("../context/useTheme", () => ({
  useTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));

import AcademyLogin from "../pages/AcademyLogin";

describe("Academy login confirmation resend", () => {
  beforeEach(() => {
    signIn.mockReset();
    resendConfirmation.mockReset();
  });

  it("allows a previous applicant to request a confirmation email", async () => {
    resendConfirmation.mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <AcademyLogin />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " Student@Example.com " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Resend confirmation email" }),
    );

    await waitFor(() => {
      expect(resendConfirmation).toHaveBeenCalledWith("student@example.com");
      expect(
        screen.getByRole("status"),
      ).toHaveTextContent(/If that address has an unconfirmed Academy account/);
    });
  });

  it("does not request an email for an invalid address", async () => {
    render(
      <MemoryRouter>
        <AcademyLogin />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Resend confirmation email" }),
    );

    expect(resendConfirmation).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a valid email address to request confirmation.",
    );
  });
});
