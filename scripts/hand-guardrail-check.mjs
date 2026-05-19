#!/usr/bin/env node
// Stage 6 Hand UX Guardrail Check (task 11.3)
//
// Static grep-based checks that ensure Stage 6 hand work does not
// expand the legacy surface area:
//   (a) styles.css hand-related token count <= baseline
//   (b) shell.html hand token static markup count <= baseline
//   (c) src/hand/ new code has 0 imperative DOM queries (excluding comments)
//
// Exit code 0 = all pass, non-zero = violation (stderr has details).

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

let failures = 0;

function fail(id, message) {
  failures++;
  process.stderr.write(`FAIL [${id}]: ${message}\n`);
}

// Load baseline
const baselinePath = resolve(ROOT, ".kiro/specs/stage6-hand-ux-improvement/baseline.json");
let baseline;
try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch (e) {
  fail("baseline-load", `Cannot read baseline.json: ${e.message}`);
  process.exit(1);
}

// ─── (a) styles.css hand token count ──────────────────────────────────────

const stylesCssPath = resolve(ROOT, "discord_activity_skullking/app/styles.css");
try {
  const css = readFileSync(stylesCssPath, "utf8");
  const matches = css.match(/hand/gi) || [];
  const count = matches.length;
  if (count > baseline.styles_css_hand_token_count) {
    fail(
      "styles-css-hand-selectors",
      `styles.css has ${count} hand tokens (baseline: ${baseline.styles_css_hand_token_count}). Stage 6 must not add hand selectors to global styles.css.`
    );
  }
} catch (e) {
  fail("styles-css-read", `Cannot read styles.css: ${e.message}`);
}

// ─── (b) shell.html hand token count ─────────────────────────────────────

const shellHtmlPath = resolve(ROOT, "discord_activity_skullking/app/src/shell.html");
try {
  const html = readFileSync(shellHtmlPath, "utf8");
  const matches = html.match(/hand/gi) || [];
  const count = matches.length;
  if (count > baseline.shell_html_hand_token_count) {
    fail(
      "shell-html-hand-markup",
      `shell.html has ${count} hand tokens (baseline: ${baseline.shell_html_hand_token_count}). Stage 6 must not add hand static markup.`
    );
  }
} catch (e) {
  fail("shell-html-read", `Cannot read shell.html: ${e.message}`);
}

// ─── (c) src/hand/ imperative DOM queries (code only, not comments) ───────

import { readdirSync } from "node:fs";

const handDir = resolve(ROOT, "discord_activity_skullking/app/src/hand");
const DOM_QUERY_RE = /^\s*(?!\/\/|\/\*|\*).*document\.(querySelector|getElementById|getElementsByClassName|querySelectorAll)\s*\(/;

let domQueryCount = 0;
const violations = [];

function scanFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (DOM_QUERY_RE.test(lines[i])) {
      domQueryCount++;
      violations.push(`${filePath}:${i + 1}: ${lines[i].trim()}`);
    }
  }
}

function scanDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip __tests__ directory - test files may legitimately use DOM queries
      if (entry.name === "__tests__") continue;
      scanDir(fullPath);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      scanFile(fullPath);
    }
  }
}

try {
  scanDir(handDir);
  if (domQueryCount > baseline.src_hand_imperative_dom_queries) {
    fail(
      "hand-imperative-dom",
      `src/hand/ has ${domQueryCount} imperative DOM queries (baseline: ${baseline.src_hand_imperative_dom_queries}).\nViolations:\n${violations.join("\n")}`
    );
  }
} catch (e) {
  fail("hand-dir-scan", `Cannot scan src/hand/: ${e.message}`);
}

// ─── Summary ──────────────────────────────────────────────────────────────

if (failures > 0) {
  process.stderr.write(`\n${failures} guardrail check(s) FAILED\n`);
  process.exit(1);
} else {
  process.stdout.write("All guardrail checks passed ✓\n");
  process.exit(0);
}
