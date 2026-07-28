import { MEMORY_CONTRACT_VERSION } from '../../shared/memory/contracts';

if (MEMORY_CONTRACT_VERSION !== 1) {
  throw new Error('memory contract unavailable');
}
process.stdout.write('artifact-ok\n');
