import { useEffect, useState, useCallback, useRef } from "react";
import { FaDownload } from "react-icons/fa";

const STORAGE_KEY = "muwatta_pwa_dismiss";
const DISMISS_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

function useBeforeInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      // Clear dismiss storage on successful install
      localStorage.removeItem(STORAGE_KEY);
      trackEvent("pwa_installed");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return { deferredPrompt, isInstalled };
}

function isDismissed() {
  const dismissed = localStorage.getItem(STORAGE_KEY);
  if (!dismissed) return false;

  const dismissedTime = parseInt(dismissed, 10);
  const now = Date.now();

  // Dismiss window expired, allow showing again
  if (now - dismissedTime > DISMISS_DURATION) {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }

  return true;
}

function setDismissed() {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

function trackEvent(eventName, data = {}) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, data);
  }
}

export function PWAInstallPrompt({
  title = "Install Muwatta Academy",
  subtitle = "Learn offline with downloaded content",
  installText = "Install",
  dismissText = "Dismiss",
  onInstallStart = null,
  onInstallSuccess = null,
  onInstallError = null,
}) {
  const { deferredPrompt, isInstalled } = useBeforeInstallPrompt();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const promptShownRef = useRef(false);

  // Only show prompt once per session if not dismissed
  useEffect(() => {
    if (
      isInstalled ||
      !deferredPrompt ||
      isDismissed() ||
      promptShownRef.current
    ) {
      return;
    }

    promptShownRef.current = true;
    setShowPrompt(true);
    trackEvent("pwa_prompt_shown");
  }, [deferredPrompt, isInstalled]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      setIsInstalling(true);
      onInstallStart?.();
      trackEvent("pwa_install_clicked");

      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        trackEvent("pwa_install_accepted");
        onInstallSuccess?.();
      } else {
        trackEvent("pwa_install_dismissed");
      }

      setShowPrompt(false);
    } catch (error) {
      console.error("PWA install failed:", error);
      trackEvent("pwa_install_error", { error: error.message });
      onInstallError?.(error);
    } finally {
      setIsInstalling(false);
    }
  }, [deferredPrompt, onInstallStart, onInstallSuccess, onInstallError]);

  const handleDismiss = useCallback(() => {
    setDismissed();
    setShowPrompt(false);
    trackEvent("pwa_prompt_dismissed");
  }, []);

  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-40 max-w-sm animate-slideUp md:bottom-6 md:left-6 md:right-auto">
      <div className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 p-4 shadow-xl">
        <div className="flex gap-4">
          {/* Icon and Content */}
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="mt-1 shrink-0 text-lg text-white">
              <FaDownload aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">{title}</p>
              <p className="text-xs text-blue-100">{subtitle}</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex shrink-0 gap-2">
            <button
              onClick={handleDismiss}
              disabled={isInstalling}
              className="rounded px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50 active:bg-blue-200"
              aria-label={dismissText}
            >
              {dismissText}
            </button>
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="rounded bg-white px-3 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-gray-100 disabled:opacity-50 active:bg-gray-200"
              aria-label={installText}
              aria-busy={isInstalling}
            >
              {isInstalling ? "Installing..." : installText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PWAInstallPrompt;
