/**
 * サイト内リンクを base パスに合わせて解決する。
 *
 * GitHub Pages のプロジェクトサイトは `https://<user>.github.io/<repo>/` のように
 * サブディレクトリ配信になるため、`/articles/` のような絶対パスをそのまま書くと
 * リンクが全滅する。Astro は著者が書いた href を自動では書き換えないので、
 * サイト内リンクは必ずこの関数を通す。
 *
 * Cloudflare など独自ドメイン配信では base が "/" なので、何も起きない。
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function url(path: string): string {
  // 外部URL・アンカー・mailto はそのまま
  if (!path.startsWith('/')) return path;
  return `${BASE}${path}`;
}
