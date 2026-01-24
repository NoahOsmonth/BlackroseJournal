const missingTableWarnings = new Set<string>();

export function isMissingTableMessage(message: string): boolean {
    const normalized = message.toLowerCase();
    return (
        normalized.includes('schema cache') ||
        normalized.includes('does not exist') ||
        normalized.includes('relation') && normalized.includes('does not exist')
    );
}

export function logSupabaseError(context: string, table: string, message: string): void {
    if (isMissingTableMessage(message)) {
        const key = `${table}:${context}`;
        if (missingTableWarnings.has(key)) {
            return;
        }
        missingTableWarnings.add(key);
    }

    console.warn(`${context}: ${message}`);
}

export function resetSupabaseErrorCache(): void {
    missingTableWarnings.clear();
}
