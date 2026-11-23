import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { requestApproval } from '../../src/approval.ts';
import { createToolCallHandler } from '../../src/gate.ts';

const cwd = process.argv[2];
const handler = createToolCallHandler(cwd, requestApproval);
const result = await handler({ toolName: 'write', input: { path: 'created.txt', content: 'unexpected' } });
if (!result?.block) writeFileSync(join(cwd, 'created.txt'), 'unexpected');
process.stdout.write(result?.block ? 'blocked' : 'executed');
