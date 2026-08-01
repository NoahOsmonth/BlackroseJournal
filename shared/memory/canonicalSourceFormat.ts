import { parseMirrorChunk, type MirrorChunk } from './mirrorContracts';

const encoder = new TextEncoder();

function field(name: string, value: string | number | null): string {
    if (value === null) return `${name}:N\n`;
    if (typeof value === 'number') return `${name}:I${value}\n`;
    return `${name}:S${encoder.encode(value).byteLength}:${value}\n`;
}

/**
 * Explicit UTF-8, length-prefixed wire form shared by client vectors and the
 * backend. The parser consumes each field by byte length, so CR/LF and Unicode
 * inside content are data rather than delimiters.
 */
export function canonicalizeMirrorChunk(input: MirrorChunk | unknown): string {
    const chunk = parseMirrorChunk(input);
    const lines = [
        'BRJ-MIRROR-SOURCE-V1\n',
        field('contractVersion', chunk.contractVersion),
        field('manifestId', chunk.manifestId),
        field('chunkIndex', chunk.chunkIndex),
        field('conversationCount', chunk.conversations.length),
    ];

    for (const conversation of chunk.conversations) {
        lines.push(
            'conversation\n',
            field('id', conversation.id),
            field('sourceKind', conversation.sourceKind),
            field('sourceRecordId', conversation.sourceRecordId),
            field('status', conversation.status),
            field('startedAt', conversation.startedAt),
            field('settledAt', conversation.settledAt),
            field('timezone', conversation.timezone),
            field('weekStartsOn', conversation.weekStartsOn),
            field('temporalProvenance', conversation.temporalProvenance),
            field('clientSchemaVersion', conversation.clientSchemaVersion),
            field('sourceRevision', conversation.sourceRevision),
            field('previousAcceptedRevision', conversation.previousAcceptedRevision),
            field('messageCount', conversation.messages.length),
        );
        for (const message of conversation.messages) {
            lines.push(
                'message\n',
                field('id', message.id),
                field('conversationId', message.conversationId),
                field('clientEventId', message.clientEventId),
                field('role', message.role),
                field('sequence', message.sequence),
                field('authoredAt', message.authoredAt),
                field('authoredTimezone', message.authoredTimezone),
                field('localDate', message.localDate),
                field('temporalProvenance', message.temporalProvenance),
                field('content', message.content),
                field('revision', message.revision),
                field('previousAcceptedRevision', message.previousAcceptedRevision),
                field('status', message.status),
            );
        }
    }
    return lines.join('');
}

export function canonicalMirrorChunkBytes(input: MirrorChunk | unknown): Uint8Array {
    return encoder.encode(canonicalizeMirrorChunk(input));
}
