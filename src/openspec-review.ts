import { collectContext, type ContextSnapshot } from './context-engine.ts';
import { inspectOpenSpec } from './openspec-inspect.ts';
import { safePreview } from './verification-evidence.ts';

type ReviewOptions = { cwd:string; script:string; change:string; files:readonly string[]; interactive:boolean;
  approve:(description:string)=>Promise<boolean>; ask:(description:string)=>Promise<string>; signal?:AbortSignal };

/** Review explicit artifacts only. Approval allows disclosure, not execution. */
export async function reviewOpenSpec(options:ReviewOptions):Promise<{status:'reviewed'|'cancelled'; context?:ContextSnapshot}> {
  const prefix = `openspec/changes/${options.change}/`;
  const files = options.files;
  if (!files.length || files.length > 8 || new Set(files).size !== files.length ||
      files.some(path => !path.startsWith(prefix) || path.includes('\\')) ||
      !['proposal.md','design.md','tasks.md'].every(name => files.includes(prefix + name)) ||
      !files.some(path => /^specs\/(?:[a-z0-9-]+\/)+spec\.md$/.test(path.slice(prefix.length)))) {
    throw new Error('Seleccioná proposal.md, design.md, tasks.md y al menos una spec del change, sin duplicados.');
  }
  const inspection = await inspectOpenSpec(options) as {planningComplete:boolean; structurallyValid:boolean};
  if (!inspection.planningComplete || !inspection.structurallyValid) throw new Error('El change no completó planificación o validación estructural.');
  const context = collectContext(options.cwd, files, options.signal);
  const answer = await options.ask('confirmar revisión de estos artefactos y contexto, sin autorizar ejecución ni enviar datos al modelo:\n' + safePreview(context.entries));
  if (options.signal?.aborted) throw new Error('La ejecución fue cancelada.');
  if (answer.trim().toLowerCase() !== 's') return {status:'cancelled'};
  if (collectContext(options.cwd, files, options.signal).digest !== context.digest) throw new Error('Los artefactos o el contexto cambiaron durante la revisión.');
  return {status:'reviewed', context};
}
