#!/usr/bin/env node
/* global __dirname */

/**
 * check-legacy-shim.js
 *
 * CI guard for the NANO_GPT_* backward-compat shim. Reads the deprecation
 * date from backend/src/config/aiShim.ts (the single source of truth).
 * If today is past the deprecation date AND the shim file still exists,
 * exits 1 with a clear message pointing to docs/MIGRATION.md.
 *
 * Override the deprecation date for testing:
 *   AI_LEGACY_SHIM_OVERRIDE_DATE=2020-01-01 node scripts/check-legacy-shim.js
 *
 * Exits:
 *   0 — shim is still in its support window
 *   1 — shim has expired and must be removed
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHIM_PATH = path.join(REPO_ROOT, 'backend', 'src', 'config', 'aiShim.ts');
const DEPRECATION_REGEX =
    /AI_LEGACY_SHIM_DEPRECATION_DATE\s*=\s*['"]([^'"]+)['"]/;

function loadDeprecationDate() {
    const override = process.env.AI_LEGACY_SHIM_OVERRIDE_DATE;
    if (override) return override;

    if (!fs.existsSync(SHIM_PATH)) {
        process.stderr.write(
            `check-legacy-shim: shim file not found at ${SHIM_PATH}. ` +
                `If you have already removed the shim, this script is no longer needed.\n`
        );
        process.exit(0);
    }

    const content = fs.readFileSync(SHIM_PATH, 'utf-8');
    const match = content.match(DEPRECATION_REGEX);
    if (!match) {
        process.stderr.write(
            `check-legacy-shim: could not find AI_LEGACY_SHIM_DEPRECATION_DATE in ${SHIM_PATH}\n`
        );
        process.exit(2);
    }
    return match[1];
}

function main() {
    const deprecationDate = loadDeprecationDate();
    const deadline = new Date(deprecationDate);

    if (Number.isNaN(deadline.getTime())) {
        process.stderr.write(
            `check-legacy-shim: invalid deprecation date "${deprecationDate}"\n`
        );
        process.exit(2);
    }

    const shimStillPresent = fs.existsSync(SHIM_PATH);
    const now = new Date();

    if (shimStillPresent && now > deadline) {
        process.stderr.write(
            `The NANO_GPT_* backward-compat shim expired on ${deprecationDate}. ` +
                `Remove ${path.relative(REPO_ROOT, SHIM_PATH)} and the NANO_GPT_* ` +
                `section from .env.example. See docs/MIGRATION.md for the upgrade runbook.\n`
        );
        process.exit(1);
    }
    process.exit(0);
}

main();
