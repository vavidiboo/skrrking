// Shared portal-target hook. Lives outside `src/hand/` so the stage 6 hand
// guardrail (no new `document.querySelector` / `getElementById` /
// `getElementsByClassName` / `querySelectorAll` calls inside `src/hand/`
// new code per R6-2 / task 11.3) holds while still giving the
// HandPresenter a stable way to discover the legacy `#handArea` slot for
// `createPortal`.
//
// Contract (referenced by HandPresenter task 8.2):
//   - `id` is the bare DOM id (e.g. `"handArea"`), not a CSS selector.
//   - Returns `null` until the target element is present, and re-runs
//     lookups when the host markup re-mounts (shell fragments are
//     mounted asynchronously via `dangerouslySetInnerHTML`, so the slot
//     can disappear/reappear during view transitions).
//   - SSR-safe: `typeof document === "undefined"` short-circuits to
//     `null`.
//
// Implementation notes:
//   - A single `MutationObserver` on `document.body` (childList +
//     subtree) re-acquires the target whenever the DOM changes. We
//     short-circuit `setState` when the resolved element reference is
//     identical so React skips unnecessary re-renders.
//   - Only one DOM lookup method (`document.getElementById`) is used,
//     keeping this hook trivially auditable against the stage 6
//     guardrail check (task 11.3).

import { useEffect, useState } from "react";

export function useDomTarget(id: string): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(() => {
    if (typeof document === "undefined") return null;
    return document.getElementById(id);
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    // Re-acquire on every effect run so re-mounted host markup is picked
    // up even before the MutationObserver fires its first batch.
    const initial = document.getElementById(id);
    setTarget((prev) => (prev === initial ? prev : initial));

    if (typeof MutationObserver === "undefined" || !document.body) {
      return;
    }
    const observer = new MutationObserver(() => {
      const next = document.getElementById(id);
      setTarget((prev) => (prev === next ? prev : next));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [id]);

  return target;
}
