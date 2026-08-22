import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 週次エージェントが生成する記事。
 * scripts/weekly-research.mjs が同じスキーマで frontmatter を書き出す。
 */
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    /** research: 研究事例レポート / howto: ノウハウ解説 / digest: 週次ダイジェスト */
    category: z.enum(['research', 'howto', 'digest']),
    tags: z.array(z.string()).default([]),
    /** エージェント生成か人間執筆か。透明性のため記事に明示する。 */
    author: z.enum(['agent', 'editor']).default('agent'),
    /** 参照した一次情報。エージェント記事では必須に近い扱い。 */
    sources: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().url(),
          publisher: z.string().optional(),
        })
      )
      .default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { articles };
