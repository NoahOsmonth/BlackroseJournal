/**
 * On-device background workers.
 *
 * This module exports the on-device background worker registry. The
 * first worker is intentionally local-only: it validates that NanoGPT
 * config is present on the phone and records a last-run marker without
 * persisting the API key.
 */

export { runLocalAiWorker, LOCAL_AI_WORKER_LAST_RUN_KEY } from './localAiWorker';
export { registerAllWorkers } from './taskRegistry';
export { WORKER_TASK_NAMES } from './taskNames';
