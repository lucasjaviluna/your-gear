import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analysisPrompt, assessTask, type TaskRoute } from '../src/assessment.ts';

const cases: [string, TaskRoute][] = [
  ['Renombrar una variable local en el parser.', 'simple'],
  ['Cambiar el texto de un botón.', 'simple'],
  ['En el archivo src/ui/errors.ts, cambiar únicamente el texto del mensaje de error de login para que sea más claro para la persona usuaria.', 'simple'],
  ['Fix the typo in the button label.', 'simple'],
  ['Implementar reintentos para llamadas HTTP fallidas.', 'task'],
  ['Cambiar el texto de un botón y luego sincronizar el flujo.', 'task'],
  ['Agregar una pantalla de búsqueda.', 'task'],
  ['Agregar permisos por rol a toda la aplicación.', 'sdd'],
  ['Migrar el esquema de sesiones.', 'sdd'],
  ['Change button label and update API contracts.', 'sdd'],
  ['Modificar la autenticación.', 'sdd'],
  ['Mejorar el sistema de sesiones.', 'clarify'],
  ['Optimizar la aplicación.', 'clarify'],
  ['Improve the system.', 'clarify'],
  ['Arreglalo', 'clarify'],
  ['', 'clarify'],
];
for (const [prompt, route] of cases) {
  test('assessment: ' + (prompt || '(vacío)'), () => {
    const result = assessTask(prompt);
    assert.equal(result.recommendedRoute, route);
    assert.equal(result.source, 'deterministic');
    assert.ok(result.reasons.length);
    assert.deepEqual(assessTask(prompt), result);
    if (route === 'clarify') assert.ok(result.unknowns.length);
    assert.equal('authorized' in result, false);
  });
}

test('la longitud no altera la ruta por sí sola y los riesgos tienen prioridad', () => {
  assert.equal(assessTask('Cambiar el texto del botón. ' + 'Debe ser claro. '.repeat(100)).recommendedRoute, 'simple');
  assert.equal(assessTask('Migración').recommendedRoute, 'sdd');
  const risk = assessTask('Cambiar texto, permisos y contratos API');
  assert.deepEqual(risk.affectedAreas, ['contracts', 'security']);
});

test('modo análisis exige texto y no acepta opciones de ejecución', () => {
  assert.equal(analysisPrompt(['Cambiar', 'texto']), 'Cambiar texto');
  assert.equal(analysisPrompt(['--', '--persist']), '--persist');
  for (const args of [[], [' '], ['--persist', 'tarea'], ['--continue', 'tarea'], ['--skill', 'SKILL.md'], ['--mcp', 'fixture'], ['tarea', '--mcp']]) {
    assert.throws(() => analysisPrompt(args), /Uso|no admite/);
  }
});
