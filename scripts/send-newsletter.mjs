#!/usr/bin/env node
/**
 * ニュースレター配信。
 * weekly-research.mjs が出力した .agent-run.json を読み、Worker の配信APIを叩く。
 * .agent-run.json が無い場合は、直近7日間に公開された記事から組み立てる。
 *
 * 使い方:
 *   node scripts/send-newsletter.mjs [--dry-run]
 *
 * 必要な環境変数:
 *   SITE_URL, NEWSLETTER_SEND_TOKEN
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { parseFrontmatter, toDateString } from './lib/frontmatter.mjs';
import { ARTICLES_DIR, RUN_OUTPUT_FILE } from './lib/paths.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const RECENT_DAYS = 7;

const log = (message) => console.log(`[send-newsletter] ${message}`);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`環境変数 ${name} が設定されていません。`);
  return value;
}

/** 直近 RECENT_DAYS 日に公開された記事を集める（.agent-run.json が無い場合の経路） */
async function recentArticles(siteUrl) {
  const cutoff = Date.now() - RECENT_DAYS * 86_400_000;
  const files = await fs.readdir(ARTICLES_DIR).catch(() => []);
  const articles = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const raw = await fs.readFile(path.join(ARTICLES_DIR, file), 'utf8');
    const { data } = parseFrontmatter(raw);

    if (data.draft === true) continue;
    const published = Date.parse(data.pubDate ?? '');
    if (!Number.isFinite(published) || published < cutoff) continue;

    articles.push({
      title: data.title,
      description: data.description,
      url: `${siteUrl}/articles/${file.replace(/\.md$/, '')}/`,
      category: data.category,
      pubDate: data.pubDate,
    });
  }

  return articles.sort((a, b) => String(b.pubDate).localeCompare(String(a.pubDate)));
}

async function buildPayload(siteUrl) {
  const run = await fs
    .readFile(RUN_OUTPUT_FILE, 'utf8')
    .then(JSON.parse)
    .catch(() => null);

  if (run?.article && run?.newsletter) {
    return {
      slug: run.newsletter.slug,
      subject: run.newsletter.subject,
      intro: run.newsletter.intro,
      updates: run.newsletter.updates ?? [],
      articles: [
        {
          title: run.article.title,
          description: run.article.description,
          url: `${siteUrl}${run.article.path}`,
          category: run.article.category,
        },
      ],
    };
  }

  log('.agent-run.json が見つからないため、直近の記事から組み立てます。');
  const articles = await recentArticles(siteUrl);

  if (articles.length === 0) {
    return null;
  }

  return {
    slug: toDateString(new Date()),
    subject: `今週のAI収益化リサーチ（${articles.length}本）`,
    intro: '今週公開した記事をお届けします。',
    updates: [],
    articles: articles.map(({ pubDate, ...rest }) => rest),
  };
}

async function main() {
  const siteUrl = requireEnv('SITE_URL').replace(/\/$/, '');
  const token = requireEnv('NEWSLETTER_SEND_TOKEN');

  const payload = await buildPayload(siteUrl);

  if (!payload) {
    log('配信対象の記事がありません。終了します。');
    return;
  }

  log(`件名: ${payload.subject}`);
  log(`記事: ${payload.articles.length}本 / 更新メモ: ${payload.updates.length}件`);

  const response = await fetch(`${siteUrl}/api/newsletter/send`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ...payload, dryRun: DRY_RUN }),
  });

  const result = await response.json().catch(() => ({}));

  if (response.status === 409) {
    log(`この号はすでに送信済みです: ${result.error}`);
    return;
  }

  if (!response.ok) {
    throw new Error(`配信APIがエラーを返しました (${response.status}): ${JSON.stringify(result)}`);
  }

  log(`結果: ${JSON.stringify(result)}`);
}

main().catch((error) => {
  console.error('[send-newsletter] 失敗しました:', error);
  process.exit(1);
});
