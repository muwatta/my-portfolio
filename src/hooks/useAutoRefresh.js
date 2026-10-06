import { useEffect, useRef } from "react";

export const DEFAULT_REFRESH_INTERVAL = 60000;

// A background refresh must not fight the reader. Two things follow from that.
//
// Returning to the tab used to refresh twice, because visibilitychange and
// focus both fire, and each refetch replaced the page state and threw away
// wherever the reader had scrolled to. That is off by default now, and a page
// that genuinely wants it has to say so and still only refreshes once.
//
// A refresh that does happen restores the scroll position, unless the reader
// scrolled while it was in flight, because then they meant to move and putting
// them back would be worse than the jump.

const EDITABLE = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const FOCUS_COOLDOWN_MS = 2000;

function isUserEditing() {
  const active = document.activeElement;
  return Boolean(active && EDITABLE.has(active.tagName));
}

export function useAutoRefresh(load, options = {}) {
  const settings =
    typeof options === "number"
      ? { interval: options }
      : {
          interval: DEFAULT_REFRESH_INTERVAL,
          refreshOnFocus: false,
          preserveScroll: true,
          ...options,
        };
  const { interval, refreshOnFocus, preserveScroll } = settings;

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let timer = null;
    let stopped = false;
    let lastFocusRun = 0;
    let windowBlurred = false;

    const restoreScroll = (from) => {
      if (!preserveScroll || from == null) return;
      // Only put the reader back if they have not scrolled themselves in the
      // meantime, otherwise we would undo their movement.
      const moved = window.scrollY !== from;
      if (!moved) return;
      requestAnimationFrame(() => {
        if (!stopped) window.scrollTo({ top: from, behavior: "instant" });
      });
    };

    const run = async (background) => {
      if (stopped) return;
      if (document.visibilityState === "hidden") return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (background && isUserEditing()) return;

      const from = preserveScroll ? window.scrollY : null;
      try {
        await loadRef.current(background);
        if (background) restoreScroll(from);
      } catch {
        // A failed background refresh is not worth interrupting anyone over.
      }
    };

    const stopTimer = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const startTimer = () => {
      stopTimer();
      if (document.visibilityState === "hidden") return;
      if (windowBlurred) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      timer = window.setInterval(() => run(true), interval);
    };

    // Both visibilitychange and focus fire when you come back to a tab. Without
    // the cooldown that is two refetches for one return.
    const onReturn = (event) => {
      if (event.type === "focus") windowBlurred = false;
      if (document.visibilityState === "hidden") {
        stopTimer();
        return;
      }
      startTimer();
      if (!refreshOnFocus) return;
      const now = Date.now();
      if (now - lastFocusRun < FOCUS_COOLDOWN_MS) return;
      lastFocusRun = now;
      void run(true);
    };

    const onBlur = () => {
      windowBlurred = true;
      stopTimer();
    };

    void run(false);
    startTimer();
    window.addEventListener("focus", onReturn);
    window.addEventListener("blur", onBlur);
    window.addEventListener("online", startTimer);
    document.addEventListener("visibilitychange", onReturn);

    return () => {
      stopped = true;
      stopTimer();
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("online", startTimer);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [interval, refreshOnFocus, preserveScroll]);
}
