import crypto from 'node:crypto';

const args = process.argv.slice(2);
const target = args[args.indexOf('--target') + 1] ?? 'web';
if (!['web', 'android'].includes(target)) {
    process.stderr.write(`Unsupported app target: ${target}\n`);
    process.exitCode = 1;
} else if (args.includes('--dry-run')) {
    process.stdout.write(`${JSON.stringify({ fixture: 'mirror-app-e2e', runNonce: crypto.randomBytes(16).toString('hex'), target })}\n`);
} else {
    process.stderr.write('App fixture requires root-orchestrator credentials and an explicit live handshake.\n');
    process.exitCode = 1;
}
