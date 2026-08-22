/** JSON レスポンスの薄いヘルパー */
export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location: url, 'cache-control': 'no-store' },
  });
}

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 暗号論的に安全なランダムトークン（デフォルト32バイト = 256bit） */
export function randomToken(bytes = 32): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return toHex(array.buffer);
}

export async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/**
 * 配信停止トークン。`{id}.{HMAC}` 形式。
 * DBに保存せず毎回導出できるので、配信のたびに購読者ごとのリンクを作れる。
 */
export async function makeUnsubscribeToken(
  id: number,
  email: string,
  secret: string
): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${id}:${email}`));
  return `${id}.${toHex(signature)}`;
}

/** 配信停止トークンを検証し、正しければ購読者IDを返す。 */
export async function verifyUnsubscribeToken(
  token: string,
  lookupEmail: (id: number) => Promise<string | null>,
  secret: string
): Promise<number | null> {
  const separator = token.indexOf('.');
  if (separator <= 0) return null;

  const id = Number.parseInt(token.slice(0, separator), 10);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const email = await lookupEmail(id);
  if (!email) return null;

  const expected = await makeUnsubscribeToken(id, email, secret);
  return timingSafeEqual(token, expected) ? id : null;
}

/** 文字列比較のタイミング差を潰す */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * メールアドレスの検証と正規化。
 * RFC完全準拠ではなく、実務上ほぼすべての正常なアドレスを通し、
 * 明らかな不正値を弾く水準に留めている。
 */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  if (!/^[^\s@,;:<>"'\\]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(email)) {
    return null;
  }
  return email;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const nowIso = () => new Date().toISOString();

export function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/** 配列を size ごとに分割する */
export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
