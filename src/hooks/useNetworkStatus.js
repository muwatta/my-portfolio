import { useEffect, useState } from "react";

const SLOW_TYPES = new Set(["slow-2g", "2g", "3g"]);

const initialState = () => {
  if (typeof navigator === "undefined") {
    return { online: true, slow: false, effectiveType: null, checkedAt: null };
  }
  const connection = navigator.connection;
  return {
    online: navigator.onLine,
    slow: Boolean(
      connection &&
        (SLOW_TYPES.has(connection.effectiveType) || connection.saveData),
    ),
    effectiveType: connection?.effectiveType ?? null,
    checkedAt: null,
  };
};

export function useNetworkStatus() {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    const update = () => {
      setState((current) => ({
        ...current,
        online: navigator.onLine,
        slow: Boolean(
          navigator.connection &&
            (SLOW_TYPES.has(navigator.connection.effectiveType) ||
              navigator.connection.saveData),
        ),
        effectiveType: navigator.connection?.effectiveType ?? null,
        checkedAt: new Date().toISOString(),
      }));
    };

    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    const connection = navigator.connection;
    if (connection) {
      connection.addEventListener?.("change", update);
    }

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      connection?.removeEventListener?.("change", update);
    };
  }, []);

  return state;
}
