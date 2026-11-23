const { writeFileSync, appendFileSync } = require('node:fs');
const readline = require('node:readline');

const marker = process.argv[2];
writeFileSync(marker, 'started\n');
const lines = readline.createInterface({ input: process.stdin });
lines.on('line', line => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  let result;
  if (request.method === 'initialize') {
    result = { protocolVersion: request.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } };
  } else if (request.method === 'tools/list') {
    result = { tools: [{ name: 'effect', description: 'Fixture effect', inputSchema: { type: 'object', properties: {} } }] };
  } else if (request.method === 'tools/call') {
    appendFileSync(marker, 'called\n');
    result = { content: [{ type: 'text', text: 'called' }] };
  } else {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Not found' } }) + '\n');
    return;
  }
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
});
lines.on('close', () => { appendFileSync(marker, 'closed\n'); });
