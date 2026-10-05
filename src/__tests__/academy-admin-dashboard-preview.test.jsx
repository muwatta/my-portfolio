import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAcademyAdminOverview } from "../lib/academy";

vi.mock("../lib/academy", () => ({
  getAcademyAdminOverview: vi.fn().mockResolvedValue({
    data: {
      students: 8,
      courses: 2,
      activeLearners: 3,
      verifiedPoints: 120,
      learningSeconds: 3600,
      pendingSubmissions: 1,
      overdueAssignments: 0,
    },
    error: null,
  }),
}));

vi.mock("../hooks/useAutoRefresh", () => ({
  useAutoRefresh: (callback) => {
    useEffect(() => {
      callback();
    }, [callback]);
  },
}));

import AcademyAdminDashboard from "../pages/AcademyAdminDashboard";

afterEach(() => {
  vi.clearAllMocks();
});

describe("admin course preview shortcuts", () => {
  it("links directly to both learner-style course previews", async () => {
    render(
      <MemoryRouter>
        <AcademyAdminDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /see what students see/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: /python for young innovators/i }),
    ).toHaveAttribute(
      "href",
      "/academy/admin/previews/python-for-ai-machine-learning",
    );
    expect(
      screen.getByRole("link", { name: /c\+\+ for embedded systems & robotics/i }),
    ).toHaveAttribute(
      "href",
      "/academy/admin/previews/cpp-embedded-robotics",
    );
  });

  it("keeps course previews available if the admin metrics fail", async () => {
    getAcademyAdminOverview.mockResolvedValueOnce({
      data: null,
      error: new Error("Metrics unavailable"),
    });

    render(
      <MemoryRouter>
        <AcademyAdminDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /admin data could not be loaded/i,
    );
    expect(
      screen.getByRole("link", { name: /python for young innovators/i }),
    ).toHaveAttribute(
      "href",
      "/academy/admin/previews/python-for-ai-machine-learning",
    );
  });
});
