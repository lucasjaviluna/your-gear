import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

export async function requestApproval(operation: string, signal?: AbortSignal, cancel?: () => void): Promise<boolean> {
  if (signal?.aborted || !stdin.isTTY || !stdout.isTTY) return false;
  const rl = createInterface({ input: stdin, output: stdout });
  const onInterrupt = () => { cancel?.(); rl.close(); };
  rl.on('SIGINT', onInterrupt);
  try {
    const answer = await rl.question(`\n¿Autorizar ${operation}? [s/N] `, { signal });
    return !signal?.aborted && answer.trim().toLowerCase() === 's';
  } catch {
    return false;
  } finally {
    rl.off('SIGINT', onInterrupt);
    rl.close();
  }
}

/** Serialize interactive questions even when the runtime requests tools concurrently. */
export function serializeApprovals(approve: (description: string) => Promise<boolean>, signal?: AbortSignal) {
  let tail: Promise<unknown> = Promise.resolve();
  return (description: string): Promise<boolean> => {
    const next = tail.then(async () => {
      if (signal?.aborted) return false;
      const allowed = await approve(description);
      return !signal?.aborted && allowed;
    });
    tail = next.catch(() => undefined);
    return next;
  };
}
