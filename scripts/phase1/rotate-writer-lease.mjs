import crypto from 'node:crypto';

const args = process.argv.slice(2);
if (args.some((argument) => /token|secret|password/i.test(argument))) {
    process.stderr.write('Raw lease material must never be supplied through process arguments.\n');
    process.exitCode = 1;
} else if (args.includes('--dry-run')) {
    const rawToken = crypto.randomBytes(32);
    process.stdout.write(`${JSON.stringify({ controlNonce: crypto.randomBytes(16).toString('hex'), leaseId: crypto.randomUUID(), state: 'proposed', tokenDigest: crypto.createHash('sha256').update(rawToken).digest('hex') })}\n`);
    rawToken.fill(0);
} else {
    process.stderr.write('Lease rotation requires the root orchestrator live protocol; no mutation was attempted.\n');
    process.exitCode = 1;
}
