import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { SnapshotManager } from './snapshot.js';
import { RuntimeDoctor } from './doctor.js';
import { RecipeExtractor } from './recipe.js';

test('Snapshot & Rollback Engine', (t) => {
  const testWorkspace = path.join(process.cwd(), 'test-temp-ws');
  fs.mkdirSync(testWorkspace, { recursive: true });

  const dummyFile = path.join(testWorkspace, 'app.txt');
  fs.writeFileSync(dummyFile, 'v1 original content', 'utf-8');

  const sm = new SnapshotManager(testWorkspace);
  const snap = sm.createSnapshot('test-checkpoint');

  assert.ok(snap.id.startsWith('snap_'));
  assert.strictEqual(Object.keys(snap.files).length, 1);

  // Modifica il file originale e crea un file nuovo indesiderato
  fs.writeFileSync(dummyFile, 'v2 corrupted content', 'utf-8');
  const unwantedFile = path.join(testWorkspace, 'bad_script.js');
  fs.writeFileSync(unwantedFile, 'console.log("bad")', 'utf-8');

  // Esegue il rollback
  const rollbackResult = sm.rollback(snap.id);
  assert.strictEqual(rollbackResult.restored.length, 1);
  assert.strictEqual(rollbackResult.deleted.length, 1);

  // Verifica che il file originale sia tornato v1 e che il file indesiderato sia stato cancellato
  assert.strictEqual(fs.readFileSync(dummyFile, 'utf-8'), 'v1 original content');
  assert.ok(!fs.existsSync(unwantedFile));

  // Pulizia
  fs.rmSync(testWorkspace, { recursive: true, force: true });
});

test('Runtime Doctor Diagnostic', () => {
  const doctor = new RuntimeDoctor();
  const sampleError = 'Error: listen EADDRINUSE: address already in use :::3000';
  const diag = doctor.diagnoseError(sampleError);

  assert.strictEqual(diag.hasConflict, true);
  assert.strictEqual(diag.issueType, 'PORT_IN_USE');
  assert.ok(diag.summary.includes('3000'));
});

test('Recipe Extractor', () => {
  const testWorkspace = path.join(process.cwd(), 'test-temp-ws-recipe');
  const extractor = new RecipeExtractor(testWorkspace);

  extractor.recordCommand({
    command: 'npm install',
    exitCode: 0,
    timestamp: new Date().toISOString(),
    durationMs: 1200
  });

  extractor.recordCommand({
    command: 'broken-command --fail',
    exitCode: 1,
    timestamp: new Date().toISOString(),
    durationMs: 300
  });

  extractor.recordCommand({
    command: 'npm run build',
    exitCode: 0,
    timestamp: new Date().toISOString(),
    durationMs: 2500
  });

  const recipe = extractor.generateRecipe();
  assert.strictEqual(recipe.blueprintCommands.length, 2);
  assert.deepStrictEqual(recipe.blueprintCommands, ['npm install', 'npm run build']);

  fs.rmSync(testWorkspace, { recursive: true, force: true });
});
