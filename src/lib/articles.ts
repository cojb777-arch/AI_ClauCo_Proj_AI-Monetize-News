import { getCollection, type CollectionEntry } from 'astro:content';
import { url } from './url';

export type Article = CollectionEntry<'articles'>;

const isPublished = (entry: Article) =>
  import.meta.env.DEV || entry.data.draft !== true;

/** 公開済み記事を新しい順に返す。 */
export async function getPublishedArticles(): Promise<Article[]> {
  const entries = await getCollection('articles', isPublished);
  return entries.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
}

/** タグ名 → 記事数。多い順。 */
export async function getTagCounts(): Promise<Array<[string, number]>> {
  const articles = await getPublishedArticles();
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const tag of article.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
}

export const articleHref = (article: Article) => url(`/articles/${article.id}/`);

export const formatDate = (date: Date) =>
  date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
