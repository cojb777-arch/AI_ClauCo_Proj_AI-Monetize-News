import type { Env } from './types';
import { chunk, sleep } from './util';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
/** Resend の一括送信は 1リクエストあたり最大100通 */
const BATCH_SIZE = 100;
/** 無料プランのレート制限（2 req/s）に余裕を持たせる */
const BATCH_INTERVAL_MS = 600;

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** RFC 8058 のワンクリック配信停止に使う */
  unsubscribeUrl?: string;
}

export interface SendResult {
  sent: number;
  failed: number;
  errors: string[];
}

function buildPayload(env: Env, email: OutgoingEmail) {
  const headers: Record<string, string> = {};

  if (email.unsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${email.unsubscribeUrl}>, <mailto:${env.REPLY_TO_EMAIL}?subject=unsubscribe>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  return {
    from: `${env.FROM_NAME} <${env.FROM_EMAIL}>`,
    to: [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
    reply_to: env.REPLY_TO_EMAIL,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  };
}

/** 1通だけ送る（確認メールなど） */
export async function sendEmail(env: Env, email: OutgoingEmail): Promise<void> {
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(buildPayload(env, email)),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend ${response.status}: ${detail.slice(0, 300)}`);
  }
}

/**
 * 複数通をまとめて送る。
 * 1件でも失敗した場合に全体を止めず、成功数・失敗数を集計して返す。
 */
export async function sendBatch(env: Env, emails: OutgoingEmail[]): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, errors: [] };
  const batches = chunk(emails, BATCH_SIZE);

  for (const [index, batch] of batches.entries()) {
    if (index > 0) await sleep(BATCH_INTERVAL_MS);

    try {
      const response = await fetch(`${RESEND_ENDPOINT}/batch`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(batch.map((email) => buildPayload(env, email))),
      });

      if (response.ok) {
        result.sent += batch.length;
      } else {
        const detail = await response.text().catch(() => '');
        result.failed += batch.length;
        result.errors.push(`batch ${index}: ${response.status} ${detail.slice(0, 200)}`);
      }
    } catch (error) {
      result.failed += batch.length;
      result.errors.push(`batch ${index}: ${(error as Error).message}`);
    }
  }

  return result;
}
