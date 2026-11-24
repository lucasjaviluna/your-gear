import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Ejecutá este smoke mediante npm run pack:check.');

function npm(args, cwd, expectedStatus = 0, extraEnv = {}) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1', ...extraEnv },
  });
  if (result.error) throw result.error;
  assert.equal(result.status, expectedStatus,
    `npm ${args[0]}: estado inesperado ${result.status}\n${result.stderr}`);
  return result;
}

const temp = mkdtempSync(join(tmpdir(), 'your-gear-pack-'));
try {
  const packed = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', temp], root).stdout);
  assert.equal(packed.length, 1);
  assert.equal(packed[0].name, manifest.name);
  assert.equal(packed[0].version, manifest.version);
  const files = new Set(packed[0].files.map(file => file.path));
  for (const required of ['package.json', 'README.md', 'dist/cli.js', 'dist/config.js', 'dist/assessment.js', 'dist/assessment-agent.js', 'dist/planner-agent.js', 'dist/plan.js', 'dist/tool-free-agent.js', 'dist/context-engine.js', 'dist/task-orchestrator.js', 'dist/executor-agent.js', 'dist/verification-evidence.js', 'dist/verification.js', 'dist/verifier-agent.js', 'dist/workflow-journal.js', 'dist/workflow-recovery.js', 'dist/memory/provider.js', 'dist/memory/config.js', 'dist/memory/ytk.js', 'dist/memory/commands.js', 'docs/references.md']) {
    assert.ok(files.has(required), `Falta en el tarball: ${required}`);
  }
  for (const file of files) {
    assert.ok(file === 'package.json' || file === 'README.md' || file.startsWith('dist/') || file.startsWith('docs/'),
      `Entrada inesperada: ${file}`);
  }
  const tarball = resolve(temp, packed[0].filename);
  const workspace = join(temp, 'workspace with spaces');
  mkdirSync(workspace);
  writeFileSync(join(workspace, 'package.json'), JSON.stringify({
    name: 'your-gear-smoke', private: true, scripts: { smoke: 'your-gear' },
  }));
  npm(['install', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund', '--no-package-lock', tarball], workspace);

  const installed = JSON.parse(readFileSync(join(workspace, 'node_modules', 'your-gear', 'package.json'), 'utf8'));
  assert.equal(installed.version, manifest.version);
  assert.equal(installed.bin['your-gear'], 'dist/cli.js');

  // An invalid project config ensures informational flags do not load settings.
  mkdirSync(join(workspace, '.your-gear'));
  writeFileSync(join(workspace, '.your-gear', 'config.json'), '{ invalid JSON');
  const invoke = (args, status = 0) => npm(['run', '--silent', 'smoke', '--', ...args], workspace, status);
  assert.match(invoke(['--help']).stdout, /Uso: your-gear/);
  assert.match(invoke(['-h']).stdout, /Uso: your-gear/);
  assert.equal(invoke(['--version']).stdout.trim(), manifest.version);
  // Semantic classification requires a model. CI validates early error paths without credentials.
  assert.match(invoke(['--analyze-only', 'Agregar permisos por rol'], 1).stderr, /JSON inválida/);
  assert.match(invoke(['--analyze-only', '--mcp', 'fixture', 'hola'], 1).stderr, /no admite otras opciones/);
  assert.match(invoke(['--analyze-only'], 1).stderr, /Uso/);
  assert.match(invoke(['--review-route', 'hola'], 1).stderr, /terminal interactiva/);
  assert.match(invoke(['--plan', 'hola'], 1).stderr, /terminal interactiva/);
  assert.match(invoke(['--run-task', 'hola'], 1).stderr, /terminal interactiva/);
  assert.match(invoke(['--run-task', '--record', 'hola'], 1).stderr, /terminal interactiva/);
  assert.match(invoke(['workflow', '../other'], 1).stderr, /ID de workflow inválido/);
  assert.match(invoke(['--recover', 'a3c179b2-14c2-4e87-9e21-201fa6b17c21', 'pendiente'], 1).stderr, /terminal interactiva/);
  assert.match(invoke(['--run-task', '--verify-test', 'example.test.js', 'hola'], 1).stderr, /terminal interactiva/);
  assert.match(invoke(['--plan', '--context', 'README.md', 'hola'], 1).stderr, /terminal interactiva/);
  assert.match(invoke(['--invalid-option'], 1).stderr, /Opción desconocida/);
  // Invoke the installed CLI without a TTY, with a registered local server
  // that would create a marker immediately if it ever started.
  const home = join(temp, 'isolated-home');
  const agent = join(home, '.your-gear');
  mkdirSync(agent, { recursive: true });
  const memoryStatus = npm(['run','--silent','smoke','--','memory','status'], workspace, 0, { HOME: home, USERPROFILE: home });
  assert.deepEqual(JSON.parse(memoryStatus.stdout), { status: 'disabled' });
  const history = npm(['run', '--silent', 'smoke', '--', 'workflows'], workspace, 0, { HOME: home, USERPROFILE: home });
  assert.deepEqual(JSON.parse(history.stdout), []);
  assert.equal(existsSync(join(agent, 'workflows')), false);
  const marker = join(temp, 'mcp-started.txt');
  const server = join(temp, 'server.cjs');
  writeFileSync(server, "require('node:fs').writeFileSync(process.argv[2], 'started');");
  writeFileSync(join(agent, 'mcp.json'), JSON.stringify({
    fixture: { command: process.execPath, args: [server, marker], tools: ['effect'] },
  }));
  const denied = npm(['run', '--silent', 'smoke', '--', '--mcp', 'fixture', 'hola'], workspace, 1,
    { HOME: home, USERPROFILE: home });
  assert.match(denied.stderr, /MCP requiere una terminal interactiva/);
  assert.equal(existsSync(marker), false, 'El servidor MCP no debe iniciarse sin TTY');
  console.log(`Paquete ${manifest.name}@${manifest.version}: instalación y smoke OK (${process.platform}).`);
} finally {
  rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
