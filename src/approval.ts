import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

export async function requestApproval(operation: string): Promise<boolean> {
  if (!stdin.isTTY || !stdout.isTTY) return false;
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(`\n¿Autorizar ${operation}? [s/N] `)).trim().toLowerCase() === 's';
  } finally {
    rl.close();
  }
}
