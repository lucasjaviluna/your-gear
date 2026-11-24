import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { collectContext } from './context-engine.ts';

export type TestEvidence = {
  path: string;
  status: 'exit-zero' | 'failed' | 'error' | 'skipped' | 'stale';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  outputTruncated: boolean;
};

export function parseTaskArgs(args: readonly string[]): { files: string[]; tests: string[]; promptArgs: string[] } {
  const files: string[] = [], tests: string[] = [];
  let i = 0;
  while (args[i] === '--context' || args[i] === '--verify-test') {
    const target = args[i] === '--context' ? files : tests;
    const limit = target === files ? 8 : 3;
    const path = args[i + 1];
    if (!path || path.startsWith('-') || target.length >= limit) throw new Error('Selección de contexto o prueba inválida.');
    if (target === tests && (!/\.(?:test|spec)\.(?:js|mjs|cjs)$/i.test(path) || /[*?[\]{}]/.test(path))) throw new Error('Seleccioná un archivo .test.js/.mjs/.cjs o .spec.js/.mjs/.cjs sin glob.');
    target.push(path);
    i += 2;
  }
  if (new Set(tests).size !== tests.length) throw new Error('Pruebas duplicadas.');
  return { files, tests, promptArgs: args.slice(i) };
}

export function safePreview(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/[\u007f-\u009f\u2028-\u202e\u2066-\u2069]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export async function runSelectedTest(cwd: string, path: string, ask: (description: string) => Promise<string>, signal?: AbortSignal): Promise<TestEvidence> {
  const result = (status: TestEvidence['status']): TestEvidence => ({ path, status, exitCode: null, stdout: '', stderr: '', outputTruncated: false });
  const check = () => { if (signal?.aborted) throw new Error('La ejecución fue cancelada.'); };
  check();
  // Validate independently of the CLI parser. No shell, glob, or model-selected command.
  if (!/\.(?:test|spec)\.(?:js|mjs|cjs)$/i.test(path) || /[*?[\]{}]/.test(path)) throw new Error('Ruta de prueba inválida.');
  let before;
  try { before = collectContext(cwd, [path], signal).entries[0]; }
  catch { check(); return result('error'); }
  const args = ['--test', '--test-reporter=tap', join(cwd, before.path)];
  const answer = await ask('Prueba local seleccionada. Puede ejecutar código arbitrario, acceder al entorno y producir efectos; no es sandbox.\n' +
    safePreview({ executable: process.execPath, args, file: before }) + '\n¿Ejecutar esta prueba? [s/N] ');
  check();
  if (answer.trim().toLowerCase() !== 's') return result('skipped');
  try {
    const after = collectContext(cwd, [path], signal).entries[0];
    if (after.path !== before.path || after.content !== before.content) return result('stale');
  } catch { check(); return result('stale'); }
  check();
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  const evidence = await new Promise<TestEvidence>(resolve => {
    execFile(process.execPath, args, { cwd, env, shell: false, timeout: 60000, maxBuffer: 65536, signal, encoding: 'utf8', windowsHide: true },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : null) : 0;
        resolve({
          path, status: !error ? 'exit-zero' : code !== null && !error.killed && !error.signal ? 'failed' : 'error',
          exitCode: code, stdout: stdout.slice(0, 4000), stderr: stderr.slice(0, 4000),
          outputTruncated: stdout.length > 4000 || stderr.length > 4000 || error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
        });
      });
  });
  check();
  return evidence;
}
