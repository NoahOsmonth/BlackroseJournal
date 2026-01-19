#!/usr/bin/env node

/**
 * check-design-limits.js
 *
 * Scans design/UI files (per AGENTS.md) and reports line counts.
 * - Fails if any file exceeds 500 lines (hard max)
 * - Warns if any file is >= 450 lines (approaching limit)
 * - Target range is 200–500 lines per AGENTS.md
 *
 * Design/UI file globs (from AGENTS.md):
 *   - app/**
 *   - components/**
 *   - components/ui/**
 *   - global.css
 *   - constants/theme.ts
 *   - theme/style helpers
 */

const fs = require('fs');
const path = require('path');

// Configuration
const HARD_MAX = 500;
const WARN_THRESHOLD = 450;
const TARGET_MIN = 200;
const TARGET_MAX = 500;

// Design/UI file patterns to scan (relative to project root)
const DESIGN_UI_PATTERNS = [
  { dir: 'app', extensions: ['.tsx', '.ts', '.jsx', '.js'] },
  { dir: 'components', extensions: ['.tsx', '.ts', '.jsx', '.js'] },
  { file: 'global.css' },
  { file: 'constants/theme.ts' }
];

// Find project root (where package.json is)
function findProjectRoot() {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

// Count lines in a file
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch (err) {
    console.error(`  Error reading ${filePath}: ${err.message}`);
    return 0;
  }
}

// Recursively get all files in a directory matching extensions
function getFilesInDir(dir, extensions) {
  const results = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      // Skip node_modules and hidden directories
      if (item.name === 'node_modules' || item.name.startsWith('.')) {
        continue;
      }
      results.push(...getFilesInDir(fullPath, extensions));
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

// Get all design/UI files to check
function getDesignFiles(projectRoot) {
  const files = [];

  for (const pattern of DESIGN_UI_PATTERNS) {
    if (pattern.file) {
      // Single file
      const filePath = path.join(projectRoot, pattern.file);
      if (fs.existsSync(filePath)) {
        files.push(filePath);
      }
    } else if (pattern.dir) {
      // Directory with extensions
      const dirPath = path.join(projectRoot, pattern.dir);
      files.push(...getFilesInDir(dirPath, pattern.extensions));
    }
  }

  // Remove duplicates
  return [...new Set(files)];
}

// Main execution
function main() {
  const projectRoot = findProjectRoot();
  console.log(`\n🔍 Checking design/UI file sizes in: ${projectRoot}\n`);
  console.log(`   Target: ${TARGET_MIN}–${TARGET_MAX} lines`);
  console.log(`   Warning threshold: >= ${WARN_THRESHOLD} lines`);
  console.log(`   Hard max: ${HARD_MAX} lines\n`);

  const files = getDesignFiles(projectRoot);
  const results = [];

  for (const file of files) {
    const lineCount = countLines(file);
    const relativePath = path.relative(projectRoot, file);
    results.push({ path: relativePath, lines: lineCount });
  }

  // Sort by line count descending
  results.sort((a, b) => b.lines - a.lines);

  const errors = [];
  const warnings = [];
  const ok = [];

  for (const result of results) {
    if (result.lines > HARD_MAX) {
      errors.push(result);
    } else if (result.lines >= WARN_THRESHOLD) {
      warnings.push(result);
    } else {
      ok.push(result);
    }
  }

  // Print results
  if (errors.length > 0) {
    console.log('❌ EXCEEDS LIMIT (> 500 lines):');
    for (const item of errors) {
      console.log(`   ${item.lines.toString().padStart(4)} lines  ${item.path}`);
    }
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  APPROACHING LIMIT (>= 450 lines):');
    for (const item of warnings) {
      console.log(`   ${item.lines.toString().padStart(4)} lines  ${item.path}`);
    }
    console.log('');
  }

  if (ok.length > 0) {
    console.log(`✅ OK (${ok.length} files within limits):`);
    // Show top 10 largest OK files for visibility
    const top = ok.slice(0, 10);
    for (const item of top) {
      console.log(`   ${item.lines.toString().padStart(4)} lines  ${item.path}`);
    }
    if (ok.length > 10) {
      console.log(`   ... and ${ok.length - 10} more files`);
    }
    console.log('');
  }

  // Summary
  console.log('─'.repeat(50));
  console.log(`📊 Summary: ${results.length} files scanned`);
  console.log(`   ❌ Errors:   ${errors.length}`);
  console.log(`   ⚠️  Warnings: ${warnings.length}`);
  console.log(`   ✅ OK:       ${ok.length}`);
  console.log('');

  // Exit with error code if any files exceed limit
  if (errors.length > 0) {
    console.log('💥 FAILED: Some design/UI files exceed the 500-line limit.\n');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('⚡ PASSED with warnings: Consider splitting large files soon.\n');
    process.exit(0);
  } else {
    console.log('🎉 PASSED: All design/UI files are within limits.\n');
    process.exit(0);
  }
}

main();
