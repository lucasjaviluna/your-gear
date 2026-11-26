import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { safePreview } from './verification-evidence.ts';

type Options = { cwd: string; script: string; change: string; interactive: boolean; approve: (message: string) => Promise<boolean>; signal?: AbortSignal };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

// Deliberately accept only the default local schema, with no external stores or custom rules.
export function snapshotOpenSpec(cwd: string, change: string): {root:string; digest:string; specPaths:string[]} {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(change) || change.length > 100 || change === 'archive') throw new Error('Identificador de change inválido.');
  const root = realpathSync(cwd);
  const tree = join(root, 'openspec');
  const specPaths: string[] = [];
  let count = 0;
  let bytes = 0;
  const hash = createHash('sha256');
  function visit(path: string): void {
    if (++count > 2000) throw new Error('Árbol OpenSpec demasiado grande.');
    const st = lstatSync(path);
    if (st.isSymbolicLink()) throw new Error('No se admiten enlaces en openspec/.');
    hash.update(JSON.stringify([relative(tree, path), st.isDirectory() ? 'dir' : 'file']));
    if (st.isDirectory()) for (const name of readdirSync(path).sort()) visit(join(path, name));
    else {
      if (!st.isFile() || st.nlink !== 1 || st.size > 1024 * 1024 || (bytes += st.size) > 16 * 1024 * 1024) throw new Error('Archivo OpenSpec no admitido (tamaño o enlaces).');
      const rel = relative(root, path).split('\\').join('/');
      const prefix = 'openspec/changes/' + change + '/specs/';
      if (rel.startsWith(prefix)) specPaths.push(rel);
      const contents = readFileSync(path);
      if (contents.length > 1024 * 1024 || contents.length !== st.size) throw new Error('Archivo OpenSpec modificado durante lectura.');
      hash.update(JSON.stringify(contents.length));
      hash.update(contents);
    }
  }
  visit(tree);
  const config = readFileSync(join(tree, 'config.yaml'), 'utf8');
  if (config.length > 8192 || config.split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#')).join('\n') !== 'schema: spec-driven') {
    throw new Error('Solo se admite config.yaml con schema: spec-driven y sin configuración adicional.');
  }
  if (!lstatSync(join(tree, 'changes', change)).isDirectory()) throw new Error('Change no disponible.');
  if (readdirSync(tree).includes('schemas')) throw new Error('Esquemas locales no admitidos.');
  return {root, digest:hash.digest('hex'), specPaths:specPaths.sort()};
}

function scriptDigest(path:string): string {
  const st = lstatSync(path);
  if (!st.isFile() || st.nlink !== 1 || st.size > 10 * 1024 * 1024) throw new Error('Script OpenSpec no admitido.');
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function invoke(script: string, args: string[], cwd: string, home: string, signal?: AbortSignal): Promise<{code: number; output: string}> {
  const env = { ...process.env, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, XDG_CONFIG_HOME: home, XDG_DATA_HOME: home };
  for (const key of ['NODE_OPTIONS', 'NODE_PATH', 'NODE_V8_COVERAGE']) delete env[key as keyof typeof env];
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [script, ...args], { cwd, env, shell: false, timeout: 10000, maxBuffer: 65536, signal, encoding: 'utf8', windowsHide: true }, (error, stdout) => {
      if (error && (typeof error.code !== 'number' || error.killed || error.signal)) return reject(new Error('OpenSpec falló, excedió el límite o fue cancelado.'));
      resolve({code: error ? error.code as number : 0, output: stdout});
    });
  });
}

export async function inspectOpenSpec(options: Options): Promise<{provider:'openspec';version:'2.2.0';change:string;planningComplete:boolean;artifacts:{id:string;status:unknown}[];structurallyValid:boolean;treeDigest:string;defaultSchema:boolean;note:string}> {
  const { cwd, script, change, signal } = options;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(change) || change.length > 100) throw new Error('Identificador de change inválido.');
  if (!isAbsolute(script) || !/\.js$/i.test(script) || !lstatSync(script).isFile()) throw new Error('Indicá una ruta absoluta a openspec.js existente.');
  const executable = realpathSync(script);
  const before = snapshotOpenSpec(cwd, change);
  const {root} = before;
  const beforeScript = scriptDigest(executable);
  if (!options.interactive) throw new Error('La inspección requiere terminal interactiva.');
  if (signal?.aborted) throw new Error('La ejecución fue cancelada.');
  if (!await options.approve('ejecutar OpenSpec local con permisos del usuario, sin sandbox (puede leer o modificar archivos):\n' + safePreview({script: executable, node: process.execPath, workspace: root, change, commands: ['--version', 'status', 'validate']}))) throw new Error('Inspección no autorizada.');
  if (signal?.aborted) throw new Error('La ejecución fue cancelada.');
  const after = snapshotOpenSpec(root, change);
  if (after.root !== root || after.digest !== before.digest || realpathSync(script) !== executable || scriptDigest(executable) !== beforeScript) throw new Error('Archivos modificados durante la aprobación.');
  const home = mkdtempSync(join(tmpdir(), 'your-gear-openspec-'));
  try {
    const version = await invoke(executable, ['--version'], root, home, signal);
    if (version.code !== 0 || version.output.trim() !== '2.2.0') throw new Error('Solo se admite OpenSpec 2.2.0.');
    const status = await invoke(executable, ['status', '--change', change, '--json'], root, home, signal);
    let s: unknown;
    try { s = JSON.parse(status.output); } catch { throw new Error('Respuesta OpenSpec inválida.'); }
    const validRoot = (x: unknown) => record(x) && record(x.root) && typeof x.root.path === 'string' && x.root.source === 'nearest' && realpathSync(x.root.path) === root;
    if (status.code !== 0 || !record(s) || !validRoot(s) || s.changeName !== change || typeof s.isPlanningComplete !== 'boolean' || !Array.isArray(s.artifacts) || s.artifacts.length > 100) throw new Error('Respuesta o raíz OpenSpec no admitida.');
    const artifacts = s.artifacts.map(item => {
      if (!record(item) || typeof item.id !== 'string' || !/^[a-z0-9-]{1,100}$/.test(item.id) || !['done','ready','blocked','skipped'].includes(String(item.status))) throw new Error('Artefacto OpenSpec inválido.');
      return {id:item.id, status:item.status};
    });
    // Recheck the tree after the external status process, before starting another process.
    const current = snapshotOpenSpec(root, change);
    if (current.root !== root || current.digest !== before.digest || scriptDigest(executable) !== beforeScript) throw new Error('Archivos modificados durante la inspección.');
    const validation = await invoke(executable, ['validate', change, '--json'], root, home, signal);
    let v: unknown;
    try { v = JSON.parse(validation.output); } catch { throw new Error('Respuesta OpenSpec inválida.'); }
    if (!record(v) || !validRoot(v) || v.version !== '1.0' || !Array.isArray(v.items) || v.items.length !== 1 || !record(v.items[0]) || v.items[0].id !== change || v.items[0].type !== 'change' || typeof v.items[0].valid !== 'boolean' || validation.code !== (v.items[0].valid ? 0 : 1)) throw new Error('Respuesta o raíz OpenSpec no admitida.');
    const final = snapshotOpenSpec(root, change);
    if (final.root !== root || final.digest !== before.digest || scriptDigest(executable) !== beforeScript) throw new Error('Archivos modificados durante la inspección.');
    // Do not consume paths, instructions, diagnostics, or content from the external process.
    if (relative(root, realpathSync(join(root, 'openspec'))).startsWith('..')) throw new Error('Raíz OpenSpec inválida.');
    return {provider:'openspec', version:'2.2.0', change, treeDigest:before.digest, defaultSchema:s.schemaName==='spec-driven', planningComplete:s.isPlanningComplete, artifacts, structurallyValid:v.items[0].valid, note:'La planificación y validación estructural no prueban implementación ni aceptación.'};
  } finally { rmSync(home, { recursive:true, force:true }); }
}
