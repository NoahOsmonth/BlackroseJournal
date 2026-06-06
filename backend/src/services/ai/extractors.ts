/**
 * PR3 — extractors stub. Real implementation lands in PR4.
 *
 * The `extractReasoning` helper takes the upstream content string and
 * returns the reasoning text according to the provider's capabilities.
 * v1 passes content through unchanged; PR4 will add the real parser
 * (handles `reasoning_content` blocks, fenced think tags, etc.).
 */
import type { Capabilities } from './capabilities';

export function extractReasoning(content: string, _capabilities: Capabilities): string {
    return content;
}
