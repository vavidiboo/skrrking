import { defineConfig } from "vitest/config";

// Stage 6 hand UX improvement test runner.
// Scope is intentionally narrow: only `src/hand/__tests__` so the wider legacy
// surface (legacy-app.js, shell.html, stage7 esbuild tests) is not pulled in.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: [
      "discord_activity_skullking/app/src/hand/__tests__/**/*.test.{ts,tsx}",
    ],
  },
});
