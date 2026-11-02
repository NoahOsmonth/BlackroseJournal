/**
 * Global crash capture.
 *
 * Installed once from the root layout, before the first screen renders. Every
 * path here is a side effect with no UI: it records the crash and then lets the
 * runtime do what it would have done anyway (redbox, native crash, browser
 * console). Nothing is swallowed.
 */

import { Platform } from 'react-native';

import { recordCrashLog } from './crashLogStorage';

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsLike {
    getGlobalHandler?: () => ErrorHandler | undefined;
    setGlobalHandler?: (handler: ErrorHandler) => void;
}

let installed = false;

function readErrorUtils(): ErrorUtilsLike | null {
    const scope = globalThis as unknown as { ErrorUtils?: ErrorUtilsLike };
    const candidate = scope.ErrorUtils;
    return candidate && typeof candidate === 'object' ? candidate : null;
}

function installGlobalHandler(): (() => void) | null {
    const errorUtils = readErrorUtils();
    if (!errorUtils?.setGlobalHandler) return null;

    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
        void recordCrashLog({
            error,
            isFatal: isFatal ?? true,
            component: 'globalHandler',
            platform: Platform.OS,
        });
        // Preserve the default behaviour: redbox in dev, native crash in prod.
        previous?.(error, isFatal);
    });

    return () => {
        errorUtils.setGlobalHandler?.(previous ?? (() => undefined));
    };
}

function installBrowserHandlers(): (() => void) | null {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
        return null;
    }

    const onError = (event: Event) => {
        const errorEvent = event as ErrorEvent;
        void recordCrashLog({
            error: errorEvent.error ?? errorEvent.message,
            isFatal: false,
            component: 'window.error',
            platform: 'web',
        });
    };

    const onUnhandledRejection = (event: Event) => {
        const rejection = event as PromiseRejectionEvent;
        void recordCrashLog({
            error: rejection.reason,
            isFatal: false,
            component: 'unhandledrejection',
            platform: 'web',
        });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
}

/**
 * Hook every uncaught-error surface the current runtime exposes. Idempotent:
 * a second call is a no-op that returns a no-op disposer.
 */
export function installCrashHandler(): () => void {
    if (installed) return () => undefined;
    installed = true;

    const disposers = [installGlobalHandler(), installBrowserHandlers()]
        .filter((dispose): dispose is () => void => dispose !== null);

    return () => {
        disposers.forEach((dispose) => dispose());
        installed = false;
    };
}

/**
 * Record an error a React error boundary caught. The boundary renders its own
 * fallback, so this only persists the record.
 */
export function reportBoundaryCrash(error: unknown, component = 'boundary'): Promise<void> {
    return recordCrashLog({ error, isFatal: true, component }).then(
        () => undefined,
        () => undefined,
    );
}

/** Test-only: allows a suite to install the handler again. */
export function __resetCrashHandlerForTests(): void {
    installed = false;
}
