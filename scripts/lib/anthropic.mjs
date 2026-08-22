import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';

export const MODEL = 'claude-opus-5';

/** サーバーサイド・フォールバック（拒否時に別モデルへ自動振替）を有効にする */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export function createClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY が設定されていません。.env または GitHub Secrets を確認してください。'
    );
  }
  return new Anthropic();
}

function assertUsable(message) {
  if (message.stop_reason === 'refusal') {
    const detail = message.stop_details?.explanation ?? '(理由の説明なし)';
    throw new Error(`モデルがリクエストを拒否しました: ${detail}`);
  }
}

export function textOf(message) {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/** web_search の結果から実際に参照されたURLを集める */
export function collectSearchSources(message) {
  const sources = new Map();

  for (const block of message.content) {
    if (block.type !== 'web_search_tool_result') continue;
    // エラー時は content がオブジェクト（配列ではない）になる
    if (!Array.isArray(block.content)) continue;

    for (const result of block.content) {
      if (result.type === 'web_search_result' && result.url) {
        sources.set(result.url, result.title ?? result.url);
      }
    }
  }

  return [...sources.entries()].map(([url, title]) => ({ url, title }));
}

/**
 * Web検索を使った調査フェーズ。
 * 長い検索ターンは pause_turn で中断されるため、完了するまで再開する。
 */
export async function research({
  client,
  system,
  prompt,
  maxSearches = 12,
  maxRounds = 8,
  effort = 'high',
  onProgress = () => {},
}) {
  const messages = [{ role: 'user', content: prompt }];
  const searchSources = [];

  for (let round = 0; round < maxRounds; round += 1) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      system,
      messages,
      thinking: { type: 'adaptive' },
      output_config: { effort },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches }],
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
    });

    const message = await stream.finalMessage();
    assertUsable(message);

    searchSources.push(...collectSearchSources(message));
    messages.push({ role: 'assistant', content: message.content });

    if (message.stop_reason !== 'pause_turn') {
      onProgress(`調査完了（${round + 1}ラウンド）`);
      const unique = new Map(searchSources.map((source) => [source.url, source]));
      return { text: textOf(message), sources: [...unique.values()], message };
    }

    onProgress(`検索が長引いているため再開します（${round + 1}ラウンド目）`);
  }

  throw new Error(`調査が ${maxRounds} ラウンド以内に完了しませんでした。`);
}

/**
 * 構造化フェーズ。ツールを使わず、与えられたJSONスキーマに沿った出力だけを返させる。
 */
export async function compose({ client, system, prompt, schema, effort = 'high' }) {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 32000,
    system,
    messages: [{ role: 'user', content: prompt }],
    thinking: { type: 'adaptive' },
    output_config: {
      effort,
      format: jsonSchemaOutputFormat(schema),
    },
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
  });

  assertUsable(response);

  if (!response.parsed_output) {
    throw new Error(`構造化出力の解析に失敗しました: ${textOf(response).slice(0, 500)}`);
  }

  return { data: response.parsed_output, usage: response.usage };
}
