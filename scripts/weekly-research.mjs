#!/usr/bin/env node
/**
 * 週次リサーチエージェント。
 *
 *   1. Web検索でAI収益化の実例・動きを調査する
 *   2. 調査結果を記事Markdown・事例カタログの更新・ランキング調整に構造化する
 *   3. リポジトリに書き戻し、ニュースレター配信用のペイロードを出力する
 *
 * 使い方:
 *   node scripts/weekly-research.mjs [--dry-run]
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { compose, createClient, research } from './lib/anthropic.mjs';
import { serializeFrontmatter, parseFrontmatter, toDateString } from './lib/frontmatter.mjs';
import { ARTICLES_DIR, CASES_FILE, RANKINGS_FILE, RUN_OUTPUT_FILE } from './lib/paths.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const TODAY = new Date();
const TODAY_STR = toDateString(TODAY);
const WEEK_AGO_STR = toDateString(new Date(TODAY.getTime() - 7 * 86_400_000));

const log = (message) => console.log(`[weekly-research] ${message}`);

// ────────────────────────────────────────────────────────────
// 既存コンテンツの読み込み
// ────────────────────────────────────────────────────────────

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function readExistingArticles() {
  const files = await fs.readdir(ARTICLES_DIR).catch(() => []);
  const articles = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const raw = await fs.readFile(path.join(ARTICLES_DIR, file), 'utf8');
    const { data } = parseFrontmatter(raw);
    articles.push({
      slug: file.replace(/\.md$/, ''),
      title: data.title ?? file,
      pubDate: data.pubDate ?? '',
      category: data.category ?? '',
      description: data.description ?? '',
      draft: data.draft === true,
    });
  }

  return articles.sort((a, b) => String(b.pubDate).localeCompare(String(a.pubDate)));
}

// ────────────────────────────────────────────────────────────
// プロンプト
// ────────────────────────────────────────────────────────────

const RESEARCH_SYSTEM = `あなたは「AI Monetize Lab」というメディアのリサーチ担当です。
AIを使って実際に収益を上げているサービス・サイト・個人の事例を調べ、
「何で稼いでいるのか」「どう再現できるのか」を構造として書き残すことが仕事です。

守るべきルール:
- 売上・利用者数・料金などの具体的な数値は、一次情報（公式サイト、公式ブログ、公式ドキュメント、
  決算資料、当事者本人の投稿）で確認できたものだけを書く。
- 確認できなかった数値は書かない。推測で埋めない。「未確認」と明示する。
- 二次情報しかない主張は、必ず「〜と報じられている」と出典付きで書く。
- 日本語で書く。事実と解釈を混ぜない。
- 誇大な表現（「誰でも」「必ず」「簡単に」）を使わない。`;

function researchPrompt(existingArticles, cases) {
  const covered = existingArticles
    .slice(0, 30)
    .map((article) => `- ${article.title}`)
    .join('\n');

  const catalog = cases
    .map(
      (item) =>
        `- ${item.id} / ${item.name}（${item.url}）現在の料金記載: ${item.pricing ?? '未確認'} / 最終確認: ${item.lastChecked ?? '未確認'}`
    )
    .join('\n');

  return `今日は ${TODAY_STR} です。${WEEK_AGO_STR} 以降の動きを中心に調査してください。

## タスク1: 今週取り上げる収益化事例を1つ選び、深く調べる

AIで収益を上げている具体的なサービス・プロダクト・個人の取り組みを調査し、
今週の記事にできるものを1つ選んでください。次を満たすものを優先します。

- 収益モデルが公開情報から具体的に分かる（料金体系、課金単位、プラン構成）
- 読者（個人〜小規模チーム）が構造を学べる、または部分的に真似できる
- 下記の「すでに扱ったテーマ」と重複しない

選んだ事例について、次を一次情報で確認してください。
- 何を提供しているか
- 誰に何の対価として課金しているか（課金単位、プラン、価格）
- 収益モデルの弱点・リスク（原価構造、競合、依存先）
- 個人が同じ構造を小さく再現するとしたら、何が必要で何が障壁か

## タスク2: 既存カタログの更新確認

以下の掲載済み事例について、料金ページや公式発表を確認し、
料金の変更・提供終了・プラン改定があれば記録してください。
確認できたものだけ報告し、確認できなかったものは触れないでください。

${catalog}

## すでに扱ったテーマ（重複を避ける）

${covered || '（まだ記事はありません）'}

## 出力

調査結果を日本語のメモとしてまとめてください。
確認できた事実には必ずURLを添えてください。確認できなかった点は「未確認」と明記してください。
このメモは次の工程で記事に構造化されるので、記事の体裁に整える必要はありません。`;
}

const COMPOSE_SYSTEM = `あなたは「AI Monetize Lab」の編集者です。
リサーチメモを、そのまま公開できる日本語の記事と、サイトのデータ更新に構造化します。

記事の書き方:
- 読者は、AIで収益化したい個人〜小規模チームの実務者。
- 「調べたことを並べる」のではなく「読者が判断に使える形」に構造化する。
- 見出し（## / ###）で分け、必要に応じて表や箇条書きを使う。
- 数値を書くときは、必ず出典で確認できたものに限る。確認できていない数値は書かない。
- 「まとめ」で締め、読者が次に何を検証すべきかを示す。
- 本文は 2000〜3500 字程度。誇大な表現は使わない。
- 本文の Markdown に frontmatter（--- で囲まれた部分）は含めない。h1（#）も使わない。`;

function composePrompt(brief, sources, existingArticles, cases, rankings) {
  return `以下は今週のリサーチメモです。これをもとに記事とデータ更新を作ってください。

## リサーチメモ

${brief}

## 調査中に参照したURL一覧

${sources.map((source) => `- ${source.title} — ${source.url}`).join('\n') || '（なし）'}

## 既存の記事スラッグ（重複しない slug を付ける）

${existingArticles.map((article) => article.slug).join(', ') || '（なし）'}

## 既存の事例カタログ（id と現在の値）

${JSON.stringify(cases, null, 1)}

## 現在のランキング

${JSON.stringify(rankings.methods.map((method) => ({ id: method.id, name: method.name, scores: method.scores })), null, 1)}

## 指示

1. article: 今週の記事。slug は半角英小文字とハイフンのみ。category は事例中心なら research、
   手法の解説中心なら howto を選ぶ。sources にはリサーチメモで実際に根拠として使ったURLだけを入れる。
2. newsletter: この記事を知らせるメールの件名と導入文。件名は40字以内。導入文は3行以内。
3. case_updates: 事例カタログの更新。一次情報で確認できた変更だけを入れる。
   既存 id の更新は action="update"、新規追加は action="add"。何もなければ空配列。
   pricing は確認できた場合のみ文字列で入れ、確認できなければ null にする。
4. ranking_adjustments: ランキングのスコアを変えるべき根拠が今週の調査で得られた場合のみ入れる。
   変更幅は1点までとし、理由を書く。根拠がなければ空配列にする。空配列が普通の状態です。`;
}

// ────────────────────────────────────────────────────────────
// 出力スキーマ
// ────────────────────────────────────────────────────────────

const sourceSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    url: { type: 'string' },
    publisher: { type: 'string' },
  },
  required: ['title', 'url'],
  additionalProperties: false,
};

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    article: {
      type: 'object',
      properties: {
        slug: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' },
        title: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string', enum: ['research', 'howto', 'digest'] },
        tags: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
        body_markdown: { type: 'string' },
        sources: { type: 'array', items: sourceSchema },
      },
      required: ['slug', 'title', 'description', 'category', 'tags', 'body_markdown', 'sources'],
      additionalProperties: false,
    },
    newsletter: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        intro: { type: 'string' },
        updates: { type: 'array', items: { type: 'string' } },
      },
      required: ['subject', 'intro', 'updates'],
      additionalProperties: false,
    },
    case_updates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'update'] },
          id: { type: 'string' },
          name: { type: 'string' },
          url: { type: 'string' },
          segment: { type: 'string' },
          models: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
          monetization: { type: 'string' },
          pricing: { type: ['string', 'null'] },
          revenueNote: { type: 'string' },
          difficulty: { type: 'integer', minimum: 1, maximum: 5 },
          status: { type: 'string', enum: ['active', 'discontinued', 'unknown'] },
          sources: { type: 'array', items: sourceSchema },
          changeNote: { type: 'string' },
        },
        required: ['action', 'id', 'changeNote'],
        additionalProperties: false,
      },
    },
    ranking_adjustments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          criterion: { type: 'string' },
          newScore: { type: 'integer', minimum: 1, maximum: 5 },
          reason: { type: 'string' },
        },
        required: ['id', 'criterion', 'newScore', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['article', 'newsletter', 'case_updates', 'ranking_adjustments'],
  additionalProperties: false,
};

// ────────────────────────────────────────────────────────────
// 書き込み
// ────────────────────────────────────────────────────────────

async function uniqueSlug(slug, existingArticles) {
  const taken = new Set(existingArticles.map((article) => article.slug));
  if (!taken.has(slug)) return slug;

  for (let suffix = 2; suffix < 50; suffix += 1) {
    const candidate = `${slug}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

/**
 * frontmatter のスキーマ検証（src/content.config.ts）はビルド時に走るため、
 * 壊れたURLが1つ混ざるだけでサイト全体のビルドが落ちる。書き出す前に落としておく。
 */
function sanitizeSources(sources) {
  const seen = new Set();
  const valid = [];

  for (const source of sources ?? []) {
    let url;
    try {
      url = new URL(source.url);
    } catch {
      log(`不正なURLのため出典から除外しました: ${source.url}`);
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    if (seen.has(url.href)) continue;

    seen.add(url.href);
    valid.push({
      title: source.title?.trim() || url.hostname,
      url: url.href,
      ...(source.publisher ? { publisher: source.publisher } : {}),
    });
  }

  return valid;
}

function buildArticleFile(article) {
  const frontmatter = serializeFrontmatter({
    title: article.title,
    description: article.description,
    pubDate: TODAY_STR,
    category: article.category,
    tags: article.tags.map((tag) => tag.trim()).filter(Boolean),
    author: 'agent',
    sources: sanitizeSources(article.sources),
  });

  return `${frontmatter}${article.body_markdown.trim()}\n`;
}

/** 一次情報で確認できた更新だけをカタログに反映する */
function applyCaseUpdates(casesData, updates) {
  const applied = [];

  for (const update of updates) {
    const existing = casesData.cases.find((item) => item.id === update.id);

    if (update.action === 'update') {
      if (!existing) continue;

      for (const key of [
        'name', 'url', 'segment', 'models', 'summary',
        'monetization', 'pricing', 'revenueNote', 'difficulty', 'status',
      ]) {
        if (update[key] !== undefined) existing[key] = update[key];
      }

      if (update.sources?.length) existing.sources = sanitizeSources(update.sources);
      existing.lastChecked = TODAY_STR;
      existing.verified = true;
      applied.push(`更新: ${existing.name} — ${update.changeNote}`);
    } else if (update.action === 'add' && !existing) {
      casesData.cases.push({
        id: update.id,
        name: update.name ?? update.id,
        url: update.url ?? '',
        segment: update.segment ?? 'その他',
        models: update.models ?? [],
        summary: update.summary ?? '',
        monetization: update.monetization ?? '',
        pricing: update.pricing ?? null,
        revenueNote: update.revenueNote ?? '未検証',
        startedYear: null,
        difficulty: update.difficulty ?? 3,
        verified: true,
        lastChecked: TODAY_STR,
        status: update.status ?? 'active',
        sources: sanitizeSources(update.sources),
      });
      applied.push(`追加: ${update.name ?? update.id} — ${update.changeNote}`);
    }
  }

  casesData.updatedAt = TODAY_STR;
  return applied;
}

/** スコア変更は1点までに制限し、理由を changelog に残す */
function applyRankingAdjustments(rankingsData, adjustments) {
  const validKeys = new Set(rankingsData.criteria.map((criterion) => criterion.key));
  const applied = [];

  rankingsData.changelog ??= [];

  for (const adjustment of adjustments) {
    const method = rankingsData.methods.find((item) => item.id === adjustment.id);
    if (!method || !validKeys.has(adjustment.criterion)) continue;

    const current = method.scores[adjustment.criterion];
    if (typeof current !== 'number') continue;

    const clamped = Math.max(1, Math.min(5, adjustment.newScore));
    const delta = clamped - current;
    if (delta === 0) continue;

    // 1回の更新で動かせるのは1点まで
    const next = current + Math.sign(delta);
    method.scores[adjustment.criterion] = next;

    const entry = `${method.name} の「${adjustment.criterion}」を ${current} → ${next}：${adjustment.reason}`;
    rankingsData.changelog.unshift({ date: TODAY_STR, note: entry });
    applied.push(entry);
  }

  rankingsData.changelog = rankingsData.changelog.slice(0, 20);
  rankingsData.updatedAt = TODAY_STR;
  return applied;
}

// ────────────────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────────────────

async function main() {
  const client = createClient();

  const [existingArticles, casesData, rankingsData] = await Promise.all([
    readExistingArticles(),
    readJson(CASES_FILE),
    readJson(RANKINGS_FILE),
  ]);

  log(`既存記事 ${existingArticles.length}件 / 事例 ${casesData.cases.length}件を読み込みました`);

  log('調査フェーズを開始します（Web検索）…');
  const brief = await research({
    client,
    system: RESEARCH_SYSTEM,
    prompt: researchPrompt(existingArticles, casesData.cases),
    onProgress: log,
  });
  log(`調査完了。参照URL ${brief.sources.length}件`);

  log('構造化フェーズを開始します…');
  const { data, usage } = await compose({
    client,
    system: COMPOSE_SYSTEM,
    prompt: composePrompt(
      brief.text,
      brief.sources,
      existingArticles,
      casesData.cases,
      rankingsData
    ),
    schema: OUTPUT_SCHEMA,
  });

  const slug = await uniqueSlug(data.article.slug, existingArticles);
  const articlePath = path.join(ARTICLES_DIR, `${slug}.md`);
  const articleFile = buildArticleFile(data.article);

  const caseNotes = applyCaseUpdates(casesData, data.case_updates);
  const rankingNotes = applyRankingAdjustments(rankingsData, data.ranking_adjustments);

  const runOutput = {
    generatedAt: new Date().toISOString(),
    slug,
    article: {
      slug,
      title: data.article.title,
      description: data.article.description,
      category: data.article.category,
      path: `/articles/${slug}/`,
      sourceCount: sanitizeSources(data.article.sources).length,
    },
    newsletter: {
      slug: TODAY_STR,
      subject: data.newsletter.subject,
      intro: data.newsletter.intro,
      updates: [...data.newsletter.updates, ...caseNotes, ...rankingNotes],
    },
    caseNotes,
    rankingNotes,
    usage,
  };

  if (DRY_RUN) {
    log('--dry-run のためファイルは書き込みません。');
    console.log('\n--- 生成された記事 ---\n');
    console.log(articleFile.slice(0, 2000));
    console.log('\n--- 実行結果 ---\n');
    console.log(JSON.stringify(runOutput, null, 2));
    return;
  }

  await fs.writeFile(articlePath, articleFile, 'utf8');
  await fs.writeFile(CASES_FILE, `${JSON.stringify(casesData, null, 2)}\n`, 'utf8');
  await fs.writeFile(RANKINGS_FILE, `${JSON.stringify(rankingsData, null, 2)}\n`, 'utf8');
  await fs.writeFile(RUN_OUTPUT_FILE, `${JSON.stringify(runOutput, null, 2)}\n`, 'utf8');

  log(`記事を書き出しました: ${path.relative(process.cwd(), articlePath)}`);
  if (caseNotes.length) log(`カタログ更新 ${caseNotes.length}件`);
  if (rankingNotes.length) log(`ランキング調整 ${rankingNotes.length}件`);
  log('完了しました。');
}

main().catch((error) => {
  console.error('[weekly-research] 失敗しました:', error);
  process.exit(1);
});
