import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedArticles, articleHref } from '../lib/articles';
import { SITE } from '../config';

export async function GET(context: APIContext) {
  const articles = await getPublishedArticles();

  return rss({
    title: SITE.name,
    description: SITE.description,
    // context.site は base を含まないため、base を足したサイトURLを渡す。
    site: new URL(import.meta.env.BASE_URL, context.site ?? context.url).href,
    trailingSlash: true,
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.pubDate,
      link: articleHref(article),
      categories: article.data.tags,
    })),
    customData: `<language>ja</language>`,
  });
}
