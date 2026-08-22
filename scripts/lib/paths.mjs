import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..', '..');
export const ARTICLES_DIR = path.join(ROOT, 'src', 'content', 'articles');
export const CASES_FILE = path.join(ROOT, 'data', 'cases.json');
export const RANKINGS_FILE = path.join(ROOT, 'data', 'rankings.json');
/** 週次実行の中間出力（gitには含めない） */
export const RUN_OUTPUT_FILE = path.join(ROOT, '.agent-run.json');
