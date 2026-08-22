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

/** 特定電子メール法 第4条に基づく送信者情報。デプロイ前に必ず実在の値へ差し替える。 */
export const PUBLISHER = {
  name: '（運営者名を記入）',
  contactEmail: 'contact@example.com',
  /** 住所の表示義務はないが、記載すると到達率とスパム判定の面で有利。 */
  address: '（所在地を記入）',
} as const;

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
