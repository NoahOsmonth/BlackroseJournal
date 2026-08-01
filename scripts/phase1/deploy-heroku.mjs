const args = process.argv.slice(2);
function value(option) { const index = args.indexOf(option); return index === -1 ? undefined : args[index + 1]; }

const app = value('--app');
const expectedAppId = value('--expected-app-id');
const expectedCommit = value('--expected-commit');
if (!app || !expectedAppId || !expectedCommit) {
    process.stderr.write('--app, --expected-app-id, and --expected-commit are required.\n');
    process.exitCode = 1;
} else if (args.includes('--dry-run')) {
    process.stdout.write(`${JSON.stringify({ app, configKeyNames: ['MEMORY_MIRROR_WRITES_ENABLED', 'MEMORY_WRITER_EPOCH', 'MEMORY_WRITER_LEASE_ID', 'MEMORY_WRITER_LEASE_TOKEN'], expectedAppId, expectedCommit, mutation: false, rollbackRequiredAfterFailure: true })}\n`);
} else {
    process.stderr.write('Checked deployment requires the root orchestrator live protocol; no deployment was attempted.\n');
    process.exitCode = 1;
}
