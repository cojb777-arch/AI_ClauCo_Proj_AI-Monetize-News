export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;

  // vars（wrangler.toml）
  SITE_URL: string;
  FROM_EMAIL: string;
  FROM_NAME: string;
  REPLY_TO_EMAIL: string;
  PUBLISHER_NAME: string;
  PUBLISHER_ADDRESS: string;

  // secrets（wrangler secret put）
  RESEND_API_KEY: string;
  NEWSLETTER_SEND_TOKEN: string;
  UNSUBSCRIBE_SECRET: string;
}

export interface SubscriberRow {
  id: number;
  email: string;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  confirm_token_hash: string | null;
  confirm_expires_at: string | null;
  requested_at: string;
}

/** 週次エージェントが /api/newsletter/send に送る本文 */
export interface NewsletterPayload {
  /** 同じ号の二重送信を防ぐ一意キー（例: "2026-08-24"） */
  slug: string;
  subject: string;
  intro?: string;
  articles: Array<{
    title: string;
    url: string;
    description: string;
    category?: string;
  }>;
  /** 事例カタログ・ランキングの更新点など */
  updates?: string[];
  /** true のとき実際には送信せず、対象件数だけ返す */
  dryRun?: boolean;
}
