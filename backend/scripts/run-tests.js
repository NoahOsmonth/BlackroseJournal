/* global __dirname */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const patternArg = args.find((arg) => arg.startsWith('--testPathPattern='));
const pattern = patternArg ? patternArg.split('=')[1] : '';

function findTestFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findTestFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
            files.push(fullPath);
        }
    }
    return files;
}

const testFiles = findTestFiles(path.join(__dirname, '..', 'src'));
const filtered = pattern
    ? testFiles.filter((file) => file.includes(pattern) || path.basename(file).includes(pattern))
    : testFiles;

if (filtered.length === 0) {
    console.log(`No test files matched pattern: ${pattern || '(none)'}`);
    process.exit(0);
}

const proc = spawn(
    path.join(__dirname, '..', 'node_modules', '.bin', 'tsx'),
    ['--test', ...filtered],
    { stdio: 'inherit' }
);

proc.on('exit', (code) => {
    process.exit(code ?? 1);
});
