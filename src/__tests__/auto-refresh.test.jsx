import { readFileSync } from "node:fs";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

function Harness({ load, refreshOnFocus }) {
  useAutoRefresh(load, { interval: 1000, refreshOnFocus, preserveScroll: false });
  return null;
}

describe("useAutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads once on mount, then polls in the background", () => {
    const load = vi.fn();
    render(<Harness load={load} />);

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenLastCalledWith(false);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(load).toHaveBeenCalledTimes(4);
    expect(load).toHaveBeenLastCalledWith(true);
  });

  it("does not refresh when the tab regains focus or visibility", () => {
    // This is the behaviour that made the dashboards unusable: coming back from
    // another tab replaced the page and threw away the reader's place.
    const load = vi.fn();
    render(<Harness load={load} />);
    const initial = load.mock.calls.length;

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(load.mock.calls.length).toBe(initial);
  });

  it("refreshes at most once when focus and visibility both fire", () => {
    const load = vi.fn();
    render(<Harness load={load} refreshOnFocus />);
    const initial = load.mock.calls.length;

    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(load.mock.calls.length).toBe(initial + 1);
  });

  it("resumes polling once the tab is visible again, without an extra refresh", () => {
    const load = vi.fn();
    render(<Harness load={load} />);
    const initial = load.mock.calls.length;

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(load.mock.calls.length).toBe(initial);

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(load.mock.calls.length).toBeGreaterThan(initial);
  });


  it("skips a background poll while the user is typing in a field", () => {
    const load = vi.fn();
    render(<Harness load={load} />);
    const initial = load.mock.calls.length;

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(load).toHaveBeenCalledTimes(initial);

    input.remove();
  });

  it("still runs the initial load even while a field has focus", () => {
    const load = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    render(<Harness load={load} />);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(false);

    input.remove();
  });

  it("does not poll while offline and resumes on reconnect", () => {
    const load = vi.fn();
    render(<Harness load={load} />);
    const initial = load.mock.calls.length;

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(load).toHaveBeenCalledTimes(initial);

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: true,
      });
      window.dispatchEvent(new Event("online"));
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(load.mock.calls.length).toBeGreaterThan(initial);
  });
});

describe("refresh controls on the dashboards", () => {
  it("offer a manual refresh instead of relying on tab focus", () => {
    const dashboards = [
      "src/pages/AcademyAdminDashboard.jsx",
      "src/pages/AcademyTeacherDashboard.jsx",
    ];
    dashboards.forEach((file) => {
      const source = readFileSync(file, "utf8");
      expect(source).toMatch(/RefreshControl/);
      // Two minutes, not the old one minute, and never on return.
      expect(source).toMatch(/interval: 120000/);
      expect(source).not.toMatch(/useAutoRefresh\(load\)/);
    });
  });
});
