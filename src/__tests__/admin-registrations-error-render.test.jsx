import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAcademyRegistrationCodes = vi.fn();
const getAcademyTeacherStudents = vi.fn();
const generateAcademyRegistrationCodes = vi.fn();
const assignAcademyRegistrationCode = vi.fn();
const reassignAcademyRegistrationCode = vi.fn();
const suspendAcademyRegistrationCode = vi.fn();

vi.mock("../lib/academy", () => ({
  getAcademyRegistrationCodes: (...args) => getAcademyRegistrationCodes(...args),
  getAcademyTeacherStudents: (...args) => getAcademyTeacherStudents(...args),
  generateAcademyRegistrationCodes: (...args) => generateAcademyRegistrationCodes(...args),
  assignAcademyRegistrationCode: (...args) => assignAcademyRegistrationCode(...args),
  reassignAcademyRegistrationCode: (...args) => reassignAcademyRegistrationCode(...args),
  suspendAcademyRegistrationCode: (...args) => suspendAcademyRegistrationCode(...args),
}));

import AcademyAdminRegistrations from "../pages/AcademyAdminRegistrations";

const postgrestError = {
  code: "P0001",
  details: null,
  hint: null,
  message: "Only Academy administrators can view registration numbers.",
};

describe("AcademyAdminRegistrations", () => {
  beforeEach(() => {
    getAcademyRegistrationCodes.mockReset();
    getAcademyTeacherStudents.mockReset();
  });

  it("renders a Supabase failure as readable text instead of crashing", async () => {
    getAcademyRegistrationCodes.mockResolvedValue({
      data: null,
      error: postgrestError,
      configured: true,
    });
    getAcademyTeacherStudents.mockResolvedValue({
      data: { students: [], levels: [] },
      error: null,
      configured: true,
    });

    render(
      <MemoryRouter>
        <AcademyAdminRegistrations />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").length,
      ).toBeGreaterThan(0),
    );
    const alert = document.querySelector('[role="alert"]');
    expect(alert.textContent).toBe(
      "Only Academy administrators can view registration numbers.",
    );
    expect(alert.textContent).not.toContain("[object Object]");
  });

  it("opens the suspension form from the registration directory", async () => {
    getAcademyRegistrationCodes.mockResolvedValue({
      data: [
        {
          registration_number: "ATE-2026-001",
          status: "claimed",
          student_id: "student-1",
          student_name: "A Student",
          student_email: "student@example.com",
          course_title: "C++",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    getAcademyTeacherStudents.mockResolvedValue({
      data: { students: [], levels: [] },
      error: null,
    });

    render(
      <MemoryRouter>
        <AcademyAdminRegistrations />
      </MemoryRouter>,
    );

    const suspendButtons = await screen.findAllByRole("button", {
      name: "Suspend",
    });
    fireEvent.click(suspendButtons[0]);

    expect(
      screen.getByRole("heading", { name: "Suspend ATE-2026-001" }),
    ).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Reason" })).toBeTruthy();
  });
});
