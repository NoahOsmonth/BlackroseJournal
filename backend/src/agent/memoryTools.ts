import { McpRegistry } from '../mcp/registry';
import { McpTool } from '../mcp/types';

export interface MemoryToolSelection {
  saveTool: McpTool | null;
  recallTool: McpTool | null;
}

const SAVE_FIELD_CANDIDATES = ['content', 'text', 'memory', 'message'];
const RECALL_FIELD_CANDIDATES = ['query', 'text', 'q', 'search'];

function pickStringField(tool: McpTool | null, candidates: string[]): string | null {
  const schema = tool?.inputSchema;
  const properties = schema?.properties ? Object.keys(schema.properties) : [];
  for (const candidate of candidates) {
    if (properties.includes(candidate)) {
      return candidate;
    }
  }

  const required = schema?.required || [];
  if (required.length === 1) {
    return required[0];
  }

  if (properties.length === 1) {
    return properties[0];
  }

  return null;
}

function findToolByName(tools: McpTool[], name?: string): McpTool | null {
  if (!name) return null;
  return tools.find((tool) => tool.name === name) || null;
}

function fallbackFindTool(tools: McpTool[], keyword: string): McpTool | null {
  return tools.find((tool) => tool.name.toLowerCase().includes(keyword)) || null;
}

export async function resolveMemoryTools(
  registry: McpRegistry,
  serverId: string
): Promise<MemoryToolSelection> {
  const server = registry.getServer(serverId);
  const tools = await registry.listTools(serverId);
  const alias = server?.toolAliases;

  const saveTool =
    findToolByName(tools, alias?.saveMemory) ||
    fallbackFindTool(tools, 'memory') ||
    null;
  const recallTool =
    findToolByName(tools, alias?.recallMemory) ||
    fallbackFindTool(tools, 'recall') ||
    fallbackFindTool(tools, 'search') ||
    null;

  return { saveTool, recallTool };
}

export function buildSaveMemoryArgs(options: {
  tool: McpTool | null;
  content: string;
  containerTag?: string;
  metadata?: Record<string, unknown>;
}): Record<string, unknown> {
  const field = pickStringField(options.tool, SAVE_FIELD_CANDIDATES) || 'content';
  const args: Record<string, unknown> = {
    [field]: options.content,
  };

  const schema = options.tool?.inputSchema;
  if (schema?.properties && 'containerTag' in schema.properties && options.containerTag) {
    args.containerTag = options.containerTag;
  }
  if (schema?.properties && 'metadata' in schema.properties && options.metadata) {
    args.metadata = options.metadata;
  }
  if (schema?.properties && 'action' in schema.properties) {
    args.action = 'memory';
  }

  return args;
}

export function buildRecallArgs(options: {
  tool: McpTool | null;
  query: string;
  containerTag?: string;
  includeProfile?: boolean;
  limit?: number;
}): Record<string, unknown> {
  const field = pickStringField(options.tool, RECALL_FIELD_CANDIDATES) || 'query';
  const args: Record<string, unknown> = {
    [field]: options.query,
  };

  const schema = options.tool?.inputSchema;
  if (schema?.properties && 'containerTag' in schema.properties && options.containerTag) {
    args.containerTag = options.containerTag;
  }
  if (schema?.properties && 'includeProfile' in schema.properties && options.includeProfile !== undefined) {
    args.includeProfile = options.includeProfile;
  }
  if (schema?.properties && 'limit' in schema.properties && options.limit) {
    args.limit = options.limit;
  }

  return args;
}

function parseToolText(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
  if (!content) return '';
  return content
    .map((item) => (item.type === 'text' ? item.text || '' : ''))
    .filter(Boolean)
    .join('\n');
}

export function formatRecallContext(result: unknown): string {
  const text = parseToolText(result);
  if (!text) {
    return '';
  }

  try {
    const parsed = JSON.parse(text) as {
      profile?: { static?: string[]; dynamic?: string[] };
      results?: Array<{ memory?: string; chunk?: string }>;
    };

    const lines: string[] = ['## User Memory Context'];
    const staticProfile = parsed.profile?.static || [];
    const dynamicProfile = parsed.profile?.dynamic || [];
    const memories = parsed.results || [];

    lines.push(`Static profile: ${staticProfile.length ? staticProfile.join('\n') : 'None'}`);
    lines.push(`Recent context: ${dynamicProfile.length ? dynamicProfile.join('\n') : 'None'}`);

    const memoryLines = memories
      .map((item) => item.memory || item.chunk)
      .filter(Boolean) as string[];
    lines.push(`Relevant memories: ${memoryLines.length ? memoryLines.join('\n') : 'None'}`);

    return lines.join('\n\n');
  } catch {
    return `## User Memory Context\n${text}`.trim();
  }
}
