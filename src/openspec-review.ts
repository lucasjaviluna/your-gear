import { collectContext, type ContextSnapshot } from './context-engine.ts';
import { inspectOpenSpec, snapshotOpenSpec } from './openspec-inspect.ts';
import { safePreview } from './verification-evidence.ts';

export type ReviewOptions = { cwd:string; script:string; change:string; files:readonly string[]; interactive:boolean;
  approve:(description:string)=>Promise<boolean>; ask:(description:string)=>Promise<string>; signal?:AbortSignal; requireAllSpecs?:boolean };

/** Review explicit artifacts only. Approval allows disclosure, not execution. */
export async function reviewOpenSpec(options:ReviewOptions):Promise<{status:'cancelled'; context?:undefined; treeDigest?:undefined} | {status:'reviewed'; context:ContextSnapshot; treeDigest:string}> {
  if (!options.interactive) throw new Error('La revisión requiere terminal interactiva.');
  if (options.signal?.aborted) throw new Error('La ejecución fue cancelada.');
  const prefix = `openspec/changes/${options.change}/`;
  const files = options.files;
  if (!files.length || files.length > 8 || new Set(files).size !== files.length ||
      files.some(path => !path.startsWith(prefix) || path.includes('\\')) ||
      !['proposal.md','design.md','tasks.md'].every(name => files.includes(prefix + name)) ||
      !files.some(path => /^specs\/(?:[a-z0-9-]+\/)+spec\.md$/.test(path.slice(prefix.length)))) {
    throw new Error('Seleccioná proposal.md, design.md, tasks.md y al menos una spec del change, sin duplicados.');
  }
  const snapshot = snapshotOpenSpec(options.cwd, options.change);
  if (options.requireAllSpecs) {
    const required = ['proposal.md','design.md','tasks.md'].map(name=>prefix+name).concat(snapshot.specPaths);
    if (!snapshot.specPaths.length || snapshot.specPaths.some(path=>!/^specs\/(?:[a-z0-9-]+\/)+spec\.md$/.test(path.slice(prefix.length))) ||
        required.length !== files.length || !required.every(path=>files.includes(path))) throw new Error('Para planificar SDD seleccioná todos los artefactos y specs del change; no se permite planificación parcial.');
  }
  const inspection = await inspectOpenSpec(options);
  if (inspection.treeDigest !== snapshot.digest || snapshotOpenSpec(options.cwd, options.change).digest !== snapshot.digest) throw new Error('Los artefactos cambiaron durante la inspección.');
  if (options.requireAllSpecs && !['proposal','design','tasks','specs'].every(id=>inspection.artifacts.filter(a=>a.id===id&&a.status==='done').length===1)) throw new Error('La planificación SDD exige los cuatro artefactos terminados, sin skip.');
  if (!inspection.planningComplete || !inspection.structurallyValid) throw new Error('El change no completó planificación o validación estructural.');
  const context = collectContext(options.cwd, files, options.signal);
  const answer = await options.ask('confirmar revisión de estos artefactos y contexto, sin autorizar ejecución ni enviar datos al modelo:\n' + safePreview(context.entries));
  if (options.signal?.aborted) throw new Error('La ejecución fue cancelada.');
  if (answer.trim().toLowerCase() !== 's') return {status:'cancelled'};
  if (snapshotOpenSpec(options.cwd, options.change).digest !== snapshot.digest || collectContext(options.cwd, files, options.signal).digest !== context.digest) throw new Error('Los artefactos o el contexto cambiaron durante la revisión.');
  return {status:'reviewed', context, treeDigest:snapshot.digest};
}
