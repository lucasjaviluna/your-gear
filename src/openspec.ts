import { lstatSync, opendirSync, realpathSync } from 'node:fs';
import { isAbsolute, join, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { safePreview } from './verification-evidence.ts';

type PathState = 'present'|'missing'|'unsafe'|'unreadable';
function entryState(path:string, kind:'file'|'directory'):PathState {
  try {
    const s=lstatSync(path);
    return !s.isSymbolicLink() && (kind==='directory'?s.isDirectory():s.isFile()&&s.nlink===1)
      ? 'present':'unsafe';
  } catch(e) {
    return (e as NodeJS.ErrnoException).code==='ENOENT'?'missing':'unreadable';
  }
}
const changeId=(id:string)=>id.length<=80&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)&&id!=='archive';
type Candidate={id:string;proposal:PathState;design:PathState;tasks:PathState;metadata:PathState;specs:PathState};
type Discovery = {
  root:PathState; config:PathState|'not-inspected'; specs:PathState|'not-inspected';
  changes:PathState|'not-inspected'; candidates:Candidate[]; scanLimited:boolean; ignoredEntries:number;
  resolution:'local-markers-only'; cli:'not-probed'; ready:false;
};
/** An inventory, not an OpenSpec root resolver or a validation of a change. */
export function discoverOpenSpec(cwd:string, signal?:AbortSignal):Discovery {
  signal?.throwIfAborted();
  const root=join(realpathSync(cwd),'openspec');
  const result:Discovery={root:entryState(root,'directory'),config:'not-inspected',specs:'not-inspected',
    changes:'not-inspected',candidates:[],scanLimited:false,ignoredEntries:0,
    resolution:'local-markers-only',cli:'not-probed',ready:false};
  if(result.root!=='present')return result;
  result.config=entryState(join(root,'config.yaml'),'file');
  result.specs=entryState(join(root,'specs'),'directory');
  const changes=join(root,'changes');
  result.changes=entryState(changes,'directory');
  if(result.changes!=='present')return result;
  try {
    const dir=opendirSync(changes);
    try {
      let scanned=0;
      for(;;) {
        signal?.throwIfAborted();
        const e=dir.readSync();
        if(!e)break;
        if(++scanned>100){result.scanLimited=true;break;}
        if(e.name==='archive')continue;
        const path=join(changes,e.name);
        if(!changeId(e.name)||!e.isDirectory()||entryState(path,'directory')!=='present'){result.ignoredEntries++;continue;}
        if(result.candidates.length>=20){result.scanLimited=true;break;}
        result.candidates.push({id:e.name,proposal:entryState(join(path,'proposal.md'),'file'),
          design:entryState(join(path,'design.md'),'file'),tasks:entryState(join(path,'tasks.md'),'file'),
          metadata:entryState(join(path,'.openspec.yaml'),'file'),specs:entryState(join(path,'specs'),'directory')});
      }
    }finally{dir.closeSync();}
  }catch {
    signal?.throwIfAborted();
    result.changes='unreadable';result.candidates=[];
  }
  result.candidates.sort((a,b)=>a.id.localeCompare(b.id));
  return result;
}

type Command={kind:'status'}|{kind:'probe';path:string};
export function parseSddCommand(args:readonly string[]):Command {
  if(args.length===1&&args[0]==='status')return {kind:'status'};
  if(args.length===2&&args[0]==='probe'&&isAbsolute(args[1])&&!/[\x00-\x1f\x7f]/.test(args[1]))return {kind:'probe',path:args[1]};
  throw new Error('Uso: your-gear sdd status | your-gear sdd probe /ruta/absoluta/openspec');
}
function binary(path:string) {
  if(!isAbsolute(path)||/[\x00-\x1f\x7f]/.test(path))throw Error('Indicá una ruta absoluta al ejecutable.');
  const canonical=realpathSync(path);
  const s=lstatSync(canonical);
  if(!s.isFile()||s.isSymbolicLink()||(process.platform==='win32'&&extname(canonical).toLowerCase()!=='.exe'))throw Error('Seleccioná un ejecutable regular (en Windows, .exe nativo).');
  return {path:canonical,dev:s.dev,ino:s.ino,size:s.size,mtime:s.mtimeMs,ctime:s.ctimeMs};
}
export function parseReportedVersion(output:string):string {
  const match=/^(?:v)?([0-9]{1,8}\.[0-9]{1,8}\.[0-9]{1,8}(?:-[0-9A-Za-z.-]{1,80})?(?:\+[0-9A-Za-z.-]{1,80})?)$/.exec(output.trim());
  if(!match)throw Error('El ejecutable no devolvió una versión reconocible.');
  return match[1];
}
/** This is an explicitly authorized process, not a safe sandbox or compatibility check. */
export async function probeOpenSpec(path:string,options:{
  cwd:string;interactive:boolean;approve:(description:string)=>Promise<boolean>;signal:AbortSignal;
}):Promise<{status:'reported';version:string;compatibility:'not-validated'}>{
  options.signal.throwIfAborted();
  if(!options.interactive)throw Error('OpenSpec probe requiere una terminal interactiva.');
  const before=binary(path);
  const cwd=realpathSync(options.cwd);
  const approved=await options.approve('ejecutar el binario local (sin LLM, no sandbox, puede acceder al entorno y filesystem):\n'+safePreview({executable:before.path,args:['--version'],cwd}));
  options.signal.throwIfAborted();
  if(!approved)throw Error('Inicio de OpenSpec no autorizado.');
  if(JSON.stringify(binary(path))!==JSON.stringify(before))throw Error('El ejecutable cambió durante la aprobación.');
  const env:NodeJS.ProcessEnv={...process.env,OPENSPEC_TELEMETRY:'0',DO_NOT_TRACK:'1',OPENSPEC_NO_UPDATE_CHECK:'1'};
  delete env.NODE_OPTIONS;delete env.NODE_PATH;
  const output=await new Promise<string>((resolve,reject)=>{
    execFile(before.path,['--version'],{cwd,shell:false,env,timeout:10000,maxBuffer:8192,encoding:'utf8',windowsHide:true,signal:options.signal},
      (error,stdout)=>error?reject(Error('No se pudo consultar la versión de OpenSpec; verificá el ejecutable.')):resolve(stdout));
  });
  options.signal.throwIfAborted();
  return {status:'reported',version:parseReportedVersion(output),compatibility:'not-validated'};
}
