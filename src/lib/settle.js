// Turns a rejection into a value, so one failing request cannot take a whole
// page with it.
//
// The failure this exists for: a page loads several things with Promise.all, one
// of them rejects, setState never runs, and the page sits on its loading state
// for ever showing nothing and reporting nothing. It looks like a blank page
// that a refresh happens to fix, and it is not a rendering bug at all.
//
// Two shapes, because both come up:
//
//   settle(() => getSomething(), [])   one call
//   settleAll([() => a(), () => b()])  several, each independently

export async function settle(run, fallback = null) {
  try {
    return await run();
  } catch (thrown) {
    return { data: fallback, error: thrown };
  }
}

export async function settleAll(runs, fallback = null) {
  return Promise.all(runs.map((run) => settle(run, fallback)));
}

// True when any part of a settleAll failed, so a page can say so rather than
// quietly showing an empty list.
export function anyFailed(results) {
  return results.some((result) => result?.error);
}
