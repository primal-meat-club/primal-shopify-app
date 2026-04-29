#!/usr/bin/env node
/**
 * Build-time env-var guard.
 *
 * Fails the Vercel build when required env vars are missing instead of
 * letting the build succeed and then crashing the first runtime request
 * with FUNCTION_INVOCATION_FAILED. (We hit exactly that on Apr 28, 2026
 * when SUPABASE_URL etc. were missing from Vercel's prod env — the build
 * succeeded silently and every Shopify Admin embed click 500'd.)
 *
 * Skipped during local dev (`shopify app dev` proxies env vars from
 * .env), in test environments, and when SKIP_ENV_CHECK=1 is set
 * explicitly.
 */

const REQUIRED = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_URL",
  "SCOPES",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  // BACKEND_URL is consumed by app routes that proxy to the FastAPI
  // backend. Missing it produces runtime fetch failures, not build
  // failures (per Gemini review on PR #9).
  "BACKEND_URL",
];

const SKIP_REASONS = [];
if (process.env.SKIP_ENV_CHECK === "1") {
  SKIP_REASONS.push("SKIP_ENV_CHECK=1 explicitly set");
}
if (process.env.NODE_ENV === "test") {
  SKIP_REASONS.push("NODE_ENV=test");
}
// Local dev — `shopify app dev` runs the server from source, not via
// `npm run build`. If anyone DOES run `npm run build` locally, they
// presumably want the same guard, so don't skip on dev.

if (SKIP_REASONS.length > 0) {
  console.log(
    `[check-env] Skipping (${SKIP_REASONS.join(", ")})`,
  );
  process.exit(0);
}

const missing = REQUIRED.filter((name) => {
  const v = process.env[name];
  // Treat whitespace-only as missing — common Vercel-dashboard mishap
  // when copy-pasting values picks up a trailing newline or space and
  // the runtime check then accepts a blank string. (Gemini review.)
  return v === undefined || v.trim() === "";
});

if (missing.length > 0) {
  console.error("");
  console.error("✗ Build aborted — required env vars missing:");
  for (const name of missing) {
    console.error(`    - ${name}`);
  }
  console.error("");
  console.error(
    "  Set these in Vercel Project Settings → Environment Variables for the",
  );
  console.error(
    "  target environment (production/preview), then redeploy.",
  );
  console.error("");
  console.error(
    "  To bypass this check (e.g. for an isolated build experiment), set",
  );
  console.error("  SKIP_ENV_CHECK=1 in the build env.");
  console.error("");
  process.exit(1);
}

console.log(
  `[check-env] All ${REQUIRED.length} required vars present — proceeding with build.`,
);
