// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 公開URL。Cloudflare のカスタムドメインを設定したら SITE_URL を差し替える。
const site = process.env.SITE_URL ?? 'https://ai-monetize-news.example.com';

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
