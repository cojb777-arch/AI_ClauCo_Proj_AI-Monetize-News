import type { Env, NewsletterPayload, SubscriberRow } from './types';
import { confirmationEmail, newsletterEmail } from './templates';
import { sendBatch, sendEmail, type OutgoingEmail } from './email';
import {
  isoPlusDays,
  json,
  makeUnsubscribeToken,
  normalizeEmail,
  nowIso,
  randomToken,
  redirect,
  sha256,
  timingSafeEqual,
  verifyUnsubscribeToken,
} from './util';

/** 同一メールアドレスからの確認メール再送を制限する間隔 */
const RESEND_THROTTLE_MS = 60_000;
/** 同一IPからの申込回数の上限（10分あたり） */
const IP_LIMIT = 5;
const IP_WINDOW_MINUTES = 10;
/** 確認リンクの有効日数 */
const CONFIRM_TTL_DAYS = 7;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      // 静的アセットへ委譲（通常は run_worker_first の設定によりここへは来ない）
      return env.ASSETS.fetch(request);
    }

    try {
      switch (url.pathname) {
        case '/api/health':
          return json({ ok: true, time: nowIso() });

        case '/api/subscribe':
          if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
          return await handleSubscribe(request, env, ctx);

        case '/api/confirm':
          if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
          return await handleConfirm(request, env, url);

        case '/api/unsubscribe':
          if (request.method !== 'GET' && request.method !== 'POST') {
            return json({ error: 'Method not allowed' }, 405);
          }
          return await handleUnsubscribe(request, env, url);

        case '/api/newsletter/send':
          if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
          return await handleNewsletterSend(request, env);

        default:
          return json({ error: 'Not found' }, 404);
      }
    } catch (error) {
      console.error('unhandled error', error);
      return json({ error: 'Internal error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

// ────────────────────────────────────────────────────────────
// POST /api/subscribe
// ────────────────────────────────────────────────────────────

async function handleSubscribe(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    consent?: unknown;
    website?: unknown;
  } | null;

  if (!body) return json({ error: 'リクエストの形式が正しくありません。' }, 400);

  // ハニーポット。ボットが埋めた場合は成功したふりをして何もしない。
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ message: '確認メールを送信しました。' });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return json({ error: 'メールアドレスの形式を確認してください。' }, 400);
  }
  if (body.consent !== true) {
    return json({ error: 'プライバシーポリシーへの同意が必要です。' }, 400);
  }

  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const userAgent = (request.headers.get('user-agent') ?? '').slice(0, 255);

  if (ip && (await isIpRateLimited(env, ip))) {
    return json({ error: '短時間に申込が集中しています。しばらく時間をおいてお試しください。' }, 429);
  }

  const existing = await env.DB.prepare(
    `SELECT id, email, status, confirm_token_hash, confirm_expires_at, requested_at
       FROM subscribers WHERE email = ?`
  )
    .bind(email)
    .first<SubscriberRow>();

  if (existing?.status === 'confirmed') {
    // 登録の有無を第三者に推測させないため、文面は新規時と揃える。
    return json({
      message: 'このメールアドレスはすでに登録済みです。次回の配信をお待ちください。',
    });
  }

  if (
    existing &&
    Date.now() - Date.parse(existing.requested_at) < RESEND_THROTTLE_MS
  ) {
    return json({
      message: '確認メールを送信済みです。届かない場合は迷惑メールフォルダをご確認ください。',
    });
  }

  const token = randomToken();
  const tokenHash = await sha256(token);
  const requestedAt = nowIso();
  const expiresAt = isoPlusDays(CONFIRM_TTL_DAYS);

  if (existing) {
    await env.DB.prepare(
      `UPDATE subscribers
          SET status = 'pending', confirm_token_hash = ?, confirm_expires_at = ?,
              requested_at = ?, consent_ip = ?, consent_user_agent = ?,
              unsubscribed_at = NULL, updated_at = datetime('now')
        WHERE id = ?`
    )
      .bind(tokenHash, expiresAt, requestedAt, ip, userAgent, existing.id)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO subscribers
         (email, status, confirm_token_hash, confirm_expires_at, requested_at,
          consent_ip, consent_user_agent, source)
       VALUES (?, 'pending', ?, ?, ?, ?, ?, 'web')`
    )
      .bind(email, tokenHash, expiresAt, requestedAt, ip, userAgent)
      .run();
  }

  await logConsent(env, email, 'requested', ip, userAgent);

  const confirmUrl = `${env.SITE_URL}/api/confirm?token=${token}`;
  const message = confirmationEmail(env, confirmUrl);

  // 送信の完了を待たずに応答を返す（フォームの体感速度を優先）。
  ctx.waitUntil(
    sendEmail(env, {
      to: email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }).catch((error) => console.error('confirmation mail failed', email, error))
  );

  return json({
    message: '確認メールを送信しました。メール内のリンクをクリックすると登録が完了します。',
  });
}

async function isIpRateLimited(env: Env, ip: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM consent_log
      WHERE ip = ? AND event = 'requested'
        AND occurred_at > datetime('now', ?)`
  )
    .bind(ip, `-${IP_WINDOW_MINUTES} minutes`)
    .first<{ count: number }>();

  return (row?.count ?? 0) >= IP_LIMIT;
}

async function logConsent(
  env: Env,
  email: string,
  event: string,
  ip: string,
  userAgent: string
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO consent_log (email, event, ip, user_agent) VALUES (?, ?, ?, ?)`
  )
    .bind(email, event, ip, userAgent)
    .run();
}

// ────────────────────────────────────────────────────────────
// GET /api/confirm
// ────────────────────────────────────────────────────────────

async function handleConfirm(request: Request, env: Env, url: URL): Promise<Response> {
  const token = url.searchParams.get('token');
  if (!token) return redirect(`${env.SITE_URL}/newsletter/error/`);

  const tokenHash = await sha256(token);

  const subscriber = await env.DB.prepare(
    `SELECT id, email, status, confirm_expires_at
       FROM subscribers
      WHERE confirm_token_hash = ? AND status = 'pending'`
  )
    .bind(tokenHash)
    .first<{ id: number; email: string; status: string; confirm_expires_at: string }>();

  if (!subscriber || Date.parse(subscriber.confirm_expires_at) < Date.now()) {
    return redirect(`${env.SITE_URL}/newsletter/error/`);
  }

  await env.DB.prepare(
    `UPDATE subscribers
        SET status = 'confirmed', confirmed_at = datetime('now'),
            confirm_token_hash = NULL, confirm_expires_at = NULL,
            updated_at = datetime('now')
      WHERE id = ?`
  )
    .bind(subscriber.id)
    .run();

  await logConsent(
    env,
    subscriber.email,
    'confirmed',
    request.headers.get('cf-connecting-ip') ?? '',
    (request.headers.get('user-agent') ?? '').slice(0, 255)
  );

  return redirect(`${env.SITE_URL}/newsletter/confirmed/`);
}

// ────────────────────────────────────────────────────────────
// GET / POST /api/unsubscribe
// ────────────────────────────────────────────────────────────

async function handleUnsubscribe(request: Request, env: Env, url: URL): Promise<Response> {
  const token = url.searchParams.get('token') ?? '';
  const isOneClickPost = request.method === 'POST';

  const id = await verifyUnsubscribeToken(
    token,
    async (candidateId) => {
      const row = await env.DB.prepare(`SELECT email FROM subscribers WHERE id = ?`)
        .bind(candidateId)
        .first<{ email: string }>();
      return row?.email ?? null;
    },
    env.UNSUBSCRIBE_SECRET
  );

  if (id === null) {
    // ワンクリック配信停止はメールクライアントが自動で叩くため、本文ではなくステータスで返す。
    return isOneClickPost
      ? new Response('invalid token', { status: 400 })
      : redirect(`${env.SITE_URL}/newsletter/error/`);
  }

  const row = await env.DB.prepare(
    `UPDATE subscribers
        SET status = 'unsubscribed', unsubscribed_at = datetime('now'),
            updated_at = datetime('now')
      WHERE id = ? RETURNING email`
  )
    .bind(id)
    .first<{ email: string }>();

  if (row) {
    await logConsent(
      env,
      row.email,
      'unsubscribed',
      request.headers.get('cf-connecting-ip') ?? '',
      (request.headers.get('user-agent') ?? '').slice(0, 255)
    );
  }

  return isOneClickPost
    ? new Response('unsubscribed', { status: 200 })
    : redirect(`${env.SITE_URL}/newsletter/unsubscribed/`);
}

// ────────────────────────────────────────────────────────────
// POST /api/newsletter/send  （週次エージェントから呼ばれる）
// ────────────────────────────────────────────────────────────

async function handleNewsletterSend(request: Request, env: Env): Promise<Response> {
  const authorization = request.headers.get('authorization') ?? '';
  const presented = authorization.replace(/^Bearer\s+/i, '');

  if (!env.NEWSLETTER_SEND_TOKEN || !timingSafeEqual(presented, env.NEWSLETTER_SEND_TOKEN)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const payload = (await request.json().catch(() => null)) as NewsletterPayload | null;

  if (!payload?.slug || !payload.subject || !Array.isArray(payload.articles)) {
    return json({ error: 'slug / subject / articles は必須です。' }, 400);
  }
  if (payload.articles.length === 0) {
    return json({ error: '配信する記事がありません。' }, 400);
  }

  const alreadySent = await env.DB.prepare(
    `SELECT id, sent_at FROM newsletter_issues WHERE slug = ?`
  )
    .bind(payload.slug)
    .first<{ id: number; sent_at: string }>();

  if (alreadySent) {
    return json(
      { error: `この号（${payload.slug}）は ${alreadySent.sent_at} に送信済みです。`, skipped: true },
      409
    );
  }

  const { results } = await env.DB.prepare(
    `SELECT id, email FROM subscribers WHERE status = 'confirmed' ORDER BY id`
  ).all<{ id: number; email: string }>();

  const subscribers = results ?? [];

  if (payload.dryRun) {
    return json({ dryRun: true, recipients: subscribers.length, slug: payload.slug });
  }

  if (subscribers.length === 0) {
    await recordIssue(env, payload, 0, 0);
    return json({ sent: 0, failed: 0, recipients: 0, note: '購読者がいないため送信しませんでした。' });
  }

  const emails: OutgoingEmail[] = [];
  for (const subscriber of subscribers) {
    const token = await makeUnsubscribeToken(
      subscriber.id,
      subscriber.email,
      env.UNSUBSCRIBE_SECRET
    );
    const unsubscribeUrl = `${env.SITE_URL}/api/unsubscribe?token=${token}`;
    const message = newsletterEmail(env, payload, unsubscribeUrl);

    emails.push({
      to: subscriber.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      unsubscribeUrl,
    });
  }

  const result = await sendBatch(env, emails);

  await env.DB.prepare(
    `UPDATE subscribers SET last_sent_at = datetime('now') WHERE status = 'confirmed'`
  ).run();

  await recordIssue(env, payload, result.sent, result.failed);

  return json({
    slug: payload.slug,
    recipients: subscribers.length,
    sent: result.sent,
    failed: result.failed,
    errors: result.errors.slice(0, 5),
  });
}

async function recordIssue(
  env: Env,
  payload: NewsletterPayload,
  sent: number,
  failed: number
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO newsletter_issues (slug, subject, recipient_count, failed_count)
     VALUES (?, ?, ?, ?)`
  )
    .bind(payload.slug, payload.subject, sent, failed)
    .run();
}
