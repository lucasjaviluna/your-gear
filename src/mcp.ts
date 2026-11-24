import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { createMcpExtension } from '@earendil-works/pi-coding-agent';
import type { Approval } from './policy.ts';

export type McpServer = { name: string; command: string; args: string[]; tools: string[] };

const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z][a-z0-9_]*$/.test(value) && !value.includes('__');

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Only the user's registry can define executable commands, never the workspace. */
export function readMcpServer(agentDir: string, name: string): McpServer {
  if (!identifier(name)) throw new Error('Nombre de servidor MCP inválido.');
  let registry: unknown;
  try { registry = JSON.parse(readFileSync(join(agentDir, 'mcp.json'), 'utf8')); }
  catch { throw new Error('No se pudo leer la configuración MCP del usuario (mcp.json).'); }
  if (!record(registry) || !Object.hasOwn(registry, name)) throw new Error('Servidor MCP no registrado.');
  const entry = registry[name];
  if (!record(entry) || Object.keys(entry).some(key => !['command', 'args', 'tools'].includes(key)) ||
      typeof entry.command !== 'string' || !isAbsolute(entry.command) ||
      !Array.isArray(entry.args) || !entry.args.every(arg => typeof arg === 'string' && !arg.includes('\0')) ||
      !Array.isArray(entry.tools) || !entry.tools.length || !entry.tools.every(identifier) ||
      new Set(entry.tools).size !== entry.tools.length || entry.command.includes('\0')) {
    throw new Error('Configuración MCP inválida: se requiere ejecutable absoluto, args y herramientas explícitas.');
  }
  return { name, command: entry.command, args: [...entry.args], tools: [...entry.tools] };
}

export function mcpToolNames(server: McpServer): string[] {
  return server.tools.map(tool => `mcp__${server.name}__${tool}`);
}

/** Call before loading the extension or creating the session. */
export async function approveMcpStart(server: McpServer, cwd: string, approve: Approval): Promise<void> {
  const description = `inicio MCP ${server.name} (cwd=${JSON.stringify(cwd)}): ${JSON.stringify([server.command, ...server.args])}\nHerramientas: ${JSON.stringify(server.tools)}\nEl proceso no está aislado y puede realizar efectos fuera de las herramientas`;
  if (!await approve(description)) throw new Error('Inicio MCP no autorizado.');
}

export function controlledMcpExtension(server: McpServer, agentDir: string) {
  return createMcpExtension({
    loadConfig: () => ({ errors: [], servers: [{ name: server.name, source: 'your-gear',
      config: { command: server.command, args: server.args, exposure: 'direct' } }] }),
    logPath: join(agentDir, 'mcp.log'),
  });
}

/** The SDK registers tools asynchronously on session start. No prompt before readiness. */
export async function waitForMcpTools(expected: string[], available: () => string[], timeoutMs = 10000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!expected.every(name => available().includes(name))) {
    if (Date.now() >= deadline) throw new Error('MCP no registró todas las herramientas configuradas.');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
