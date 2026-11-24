import type { MemoryProvider } from './provider.ts';
import { readMemoryConfig, type MemoryConfig } from './config.ts';
import { connectYtk } from './ytk.ts';
import { createBrief, checkpointRequest, memoryScope, readCheckpoint, storeCheckpoint, type CheckpointPhase } from './checkpoint.ts';
import { inspectWorkflow, type WorkflowJournal } from '../workflow-journal.ts';
import { safePreview } from '../verification-evidence.ts';
import type { Plan } from '../plan.ts';

type Ask = (description:string)=>Promise<string>;
type Options = { cwd:string; agentDir:string; ask:Ask; signal:AbortSignal; warn:(message:string)=>void; connect?:typeof connectYtk };
export type WorkflowMemory = { checkpoint:(phase:CheckpointPhase,observation:string)=>Promise<void>; close:()=>Promise<void> };
const accepted = (s:string)=>s.trim().toLowerCase()==='s';
function check(signal:AbortSignal){if(signal.aborted)throw new Error('La ejecución fue cancelada.');}

async function configFor(options:Options):Promise<MemoryConfig>{
  const config=readMemoryConfig(options.cwd,options.agentDir);
  if(!config)throw new Error('Memoria no configurada para este workspace.');
  return config;
}
export async function openWorkflowMemory(options:Options,journal:WorkflowJournal,plan:Plan,files:readonly string[]):Promise<WorkflowMemory|undefined>{
  let provider:MemoryProvider|undefined;
  try{
    check(options.signal);
    const config=await configFor(options);
    const brief=createBrief(plan,files);
    const answer=await options.ask('Memoria experimental: se guardará localmente este resumen del plan y las rutas seleccionadas, junto con estados y contadores posteriores. No se guardan prompts crudos ni salidas de herramientas. Revisá secretos/datos sensibles. YTK puede migrar la base; no es sandbox.\n'+safePreview({config,brief})+'\n¿Autorizar esta sesión y checkpoints automáticos? [s/N] ');
    check(options.signal);
    if(!accepted(answer))return undefined;
    provider=await (options.connect??connectYtk)(config,options.signal,true);
    const p=provider;
    const session=await p.start();
    check(options.signal);
    let degraded=false;
    const warn=()=>options.warn('Memoria no disponible; se conserva recuperación manual. No se reintenta una escritura incierta.\n');
    const result:WorkflowMemory={
      async checkpoint(phase,observation){
        check(options.signal);
        if(degraded)return;
        try{await storeCheckpoint(p,session.id,journal,memoryScope(config),phase,brief,observation);}
        catch{check(options.signal);degraded=true;warn();}
      },
      async close(){
        try{
          if(!degraded&&!options.signal.aborted)await p.finish(session.id);
        }catch{warn();}
        finally{try{await p.close();}catch{warn();}}
      },
    };
    return result;
  }catch{
    if(provider)await provider.close().catch(()=>{});
    check(options.signal);
    options.warn('No se pudo iniciar memoria; continúa sin checkpoints.\n');
    return undefined;
  }
}

/** Read only the exact reference, preview historical data, then use the existing recovery gate. */
export async function recoverFromMemory(options:Options,id:string,files:readonly string[]):Promise<{remaining:string;files:string[]}|undefined>{
  check(options.signal);
  const parent=inspectWorkflow(options.cwd,options.agentDir,id);
  if(parent.complete)throw new Error('El workflow anterior está cerrado; iniciá una tarea nueva.');
  const config=await configFor(options);
  const answer=await options.ask('Consultar memoria local para recuperar '+id+' (sin LLM; el binario puede migrar la base).\n'+safePreview(config)+'\n¿Autorizar inicio? [s/N] ');
  check(options.signal);
  if(!accepted(answer))return undefined;
  const provider=await (options.connect??connectYtk)(config,options.signal);
  try{
    const checkpoint=await readCheckpoint(provider,parent,memoryScope(config));
    check(options.signal);
    const selected=files.length?[...files]:checkpoint.brief.files;
    const remaining=checkpointRequest(checkpoint);
    const review=await options.ask('Contexto histórico recuperado; no acredita qué trabajo terminó. Confirmá el objetivo, el estado actual del repositorio y las rutas que se volverán a leer. No se recuperan comandos de test ni permisos.\n'+safePreview({remaining,files:selected})+'\n¿Usar este contexto para una nueva planificación? [s/N] ');
    check(options.signal);
    if(!accepted(review))return undefined;
    // Any change to the original journal during the lookup invalidates this selection.
    if(JSON.stringify(inspectWorkflow(options.cwd,options.agentDir,id))!==JSON.stringify(parent))throw new Error('El registro anterior cambió durante la recuperación.');
    return {remaining,files:selected};
  }finally{await provider.close();}
}
