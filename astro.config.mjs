// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 公開URL。canonical・RSS・sitemap の絶対URLに使われる。
// 既定値は Cloudflare の workers.dev。GitHub Pages のワークフローや
// 独自ドメインを使う場合は SITE_URL 環境変数で上書きする。
const site = process.env.SITE_URL ?? 'https://ai-monetize-news.cojb777.workers.dev';

// サブディレクトリ配信（GitHub Pages のプロジェクトサイトなど）で使う。
// 独自ドメイン直下に置く場合は未設定のままでよい。
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
  },
});
