import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

function Harness({ load }) {
  useAutoRefresh(load, 1000);
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

  it("stops polling while the tab is hidden and refreshes when it returns", () => {
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
    expect(load).toHaveBeenCalledTimes(initial);

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(load.mock.calls.length).toBe(initial + 1);
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
