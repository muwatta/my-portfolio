import { useEffect, useRef, useState } from "react";
import {
  isTurnstileRequired,
  TURNSTILE_SITE_KEY,
} from "../../lib/turnstile";

let turnstileScriptPromise;

function loadTurnstile() {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector("script[data-turnstile-script]");
    const handleLoad = () => {
      if (window.turnstile?.render) {
        resolve(window.turnstile);
      } else {
        turnstileScriptPromise = null;
        script?.remove();
        reject(new Error("Turnstile did not initialize."));
      }
    };
    const handleError = () => {
      turnstileScriptPromise = null;
      script?.remove();
      reject(new Error("Turnstile could not be loaded."));
    };

    if (!script) {
      script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = "true";
    }
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!script.isConnected) document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export default function TurnstileChallenge({ onToken, resetSignal = 0 }) {
  const container = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;
    let widgetId;
    onToken("");

    if (!TURNSTILE_SITE_KEY) {
      setStatus(import.meta.env.PROD ? "missing-key" : "disabled");
      return () => {
        mounted = false;
      };
    }

    setStatus("loading");
    loadTurnstile()
      .then((turnstile) => {
        if (!mounted || !container.current) return;
        widgetId = turnstile.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "auto",
          callback: (token) => {
            onToken(token);
            setStatus("ready");
          },
          "expired-callback": () => {
            onToken("");
            setStatus("expired");
          },
          "error-callback": () => {
            onToken("");
            setStatus("error");
          },
        });
      })
      .catch(() => {
        if (!mounted) return;
        onToken("");
        setStatus("error");
      });

    return () => {
      mounted = false;
      if (widgetId !== undefined && window.turnstile?.remove) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [onToken, resetSignal]);

  if (!isTurnstileRequired) return null;

  return (
    <div className="space-y-2" aria-live="polite">
      <div ref={container} />
      {status === "loading" && (
        <p className="text-xs text-slate-500">Loading security check...</p>
      )}
      {status === "missing-key" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          Security verification is not configured. Please try again later.
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          Security verification could not load. Check your connection and try
          again.
        </p>
      )}
      {status === "expired" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          The security check expired. Please complete it again.
        </p>
      )}
    </div>
  );
}
