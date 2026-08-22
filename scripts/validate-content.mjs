#!/usr/bin/env node
/**
 * 週次エージェントが書いた内容を機械的に検証する。
 *
 * エージェントはコードで縛られていないため、
 * 「書かれたもの」を後から検証してルール違反を弾く。
 * 検証に落ちたものはコミットされない。
 *
 * 使い方:
 *   node scripts/validate-content.mjs          週次エージェント用の厳格モード
 *   node scripts/validate-content.mjs --local  開発者が手元で内容だけ確認するモード
 *
 * 厳格モードでは次も検証する:
 *   - エージェントが触ってよい場所以外を変更していないこと
 *   - 新しい記事が1本以上追加されていること
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { parseFrontmatter } from './lib/frontmatter.mjs';
import { ARTICLES_DIR, CASES_FILE, RANKINGS_FILE, ROOT } from './lib/paths.mjs';

// 既定は週次エージェント向けの厳格モード。--local で開発者向けに緩める。
const STRICT = !process.argv.includes('--local');

/** エージェントが触ってよい場所 */
const WRITABLE_PREFIXES = ['src/content/articles/', 'data/cases.json', 'data/rankings.json'];

const CATEGORIES = new Set(['research', 'howto', 'digest']);
const MAX_SCORE_DELTA = 1;

const errors = [];
const notes = [];

const fail = (message) => errors.push(message);

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

/** HEAD 時点のファイル内容。存在しなければ null。 */
function gitShow(relativePath) {
  try {
    return execFileSync('git', ['show', `HEAD:${relativePath}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// 1. 変更されたファイルの把握
// ────────────────────────────────────────────────────────────

/** [{ status, file }] 未追跡ファイルも含む */
function changedFiles() {
  return git('status', '--porcelain', '-uall')
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2).trim(),
      file: line.slice(3).replace(/^"|"$/g, ''),
    }));
}

const changes = changedFiles();

// 触ってはいけない場所への変更（厳格モードのみ）
if (STRICT) {
  for (const { status, file } of changes) {
    if (!WRITABLE_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      fail(`変更が許されていないファイルです: ${file}（${status}）`);
    }
  }
}

// 既存記事の変更・削除
const articleChanges = changes.filter((c) => c.file.startsWith('src/content/articles/'));
const newArticles = [];

for (const { status, file } of articleChanges) {
  if (status === '??' || status === 'A') {
    newArticles.push(file);
  } else {
    fail(`既存の記事を変更・削除しています（追加のみ許可）: ${file}（${status}）`);
  }
}

if (newArticles.length === 0 && STRICT) {
  fail('新しい記事が追加されていません。');
}
if (newArticles.length > 1) {
  notes.push(`新しい記事が ${newArticles.length} 本あります。`);
}

// ────────────────────────────────────────────────────────────
// 2. 新しい記事の検証
// ────────────────────────────────────────────────────────────

for (const file of newArticles) {
  const label = path.basename(file);

  if (!file.endsWith('.md')) {
    fail(`${label}: 記事は .md である必要があります。`);
    continue;
  }

  const slug = path.basename(file, '.md');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    fail(`${label}: ファイル名は半角英小文字とハイフンのみにしてください。`);
  }

  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const { data, body, hasFrontmatter } = parseFrontmatter(raw);

  if (!hasFrontmatter) {
    fail(`${label}: frontmatter（--- で囲まれた部分）がありません。`);
    continue;
  }

  for (const key of ['title', 'description', 'pubDate', 'category']) {
    if (!data[key]) fail(`${label}: frontmatter に ${key} がありません。`);
  }

  if (data.category && !CATEGORIES.has(data.category)) {
    fail(`${label}: category は research / howto / digest のいずれかです（${data.category}）。`);
  }

  if (data.author !== 'agent') {
    fail(`${label}: author は agent にしてください（${data.author ?? 'なし'}）。`);
  }

  if (data.pubDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.pubDate))) {
    fail(`${label}: pubDate は YYYY-MM-DD 形式にしてください（${data.pubDate}）。`);
  }

  const tags = Array.isArray(data.tags) ? data.tags.filter(Boolean) : [];
  if (tags.length === 0) fail(`${label}: tags を1つ以上つけてください。`);
  if (tags.length > 5) fail(`${label}: tags は5個までです（${tags.length}個）。`);

  // 出典は記事の信頼性の根拠なので、ここが最も重要な検証
  const sources = Array.isArray(data.sources) ? data.sources : [];
  if (sources.length === 0) {
    fail(`${label}: sources が1件もありません。出典のない記事は公開できません。`);
  }

  for (const [index, source] of sources.entries()) {
    if (!source.title) fail(`${label}: sources[${index}] に title がありません。`);
    let parsed;
    try {
      parsed = new URL(source.url);
    } catch {
      fail(`${label}: sources[${index}] の url が不正です（${source.url ?? 'なし'}）。`);
      continue;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      fail(`${label}: sources[${index}] の url は http(s) にしてください（${source.url}）。`);
    }
  }

  // 本文
  const text = body.trim();
  if (/^#\s/m.test(text)) {
    fail(`${label}: 本文に h1（#）を使わないでください。タイトルは frontmatter が持ちます。`);
  }
  if (text.length < 800) {
    fail(`${label}: 本文が短すぎます（${text.length}文字）。`);
  }

  notes.push(`新規記事: ${label}（${text.length}文字 / 出典 ${sources.length}件）`);
}

// 記事ファイル名の重複（大文字小文字違いなど）
{
  const files = fs.existsSync(ARTICLES_DIR) ? fs.readdirSync(ARTICLES_DIR) : [];
  const seen = new Map();
  for (const file of files.filter((f) => f.endsWith('.md'))) {
    const key = file.toLowerCase();
    if (seen.has(key)) fail(`記事のファイル名が重複しています: ${seen.get(key)} と ${file}`);
    seen.set(key, file);
  }
}

// ────────────────────────────────────────────────────────────
// 3. データファイルの検証
// ────────────────────────────────────────────────────────────

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${label} が壊れています: ${error.message}`);
    return null;
  }
}

const cases = readJson(CASES_FILE, 'data/cases.json');
const previousCases = (() => {
  const raw = gitShow('data/cases.json');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

if (cases) {
  if (!Array.isArray(cases.cases)) {
    fail('data/cases.json: cases が配列ではありません。');
  } else {
    const ids = new Set();
    for (const item of cases.cases) {
      if (!item.id) fail('data/cases.json: id のない項目があります。');
      if (ids.has(item.id)) fail(`data/cases.json: id が重複しています（${item.id}）。`);
      ids.add(item.id);

      if (item.url) {
        try {
          new URL(item.url);
        } catch {
          fail(`data/cases.json: ${item.id} の url が不正です（${item.url}）。`);
        }
      }
      if (item.difficulty != null && !(item.difficulty >= 1 && item.difficulty <= 5)) {
        fail(`data/cases.json: ${item.id} の difficulty は1〜5です（${item.difficulty}）。`);
      }
    }

    // 事例が減っていないか（削除は想定していない）
    if (previousCases?.cases && cases.cases.length < previousCases.cases.length) {
      fail(
        `data/cases.json: 事例が減っています（${previousCases.cases.length} → ${cases.cases.length}）。削除は行わないでください。`
      );
    }
    if (previousCases?.cases && cases.cases.length > previousCases.cases.length) {
      notes.push(`事例カタログ: ${cases.cases.length - previousCases.cases.length}件追加`);
    }
  }
}

const rankings = readJson(RANKINGS_FILE, 'data/rankings.json');
const previousRankings = (() => {
  const raw = gitShow('data/rankings.json');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

if (rankings && previousRankings) {
  const before = new Map(previousRankings.methods.map((m) => [m.id, m]));

  if (rankings.methods.length !== previousRankings.methods.length) {
    fail(
      `data/rankings.json: 手法の数が変わっています（${previousRankings.methods.length} → ${rankings.methods.length}）。`
    );
  }

  let adjustments = 0;

  for (const method of rankings.methods) {
    const old = before.get(method.id);
    if (!old) {
      fail(`data/rankings.json: 未知の手法が追加されています（${method.id}）。`);
      continue;
    }

    for (const [key, value] of Object.entries(method.scores)) {
      if (!(value >= 1 && value <= 5) || !Number.isInteger(value)) {
        fail(`data/rankings.json: ${method.id}.${key} は1〜5の整数です（${value}）。`);
        continue;
      }
      const delta = Math.abs(value - old.scores[key]);
      if (delta > MAX_SCORE_DELTA) {
        fail(
          `data/rankings.json: ${method.id}.${key} の変更幅が大きすぎます（${old.scores[key]} → ${value}）。1回につき1点までです。`
        );
      } else if (delta > 0) {
        adjustments += 1;
        notes.push(`ランキング調整: ${method.name}.${key} ${old.scores[key]} → ${value}`);
      }
    }
  }

  // スコアを動かしたなら理由が残っているはず
  const changelogBefore = previousRankings.changelog?.length ?? 0;
  const changelogAfter = rankings.changelog?.length ?? 0;
  if (adjustments > 0 && changelogAfter <= changelogBefore) {
    fail('data/rankings.json: スコアを変更した場合は changelog に理由を追加してください。');
  }
}

// ────────────────────────────────────────────────────────────
// 出力
// ────────────────────────────────────────────────────────────

const summaryLines = [];

if (notes.length > 0) {
  summaryLines.push('### 今週の変更', '', ...notes.map((note) => `- ${note}`), '');
}

if (errors.length > 0) {
  summaryLines.push('### 検証エラー', '', ...errors.map((error) => `- ${error}`), '');
}

const summary = summaryLines.join('\n');

if (process.env.GITHUB_STEP_SUMMARY && summary) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

for (const note of notes) console.log(`  ${note}`);

if (errors.length > 0) {
  console.error('\n検証に失敗しました:');
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

console.log('\n検証に成功しました。');
