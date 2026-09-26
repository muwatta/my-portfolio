import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ current: {} }));

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => authState.current,
}));

import AcademyAdminGuard from "../components/academy/AcademyAdminGuard";
import AcademyStudentGuard from "../components/academy/AcademyStudentGuard";

function AdminPage() {
  return <p>Admin students page</p>;
}
function StudentPage() {
  return <p>Student dashboard</p>;
}
function AdminOverview() {
  return <p>Admin overview</p>;
}

describe("Academy route guards", () => {
  beforeEach(() => {
    authState.current = {};
  });

  it("keeps an admin on the page they refreshed", async () => {
    // First render: session restored but the profile has not resolved yet.
    // This is the exact frame that used to bounce the user away.
    authState.current = { initializing: true, isAdmin: false, isTeacher: false };

    const { rerender } = render(
      <MemoryRouter initialEntries={["/academy/admin/students"]}>
        <Routes>
          <Route
            path="/academy/admin"
            element={
              <AcademyAdminGuard>
                <Outlet />
              </AcademyAdminGuard>
            }
          >
            <Route path="/academy/admin/students" element={<AdminPage />} />
            <Route path="/academy/admin" element={<AdminOverview />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Admin students page")).toBeNull();

    authState.current = { initializing: false, isAdmin: true, isTeacher: false };
    rerender(
      <MemoryRouter initialEntries={["/academy/admin/students"]}>
        <Routes>
          <Route
            path="/academy/admin"
            element={
              <AcademyAdminGuard>
                <Outlet />
              </AcademyAdminGuard>
            }
          >
            <Route path="/academy/admin/students" element={<AdminPage />} />
            <Route path="/academy/admin" element={<AdminOverview />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("Admin students page")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Admin overview")).toBeNull();
  });

  it("sends a teacher to the teacher area instead of looping through admin", async () => {
    authState.current = {
      initializing: false,
      isAdmin: false,
      isTeacher: true,
    };

    render(
      <MemoryRouter initialEntries={["/academy/dashboard"]}>
        <Routes>
          <Route
            path="/academy/dashboard"
            element={
              <AcademyStudentGuard>
                <Outlet />
              </AcademyStudentGuard>
            }
          >
            <Route path="/academy/dashboard" element={<StudentPage />} />
          </Route>
          <Route path="/academy/teacher" element={<p>Teacher home</p>} />
          <Route path="/academy/admin" element={<AdminOverview />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Teacher home")).toBeInTheDocument());
    expect(screen.queryByText("Admin overview")).toBeNull();
  });
});
