// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const authState = vi.hoisted(() => ({ current: null }));

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => authState.current,
}));

vi.mock("../context/useTheme", () => ({
  useTheme: () => ({ theme: "light", toggle: vi.fn() }),
}));

import AcademyHome from "../pages/AcademyHome";

const dashboardNames = {
  "/academy/dashboard": "Student dashboard",
  "/academy/teacher": "Teacher dashboard",
  "/academy/admin": "Admin dashboard",
};

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/academy"]}>
      <Routes>
        <Route path="/academy" element={<AcademyHome />} />
        {Object.entries(dashboardNames).map(([path, name]) => (
          <Route key={path} path={path} element={<p>{name}</p>} />
        ))}
      </Routes>
    </MemoryRouter>,
  );
}

describe("Academy landing-page session routing", () => {
  beforeEach(() => {
    authState.current = {
      initializing: false,
      user: { id: "signed-in-user" },
      isAdmin: false,
      isTeacher: false,
    };
  });

  it.each([
    ["/academy/dashboard", "Student dashboard"],
    ["/academy/teacher", "Teacher dashboard", { isTeacher: true }],
    ["/academy/admin", "Admin dashboard", { isAdmin: true }],
  ])("sends signed-in users to %s", async (path, name, role = {}) => {
    authState.current = { ...authState.current, ...role };

    renderHome();

    expect(await screen.findByText(name)).toBeInTheDocument();
  });
});
