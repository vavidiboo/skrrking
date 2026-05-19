// Stage 6 hand UX module - environment flags hook (task 4.2).
//
// `useEnvironmentFlags` is the single, narrowly-scoped place inside
// `src/hand/` that is allowed to inspect the document/window directly. It
// derives two boolean flags that downstream hand modules consume so they
// never need to touch the DOM themselves:
//
//   - `compactViewport`  : 360 ≤ window.innerWidth < 768
//   - `performanceLite`  : `document.body.classList.contains("performance-lite")`
//
// Updates:
//   - `resize` listener (passive) drives `compactViewport`. A rAF coalesce
//     avoids repeated setState during a single resize gesture.
//   - `MutationObserver(document.body, { attributes: true,
//     attributeFilter: ["class"] })` drives `performanceLite`.
//
// Notes:
//   - SSR-safe: `typeof window === "undefined"` short-circuits to
//     `{ compactViewport: false, performanceLite: false }`.
//   - This file does NOT use any of the four DOM lookup methods banned by
//     the stage-6 guardrail. Only direct `document.body` /
//     `window.innerWidth` access is performed here.
//
// _Requirements: 2.5, 5.2, 5.3, 5.4, 5.5, 8.4_

import { useEffect, useState } from "react";

/**
 * Public shape returned by {@link useEnvironmentFlags}. Downstream hand
 * components depend on this exact key set.
 */
export interface EnvironmentFlags {
  /** True when 360 ≤ viewport width < 768 (compact phone-ish layout). */
  compactViewport: boolean;
  /** True when `<body>` carries the `performance-lite` opt-in class. */
  performanceLite: boolean;
}

const COMPACT_MIN_WIDTH = 360;
const COMPACT_MAX_WIDTH_EXCLUSIVE = 768;
const PERFORMANCE_LITE_CLASS = "performance-lite";

/**
 * SSR-safe initial flags. We never read `window` / `document` at module
 * top-level so this hook is safe to import during server rendering or
 * non-browser test environments.
 */
function readInitialFlags(): EnvironmentFlags {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { compactViewport: false, performanceLite: false };
  }
  const width = window.innerWidth;
  const compactViewport =
    width >= COMPACT_MIN_WIDTH && width < COMPACT_MAX_WIDTH_EXCLUSIVE;
  const performanceLite =
    document.body?.classList.contains(PERFORMANCE_LITE_CLASS) ?? false;
  return { compactViewport, performanceLite };
}

function computeCompactViewport(): boolean {
  if (typeof window === "undefined") return false;
  const width = window.innerWidth;
  return width >= COMPACT_MIN_WIDTH && width < COMPACT_MAX_WIDTH_EXCLUSIVE;
}

function computePerformanceLite(): boolean {
  if (typeof document === "undefined") return false;
  return document.body?.classList.contains(PERFORMANCE_LITE_CLASS) ?? false;
}

/**
 * React hook that returns the current environment flags and keeps them in
 * sync with viewport resizes (`resize`) and `<body>` class mutations
 * (`MutationObserver`). Both listeners are torn down in the effect cleanup.
 */
export function useEnvironmentFlags(): EnvironmentFlags {
  const [flags, setFlags] = useState<EnvironmentFlags>(readInitialFlags);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    let cancelled = false;
    let rafHandle: number | null = null;

    const applyFlags = (next: EnvironmentFlags): void => {
      if (cancelled) return;
      setFlags((prev) => {
        if (
          prev.compactViewport === next.compactViewport &&
          prev.performanceLite === next.performanceLite
        ) {
          return prev;
        }
        return next;
      });
    };

    const recompute = (): void => {
      applyFlags({
        compactViewport: computeCompactViewport(),
        performanceLite: computePerformanceLite(),
      });
    };

    // Sync once on mount in case the SSR-safe initial value diverged from
    // the live DOM (e.g. body class added before hydration completed).
    recompute();

    const handleResize = (): void => {
      if (typeof window.requestAnimationFrame !== "function") {
        recompute();
        return;
      }
      if (rafHandle !== null) return;
      rafHandle = window.requestAnimationFrame(() => {
        rafHandle = null;
        recompute();
      });
    };

    window.addEventListener("resize", handleResize, { passive: true });

    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined" && document.body) {
      observer = new MutationObserver(() => {
        // Body class is the only attribute we filter for; recompute both
        // flags so a single code path owns the diffing logic.
        recompute();
      });
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
      if (rafHandle !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };
  }, []);

  return flags;
}
