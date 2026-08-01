import fs from 'node:fs';

function decode(value) {
    return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function attribute(node, name) {
    return decode(node.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '');
}

function main(argv) {
    const xmlPath = argv[argv.indexOf('--xml') + 1];
    const text = argv[argv.indexOf('--text') + 1];
    if (!xmlPath || !text) throw new Error('--xml and --text are required.');
    const nodes = fs.readFileSync(xmlPath, 'utf8').match(/<node\b[^>]*\/?>(?:<\/node>)?/g) ?? [];
    const matches = nodes.filter((node) => attribute(node, 'text') === text && attribute(node, 'enabled') === 'true' && attribute(node, 'visible-to-user') !== 'false');
    if (matches.length !== 1) throw new Error(`Expected exactly one enabled node for ${JSON.stringify(text)}, found ${matches.length}.`);
    const bounds = attribute(matches[0], 'bounds').match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
    if (!bounds) throw new Error('Matched node has invalid bounds.');
    const [left, top, right, bottom] = bounds.slice(1).map(Number);
    process.stdout.write(`${JSON.stringify({ x: (left + right) / 2, y: (top + bottom) / 2 })}\n`);
}

try { main(process.argv.slice(2)); } catch (error) { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
