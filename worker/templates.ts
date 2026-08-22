import type { Env, NewsletterPayload } from './types';
import { escapeHtml } from './util';

const BRAND = '#b4531f';

/** メールクライアント差を吸収するため、すべてインラインスタイルで書く。 */
function shell(env: Env, bodyHtml: string, footerHtml: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(env.FROM_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f2ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e3ded4;border-radius:10px;overflow:hidden;">
  <tr>
    <td style="padding:20px 28px;border-bottom:1px solid #e3ded4;">
      <a href="${escapeHtml(env.SITE_URL)}/" style="color:#1b1a17;text-decoration:none;font:700 16px/1.4 'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,Helvetica,Arial,sans-serif;">
        <span style="display:inline-block;background:${BRAND};color:#fff;border-radius:5px;padding:2px 7px;font-size:12px;margin-right:8px;">AI</span>${escapeHtml(env.FROM_NAME)}
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:28px;font:400 15px/1.85 'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,Helvetica,Arial,sans-serif;color:#1b1a17;">
${bodyHtml}
    </td>
  </tr>
  <tr>
    <td style="padding:20px 28px;background:#faf8f5;border-top:1px solid #e3ded4;font:400 12px/1.8 'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,Helvetica,Arial,sans-serif;color:#6b6660;">
${footerHtml}
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** 特定電子メール法 第4条：送信者情報と配信停止手段の表示 */
function legalFooter(env: Env, unsubscribeUrl?: string): string {
  const lines = [
    `発行者：${escapeHtml(env.PUBLISHER_NAME)}`,
    `所在地：${escapeHtml(env.PUBLISHER_ADDRESS)}`,
    `連絡先：<a href="mailto:${escapeHtml(env.REPLY_TO_EMAIL)}" style="color:#8f3f14;">${escapeHtml(env.REPLY_TO_EMAIL)}</a>`,
  ];

  const unsubscribe = unsubscribeUrl
    ? `<p style="margin:0 0 10px;">このメールは、${escapeHtml(env.SITE_URL)} でご登録いただいた方にお送りしています。<br>
<a href="${escapeHtml(unsubscribeUrl)}" style="color:#8f3f14;">配信を停止する</a>
　|　
<a href="${escapeHtml(env.SITE_URL)}/privacy/" style="color:#8f3f14;">プライバシーポリシー</a></p>`
    : `<p style="margin:0 0 10px;">このメールは、${escapeHtml(env.SITE_URL)} の購読フォームからお申し込みいただいた方にお送りしています。<br>
お心当たりがない場合は、このメールを破棄してください。登録は完了しません。</p>`;

  return `${unsubscribe}<p style="margin:0;">${lines.join('<br>')}</p>`;
}

function legalFooterText(env: Env, unsubscribeUrl?: string): string {
  const unsubscribe = unsubscribeUrl
    ? `配信停止: ${unsubscribeUrl}\nプライバシーポリシー: ${env.SITE_URL}/privacy/`
    : 'お心当たりがない場合は、このメールを破棄してください。登録は完了しません。';

  return [
    '',
    '--',
    unsubscribe,
    '',
    `発行者：${env.PUBLISHER_NAME}`,
    `所在地：${env.PUBLISHER_ADDRESS}`,
    `連絡先：${env.REPLY_TO_EMAIL}`,
  ].join('\n');
}

/** ダブルオプトインの確認メール */
export function confirmationEmail(env: Env, confirmUrl: string) {
  const html = shell(
    env,
    `<h1 style="margin:0 0 16px;font-size:19px;line-height:1.5;">メールアドレスの確認をお願いします</h1>
<p style="margin:0 0 18px;">
${escapeHtml(env.FROM_NAME)} のニュースレターにお申し込みいただきありがとうございます。<br>
下のボタンを押すと登録が完了し、次回の配信からお届けします。
</p>
<p style="margin:0 0 22px;">
<a href="${escapeHtml(confirmUrl)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:8px;">登録を完了する</a>
</p>
<p style="margin:0 0 8px;font-size:13px;color:#6b6660;">
ボタンが動かない場合は、次のURLをブラウザに貼り付けてください。
</p>
<p style="margin:0 0 18px;font-size:12px;word-break:break-all;">
<a href="${escapeHtml(confirmUrl)}" style="color:#8f3f14;">${escapeHtml(confirmUrl)}</a>
</p>
<p style="margin:0;font-size:13px;color:#6b6660;">
このリンクは7日間有効です。期限が切れた場合は、お手数ですがもう一度ご登録ください。
</p>`,
    legalFooter(env)
  );

  const text = `メールアドレスの確認をお願いします

${env.FROM_NAME} のニュースレターにお申し込みいただきありがとうございます。
次のURLを開くと登録が完了します。

${confirmUrl}

このリンクは7日間有効です。
${legalFooterText(env)}`;

  return {
    subject: `【${env.FROM_NAME}】メールアドレスの確認をお願いします`,
    html,
    text,
  };
}

/** 週次ニュースレター本文 */
export function newsletterEmail(
  env: Env,
  payload: NewsletterPayload,
  unsubscribeUrl: string
) {
  const intro = payload.intro
    ? `<p style="margin:0 0 22px;">${escapeHtml(payload.intro).replace(/\n/g, '<br>')}</p>`
    : '';

  const articlesHtml = payload.articles
    .map(
      (article) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #e3ded4;border-radius:8px;">
  <tr><td style="padding:16px 18px;">
    ${
      article.category
        ? `<p style="margin:0 0 6px;font-size:11px;color:#8f3f14;letter-spacing:.08em;">${escapeHtml(article.category)}</p>`
        : ''
    }
    <p style="margin:0 0 8px;font-size:16px;font-weight:700;line-height:1.55;">
      <a href="${escapeHtml(article.url)}" style="color:#1b1a17;text-decoration:none;">${escapeHtml(article.title)}</a>
    </p>
    <p style="margin:0 0 10px;font-size:14px;color:#4a4640;line-height:1.8;">${escapeHtml(article.description)}</p>
    <p style="margin:0;font-size:13px;"><a href="${escapeHtml(article.url)}" style="color:#8f3f14;">続きを読む →</a></p>
  </td></tr>
</table>`
    )
    .join('');

  const updatesHtml =
    payload.updates && payload.updates.length > 0
      ? `<h2 style="margin:28px 0 12px;font-size:15px;border-top:1px solid #e3ded4;padding-top:20px;">今週の更新</h2>
<ul style="margin:0 0 8px;padding-left:20px;font-size:14px;color:#4a4640;line-height:1.9;">
${payload.updates.map((update) => `<li>${escapeHtml(update)}</li>`).join('\n')}
</ul>`
      : '';

  const html = shell(
    env,
    `${intro}${articlesHtml}${updatesHtml}
<p style="margin:26px 0 0;font-size:13px;color:#6b6660;">
過去の記事は <a href="${escapeHtml(env.SITE_URL)}/articles/" style="color:#8f3f14;">記事一覧</a> から読めます。
</p>`,
    legalFooter(env, unsubscribeUrl)
  );

  const text = [
    payload.intro ?? '',
    '',
    ...payload.articles.map(
      (article) => `■ ${article.title}\n${article.description}\n${article.url}\n`
    ),
    ...(payload.updates && payload.updates.length > 0
      ? ['【今週の更新】', ...payload.updates.map((update) => `・${update}`), '']
      : []),
    `過去の記事: ${env.SITE_URL}/articles/`,
    legalFooterText(env, unsubscribeUrl),
  ].join('\n');

  return { subject: payload.subject, html, text };
}
