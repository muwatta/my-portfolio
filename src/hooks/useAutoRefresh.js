import { useEffect, useRef } from "react";

export const DEFAULT_REFRESH_INTERVAL = 60000;

const EDITABLE = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isUserEditing() {
  const active = document.activeElement;
  return Boolean(active && EDITABLE.has(active.tagName));
}

export function useAutoRefresh(load, interval = DEFAULT_REFRESH_INTERVAL) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let timer = null;
    let stopped = false;

    const run = (background) => {
      if (stopped) return;
      if (document.visibilityState === "hidden") return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (background && isUserEditing()) return;
      void loadRef.current(background);
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
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      timer = window.setInterval(() => run(true), interval);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        run(true);
        startTimer();
      } else {
        stopTimer();
      }
    };

    run(false);
    startTimer();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", startTimer);
    document.addEventListener("visibilitychange", onVisibilityChange);

    function onFocus() {
      run(true);
    }

    return () => {
      stopped = true;
      stopTimer();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", startTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [interval]);
}
