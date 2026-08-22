import type { APIContext } from 'astro';

/**
 * robots.txt は静的ファイルではなくエンドポイントとして生成する。
 * sitemap の指定は絶対URLである必要があり、base パスが変わると値も変わるため。
 */
export async function GET(context: APIContext) {
  const sitemapUrl = new URL('sitemap-index.xml', context.url).href;

  const body = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;

  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
