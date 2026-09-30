import { Component } from "react";

// Without this, a single throw while rendering unmounts the whole tree and the
// student gets a blank page and no message at all. The report was exactly that:
// pages that "load and show nothing and throw no error until I refreshed".
//
// React unmounts the entire tree on an uncaught render error, so there is no
// partial page to fall back on and no way for the person looking at it to tell a
// bug from an empty screen. This is the difference between "something went
// wrong, here is what, try again" and nothing.
//
// It resets when the route changes, so navigating away from a broken page does
// not leave the error on screen.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Kept in the console as well, because a teacher reporting "the page is
    // blank" needs something to send.
    console.error("Page failed to render:", error, info?.componentStack);
  }

  componentDidUpdate(previousProps) {
    // A new page is a new chance. Without this, one broken page would follow
    // the student around the whole app.
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, info: null });
    }
  }

  reset() {
    this.setState({ error: null, info: null });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 dark:border-rose-900 dark:bg-slate-900">
          <h1 className="text-xl font-bold text-rose-700 dark:text-rose-300">
            This page could not be shown
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Something went wrong while drawing it. Your work is not lost. Try
            again, and if it keeps happening tell your teacher what the page was.
          </p>

          <details className="mt-4 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
            <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
              Details for whoever is fixing this
            </summary>
            <p className="mt-2 break-words font-mono text-slate-600 dark:text-slate-300">
              {String(error?.message ?? error)}
            </p>
            {info?.componentStack && (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-slate-500 dark:text-slate-400">
                {info.componentStack}
              </pre>
            )}
          </details>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                this.reset();
                // A reload is the difference between "retry" that reruns the
                // fetch and "retry" that re-renders the same broken data.
                window.location.reload();
              }}
            >
              Reload this page
            </button>
            <a
              className="button-secondary"
              href="/academy"
              onClick={() => this.reset()}
            >
              Back to your dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
