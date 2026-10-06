import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";

const PRELOAD_RELOAD_KEY = "vite-preload-reload";

function wasPreloadReloaded() {
  try {
    return sessionStorage.getItem(PRELOAD_RELOAD_KEY) === "1";
  } catch {
    return false;
  }
}

function markPreloadReload() {
  try {
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  if (wasPreloadReloaded() || !markPreloadReload()) return;
  window.location.reload();
});

if (wasPreloadReloaded()) {
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(PRELOAD_RELOAD_KEY);
    } catch {
      // Storage can be disabled; the preload handler remains guarded in memory.
    }
  }, 10000);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
);

// Register Service Worker for PWA support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("✓ Service Worker registered successfully");

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New service worker is ready, show update prompt
              showUpdatePrompt(registration);
            }
          });
        });
      })
      .catch((error) => {
        console.error("✗ Service Worker registration failed:", error);
      });
  });
}

// Show update prompt when new SW is available
function showUpdatePrompt(registration) {
  const message = document.createElement("div");
  message.className =
    "fixed bottom-4 left-4 right-4 max-w-sm bg-blue-600 text-white rounded-lg shadow-lg p-4 flex items-center justify-between gap-4 z-50";
  const label = document.createElement("span");
  label.textContent = "New version available!";
  const actions = document.createElement("div");
  actions.className = "flex gap-2";
  const dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.className =
    "text-sm px-3 py-1 rounded hover:bg-blue-700 transition-colors";
  dismissButton.textContent = "Dismiss";
  const updateButton = document.createElement("button");
  updateButton.type = "button";
  updateButton.className =
    "text-sm px-3 py-1 bg-white text-blue-600 rounded font-bold hover:bg-gray-100 transition-colors";
  updateButton.textContent = "Update";
  actions.append(dismissButton, updateButton);
  message.append(label, actions);

  document.body.appendChild(message);

  dismissButton.onclick = () => {
    message.remove();
  };

  updateButton.onclick = () => {
    // Tell the new SW to take over
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    message.remove();

    // Reload after SW activates
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  };

  // Auto-dismiss after 10 seconds if user doesn't interact
  setTimeout(() => {
    if (message.parentNode) message.remove();
  }, 10000);
}
