/**
 * サイト全体の設定。
 * 特定電子メール法で送信者情報の表示が義務づけられているため、
 * publisher の値はメールのフッターにもそのまま使われる。
 */
export const SITE = {
  name: 'AI Monetize Lab',
  tagline: 'AI収益化の実例とノウハウを、毎週リサーチして届ける',
  description:
    'AIで収益化しているサービス・サイトの実例と、その裏側にある収益化手法を毎週リサーチしてまとめる研究メディアです。',
  lang: 'ja',
  locale: 'ja_JP',
} as const;

/**
 * 運営者情報。フッターとプライバシーポリシーに表示される。
 * メール配信も物販も行わないため法定の表示義務はないが、
 * 掲載内容についての連絡先がないサイトは信頼されないので記載を推奨する。
 */
export const PUBLISHER: { name: string; contactEmail: string } = {
  name: 'coco',
  /**
   * 連絡先。空文字にすると、フッターと各ページから連絡先の表示が消える。
   * 掲載内容の誤りの指摘や取り下げ依頼を受ける窓口になるため、
   * 用意できるなら記入しておくとよい。
   */
  contactEmail: '',
};

export const NAV = [
  { href: '/', label: 'ホーム' },
  { href: '/articles/', label: '記事' },
  { href: '/cases/', label: '収益化事例' },
  { href: '/rankings/', label: '手法ランキング' },
  { href: '/about/', label: 'このサイトについて' },
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  research: '研究事例',
  howto: 'ノウハウ',
  digest: '週次ダイジェスト',
};

export const AUTHOR_LABEL: Record<string, string> = {
  agent: 'リサーチエージェント',
  editor: '編集部',
};
