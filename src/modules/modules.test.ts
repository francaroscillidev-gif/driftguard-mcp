import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { SnapshotManager } from './snapshot.js';
import { RuntimeDoctor } from './doctor.js';
import { RecipeExtractor } from './recipe.js';
import { SafetyGuardrail } from './safety.js';

test('Snapshot, Diff Preview & Rollback Engine', () => {
  const testWorkspace = path.join(process.cwd(), 'test-temp-ws-v110');
  fs.mkdirSync(testWorkspace, { recursive: true });

  const dummyFile = path.join(testWorkspace, 'app.txt');
  fs.writeFileSync(dummyFile, 'line 1\nline 2 original\n', 'utf-8');

  const sm = new SnapshotManager(testWorkspace);
  const snap = sm.createSnapshot('test-checkpoint');

  // Modifica file e crea file spazzatura
  fs.writeFileSync(dummyFile, 'line 1\nline 2 corrupted\nline 3 extra\n', 'utf-8');
  const garbage = path.join(testWorkspace, 'temp_garbage.tmp');
  fs.writeFileSync(garbage, 'garbage', 'utf-8');

  // 1. Verifica anteprima visiva diff
  const preview = sm.previewRollback(snap.id);
  assert.strictEqual(preview.totalChanges, 2);
  const modDiff = preview.diffs.find((d) => d.file === 'app.txt');
  assert.ok(modDiff);
  assert.strictEqual(modDiff.status, 'MODIFIED');
  assert.ok(modDiff.diffPreview.includes('- line 2 original'));
  assert.ok(modDiff.diffPreview.includes('+ line 2 corrupted'));

  // 2. Esegue il rollback
  const rollbackResult = sm.rollback(snap.id);
  assert.strictEqual(rollbackResult.restored.length, 1);
  assert.strictEqual(rollbackResult.deleted.length, 1);

  assert.strictEqual(fs.readFileSync(dummyFile, 'utf-8'), 'line 1\nline 2 original\n');
  assert.ok(!fs.existsSync(garbage));

  fs.rmSync(testWorkspace, { recursive: true, force: true });
});

test('Safety Guardrail Interceptor', () => {
  const guard = new SafetyGuardrail();

  const res1 = guard.evaluateCommand('rm -rf /');
  assert.strictEqual(res1.verdict, 'CRITICAL_BLOCK');
  assert.strictEqual(res1.riskScore, 100);

  const res2 = guard.evaluateCommand('chmod 777 -R /');
  assert.strictEqual(res2.verdict, 'CRITICAL_BLOCK');

  const res3 = guard.evaluateCommand('DROP DATABASE production;');
  assert.strictEqual(res3.verdict, 'WARNING');

  const res4 = guard.evaluateCommand('npm test');
  assert.strictEqual(res4.verdict, 'SAFE');
  assert.strictEqual(res4.riskScore, 0);
});

test('Advanced Runtime Doctor (OOM, Missing modules & Env)', () => {
  const doctor = new RuntimeDoctor();

  // OOM
  const diagOom = doctor.diagnoseError('FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory');
  assert.strictEqual(diagOom.issueType, 'OUT_OF_MEMORY');
  assert.ok(diagOom.actionableFix.includes('--max-old-space-size'));

  // Missing Node Module
  const diagNode = doctor.diagnoseError("Error: Cannot find module 'express'");
  assert.strictEqual(diagNode.issueType, 'MISSING_DEPENDENCY');
  assert.ok(diagNode.actionableFix.includes('npm install express'));

  // Missing Python Module
  const diagPy = doctor.diagnoseError("ModuleNotFoundError: No module named 'torch'");
  assert.strictEqual(diagPy.issueType, 'MISSING_DEPENDENCY');
  assert.ok(diagPy.actionableFix.includes('pip install torch'));

  // Missing Env Var
  const diagEnv = doctor.diagnoseError('process.env.DATABASE_URL is undefined');
  assert.strictEqual(diagEnv.issueType, 'MISSING_ENV_VAR');
  assert.ok(diagEnv.actionableFix.includes('DATABASE_URL'));
});
