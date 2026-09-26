import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ current: {} }));

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => authState.current,
}));

import AcademyLoadingScreen from "../components/academy/AcademyLoadingScreen";
import AcademyAdminGuard from "../components/academy/AcademyAdminGuard";
import AcademyStudentGuard from "../components/academy/AcademyStudentGuard";

function renderGuard(guard) {
  return render(
    <MemoryRouter initialEntries={["/academy/admin"]}>
      {guard}
    </MemoryRouter>,
  );
}

describe("Academy loading experience", () => {
  it("shows an accessible loading status instead of plain text", () => {
    render(<AcademyLoadingScreen title="Checking administrator access" subtitle="Verifying your Academy permissions" />);

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent("Checking administrator access");
    expect(status).toHaveTextContent("Verifying your Academy permissions");
  });

  it("uses the animated screen while the admin guard resolves access", () => {
    authState.current = { initializing: true, isAdmin: false, isTeacher: false };
    renderGuard(<AcademyAdminGuard />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking administrator access",
    );
  });

  it("uses a student-specific screen while student access resolves", () => {
    authState.current = { initializing: true, isAdmin: false, isTeacher: false };
    renderGuard(<AcademyStudentGuard />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Opening your learning space",
    );
  });
});
