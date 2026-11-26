import { copyFileSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (process.argv.length !== 2) throw new Error('Uso: node scripts/prepare-task-lab.mjs');
const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'gear-task-lab-')));
for (const name of ['retry.cjs', 'retry.test.cjs', 'README.md']) {
  copyFileSync(new URL('../test/fixtures/task-lab/' + name, import.meta.url), join(cwd, name));
}
// stdout contains only the path, so PowerShell/bash can capture it.
// No model, provider, auth, install, test execution or automatic cleanup.
console.log(cwd);
