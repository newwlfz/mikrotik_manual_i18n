/**
 * Blocks translated by the model, kept so a later offline `apply` cannot throw
 * them away. The legacy memory is read-only and rebuilt from the old projects;
 * this file is the append-only record of everything this pipeline produced.
 */

import fs from 'node:fs';
import path from 'node:path';
import {WORK_DIR, ensureDir} from './paths.mjs';

export const MODEL_MEMORY = path.join(WORK_DIR, 'model-memory.json');

export function loadModelMemory() {
  if (!fs.existsSync(MODEL_MEMORY)) return new Map();
  return new Map(Object.entries(JSON.parse(fs.readFileSync(MODEL_MEMORY, 'utf8'))));
}

export function saveModelMemory(memory) {
  ensureDir(path.dirname(MODEL_MEMORY));
  fs.writeFileSync(MODEL_MEMORY, JSON.stringify(Object.fromEntries(memory)));
}
