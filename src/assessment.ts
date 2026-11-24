export type TaskRoute = 'simple' | 'task' | 'sdd' | 'clarify';
export type Assessment = {
  recommendedRoute: TaskRoute;
  source: 'deterministic';
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  affectedAreas: string[];
  unknowns: string[];
};

type Signal = { pattern: RegExp; area: string; reason: string };

const riskSignals: Signal[] = [
  { pattern: /\b(api|endpoint(s)?|contratos?|contracts?|breaking change)\b/, area: 'contracts', reason: 'Posible impacto en contratos o interfaces.' },
  { pattern: /\b(migra(r|cion|ciones|te|tion)|schema|esquemas?|base(s)? de datos|database(s)?|datos persistentes)\b/, area: 'data', reason: 'Posible impacto en datos o migraciones.' },
  { pattern: /\b(seguridad|security|permisos?|permissions?|roles?|autenticacion|autorizacion|authentication|authorization|auth|oauth|credenciales|credentials)\b/, area: 'security', reason: 'Posible impacto en seguridad o control de acceso.' },
  { pattern: /\b(arquitectura|architecture|compatibilidad|compatibility|retrocompatibilidad|toda la aplicacion|todos los modulos|varios servicios|cross.module)\b/, area: 'architecture', reason: 'Posible impacto transversal o arquitectónico.' },
];

const taskSignals: Signal[] = [
  { pattern: /\b(reintentos?|retries|retry|refresh token|flujos?|workflows?|integracion(es)?|integration(s)?|sincronizacion|sync)\b/, area: 'workflow', reason: 'Requiere coordinar comportamiento o decisiones.' },
  { pattern: /\b(varios|varias|multiples|multiple|end.to.end|e2e|y luego|and then|y ademas|ademas de|tambien)\b/, area: 'multi-step', reason: 'El alcance sugiere varios pasos o componentes.' },
];

const localChange = /\b(cambia(r)?|corrige|corregir|actualiza(r)?|ajusta(r)?|fix|change|update|replace)\b.*\b(typo|ortografia|texto|copy|literal|label|etiqueta|mensaje de error|error message)\b|\b(renombra(r)?|rename)\b.*\b(variable|constante|constant|local function|funcion local)\b/;
const explicitTarget = /\b(boton|button|pantalla|screen|archivo|file|variable|constante|constant|mensaje de error|error message|typo|ortografia|parser|funcion local|local function)\b|\b[\w/-]+\.(ts|tsx|js|jsx|css|html|md|json)\b/;
const vague = /^(mejorar?|optimizar?|actualizar?|arreglar?|revisar?|cambiar?|implementar?|fix|improve|optimize|update|review|change|implement)\s+(?:(el|la|los|las|un|una|the|a)\s+)?(sistema|proyecto|aplicacion|app|system|project|proceso|process|flujo|workflow|experiencia|sesiones|sessions)\b/;
const bare = /^(mejorar|optimizar|actualizar|arreglar|revisar|cambiar|implementar|ayuda|fix|improve|update|help|hacerlo|arreglalo|continua|continue|do it)[.!? ]*$/;

function result(recommendedRoute: TaskRoute, confidence: Assessment['confidence'], reasons: string[], affectedAreas: string[] = [], unknowns: string[] = []): Assessment {
  return { recommendedRoute, source: 'deterministic', confidence, reasons, affectedAreas, unknowns };
}

/** Pure text-based recommendation. No filesystem, model, tools or authorization. */
export function assessTask(prompt: string): Assessment {
  const text = prompt.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const risks = riskSignals.filter(signal => signal.pattern.test(text));
  if (risks.length) return result('sdd', 'high', risks.map(s => s.reason), [...new Set(risks.map(s => s.area))]);

  const local = localChange.test(text) && explicitTarget.test(text);
  if (!text || bare.test(text) || (vague.test(text) && !local)) {
    return result('clarify', 'low', ['No hay suficiente detalle para acotar el objetivo.'], [], ['¿Qué resultado concreto se espera y qué parte queda dentro del alcance?']);
  }
  const tasks = taskSignals.filter(signal => signal.pattern.test(text));
  if (tasks.length) return result('task', 'medium', tasks.map(s => s.reason), [...new Set(tasks.map(s => s.area))]);
  if (local) return result('simple', 'medium', ['Cambio textual o mecánico con objetivo localizado.'], ['local']);
  return result('task', 'low', ['No hay evidencia suficiente para recomendar una ejecución simple.'], [], ['Confirmar alcance y criterios de aceptación.']);
}

/** Dedicated opt-in command. Flags cannot silently activate sessions or extensions. */
export function analysisPrompt(args: readonly string[]): string {
  const tokens = args[0] === '--' ? args.slice(1) : args;
  if (args[0] !== '--' && tokens.some(token => token.startsWith('--'))) {
    throw new Error('El modo --analyze-only no admite otras opciones; usá -- para texto literal.');
  }
  const prompt = tokens.join(' ').trim();
  if (!prompt) throw new Error('Uso: your-gear --analyze-only "tu tarea"');
  return prompt;
}
