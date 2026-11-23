import { realpathSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { decideTool } from './policy.ts';

/** Explicitly selected skill must be a single readable SKILL.md inside the workspace. */
export function resolveSkill(cwd: string, requested: string): string {
  if (basename(requested) !== 'SKILL.md' || decideTool({ cwd, toolName: 'read', input: { path: requested } }).type !== 'allow') {
    throw new Error('La skill debe ser un archivo SKILL.md dentro del workspace y fuera de rutas protegidas.');
  }
  try {
    const path = realpathSync(resolve(cwd, requested));
    if (!statSync(path).isFile()) throw new Error('not a file');
    return path;
  } catch {
    throw new Error('No se pudo leer el archivo de la skill.');
  }
}
