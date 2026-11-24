import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const cases = JSON.parse(readFileSync(new URL('../test/fixtures/classifier-eval.json', import.meta.url), 'utf8'));
const cli = new URL('../dist/cli.js', import.meta.url);
const { fileURLToPath } = await import('node:url');
let correct = 0, failures = 0, risky = 0;
console.log('Evaluación con modelo real: consume uso del proveedor configurado.');
for (const { id, request, expected } of cases) {
  const result = spawnSync(process.execPath, [fileURLToPath(cli), '--analyze-only', request], {
    encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024,
  });
  let actual;
  try {
    if (result.error || result.status !== 0) throw new Error('classification failed');
    actual = JSON.parse(result.stdout).recommendedRoute;
    if (!['simple', 'task', 'sdd', 'clarify'].includes(actual)) throw new Error('invalid route');
  } catch {
    failures++;
    console.log(`${id}: ERROR (esperado ${expected})`);
    continue;
  }
  if (actual === expected) correct++;
  if (expected === 'sdd' && (actual === 'simple' || actual === 'task')) risky++;
  console.log(`${id}: ${actual === expected ? 'OK' : 'REVISAR'} (esperado ${expected}, obtenido ${actual})`);
}
console.log(JSON.stringify({ correct, total: cases.length, failures, riskyUnderclassifications: risky, accuracy: correct / cases.length }, null, 2));
if (correct !== cases.length) process.exitCode = 1;
