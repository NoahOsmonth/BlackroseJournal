import crypto from 'node:crypto';

function fixture() {
    return { fixture: 'mirror-hosted-e2e', ownerIds: [crypto.randomUUID(), crypto.randomUUID()], runNonce: crypto.randomBytes(16).toString('hex') };
}

if (process.argv.slice(2).includes('--dry-run')) {
    process.stdout.write(`${JSON.stringify(fixture())}\n`);
} else {
    process.stderr.write('Hosted fixture requires root-orchestrator credentials and an explicit live handshake.\n');
    process.exitCode = 1;
}
