export interface ReadinessSnapshot {
  ai: boolean;
}

export interface ReadinessProvider {
  getSnapshot(): ReadinessSnapshot;
}

export interface ReadinessController extends ReadinessProvider {
  refresh(): Promise<ReadinessSnapshot>;
}

interface ReadinessControllerDeps {
  probeAi: () => boolean | Promise<boolean>;
}

export function createReadinessController(
  deps: ReadinessControllerDeps,
): ReadinessController {
  let snapshot: ReadinessSnapshot = { ai: false };
  let inFlight: Promise<ReadinessSnapshot> | null = null;

  async function runRefresh(): Promise<ReadinessSnapshot> {
    let ai = false;
    try {
      ai = await deps.probeAi();
    } catch {
      ai = false;
    }
    snapshot = { ai };
    return { ...snapshot };
  }

  return {
    getSnapshot() {
      return { ...snapshot };
    },
    refresh() {
      if (!inFlight) {
        inFlight = runRefresh().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },
  };
}
