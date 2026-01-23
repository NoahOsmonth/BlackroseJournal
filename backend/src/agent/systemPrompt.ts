const MEMORY_POLICY = `## Memory Usage Policy
- You may use memory tools to recall past details when it helps answer the user's request.
- Only save memory when the user explicitly asks to remember something or when they share a stable preference/identity.
- Never store secrets, passwords, financial details, or highly sensitive personal data.
- If memory is missing or uncertain, be transparent.`;

export function buildSystemPrompt(basePrompt: string, memoryContext?: string): string {
  const sections = [basePrompt.trim(), MEMORY_POLICY];
  if (memoryContext && memoryContext.trim()) {
    sections.push(memoryContext.trim());
  }
  return sections.filter(Boolean).join('\n\n');
}
