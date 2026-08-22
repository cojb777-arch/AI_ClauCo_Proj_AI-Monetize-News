// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 公開URL。Cloudflare のカスタムドメインを設定したら SITE_URL を差し替える。
const site = process.env.SITE_URL ?? 'https://ai-monetize-news.example.com';

export default defineConfig({
  site,
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
