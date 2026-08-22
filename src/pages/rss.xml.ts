import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedArticles, articleHref } from '../lib/articles';
import { SITE } from '../config';

export async function GET(context: APIContext) {
  const articles = await getPublishedArticles();

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site ?? SITE.name,
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
