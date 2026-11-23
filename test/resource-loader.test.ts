import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DefaultResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent';
import { resolveSkill } from '../src/skills.ts';
import { parseSessionArgs } from '../src/sessions.ts';

test('el loader del SDK omite skills del proyecto cuando están deshabilitadas', async t => {
  const root = mkdtempSync(join(tmpdir(), 'your-gear-loader-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'workspace');
  const agentDir = join(root, 'agent');
  const skillDir = join(cwd, '.agents', 'skills', 'sample');
  mkdirSync(skillDir, { recursive: true });
  mkdirSync(agentDir);
  writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: sample\ndescription: Sample skill\n---\n\nExample.\n');

  const settingsManager = SettingsManager.inMemory();
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager, noExtensions: true, noSkills: true,
    noPromptTemplates: true, noThemes: true, noContextFiles: true,
  });
  await loader.reload();
  assert.deepEqual(loader.getSkills().skills, []);

  const explicit = new DefaultResourceLoader({
    cwd, agentDir, settingsManager, noExtensions: true, noSkills: true,
    noPromptTemplates: true, noThemes: true, noContextFiles: true,
    additionalSkillPaths: [skillDir],
  });
  await explicit.reload();
  assert.deepEqual(explicit.getSkills().skills.map(skill => skill.name), ['sample']);
});

test('selección explícita limita skills a archivos SKILL.md dentro del workspace', t => {
  const root = mkdtempSync(join(tmpdir(), 'your-gear-skill-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cwd = join(root, 'workspace');
  const outside = join(root, 'outside');
  mkdirSync(cwd);
  mkdirSync(outside);
  writeFileSync(join(cwd, 'SKILL.md'), 'example');
  writeFileSync(join(outside, 'SKILL.md'), 'outside');
  symlinkSync(outside, join(cwd, 'link'), 'junction');
  assert.equal(resolveSkill(cwd, 'SKILL.md'), join(cwd, 'SKILL.md'));
  assert.throws(() => resolveSkill(cwd, '../outside/SKILL.md'), /workspace/);
  assert.throws(() => resolveSkill(cwd, 'link/SKILL.md'), /workspace/);
  assert.throws(() => resolveSkill(cwd, '.your-gear/SKILL.md'), /workspace/);
  assert.throws(() => resolveSkill(cwd, 'other.txt'), /SKILL.md/);
  assert.deepEqual(parseSessionArgs(['--persist', '--skill', 'SKILL.md', 'hola']), {
    mode: 'persist', skillPath: 'SKILL.md', promptArgs: ['hola'],
  });
  assert.throws(() => parseSessionArgs(['--skill']), /ruta de skill/);
  assert.throws(() => parseSessionArgs(['--skill', 'a', '--skill', 'b']), /una sola/);
});
