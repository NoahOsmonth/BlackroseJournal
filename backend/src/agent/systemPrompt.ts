const MEMORY_USAGE_GUIDANCE = `## Memory Guidance
- The following long-term memories may contain useful historical context.
- Use them when relevant to the user's current request.
- If memory conflicts with current user input, trust the latest user input.`;

export function buildSystemPrompt(basePrompt: string, memoryContext?: string): string {
  const sections = [basePrompt.trim()];

  if (memoryContext && memoryContext.trim()) {
    sections.push(MEMORY_USAGE_GUIDANCE);
    sections.push(memoryContext.trim());
  }

  return sections.filter(Boolean).join('\n\n');
}
