# セットアップ手順

初回に一度だけ行う作業です。所要 30〜60分。

---

## 全体像

```
GitHub Actions（毎週月曜 09:00 JST）
   │
   ├─ 1. scripts/weekly-research.mjs
   │       Claude が Web検索でAI収益化事例を調査 → 記事Markdownを生成
   │       data/cases.json・data/rankings.json も更新
   │
   ├─ 2. git commit & push
   │
   ├─ 3. npm run build（Astro）→ npx wrangler deploy
   │       静的サイト + API を Cloudflare Workers に配信
   │
   └─ 4. scripts/send-newsletter.mjs
           Worker の /api/newsletter/send を叩く
              → D1 から購読者を取得
              → Resend でメール配信（配信停止リンク付き）
```

---

## 1. Cloudflare の準備

### 1-1. ログイン

```bash
npx wrangler login
```

### 1-2. D1 データベースを作成

```bash
npx wrangler d1 create ai-monetize-news
```

出力される `database_id` を `wrangler.toml` の
`PLACEHOLDER_REPLACE_WITH_YOUR_D1_DATABASE_ID` と差し替えます。

### 1-3. テーブルを作成

```bash
npm run db:init          # 本番
npm run db:init:local    # ローカル開発用
```

### 1-4. 初回デプロイ

```bash
npm run deploy
```

`https://ai-monetize-news.<あなたのサブドメイン>.workers.dev` で公開されます。
独自ドメインを使う場合は Cloudflare ダッシュボードの
Workers & Pages → 対象Worker → Settings → Domains & Routes から追加します。

---

## 2. Resend（メール配信）の準備

1. https://resend.com でアカウントを作成
2. **Domains** から送信ドメインを追加し、表示される DNS レコード
   （SPF / DKIM / DMARC）を自分のDNSに登録して検証を通す
3. **API Keys** から APIキーを作成（`Sending access` で十分）

> ドメイン検証を通さないと、迷惑メール判定されるか、そもそも送信できません。
> ここは省略しないでください。

---

## 3. 設定値の差し替え

### `wrangler.toml` の `[vars]`

| 変数 | 内容 |
| --- | --- |
| `SITE_URL` | 公開URL（末尾スラッシュなし） |
| `FROM_EMAIL` | 送信元アドレス（Resendで検証したドメインのもの） |
| `FROM_NAME` | 送信者表示名 |
| `REPLY_TO_EMAIL` | 返信先・問い合わせ先 |
| `PUBLISHER_NAME` | 運営者名（**特定電子メール法で表示が義務**） |
| `PUBLISHER_ADDRESS` | 所在地 |

### `src/config.ts` の `PUBLISHER`

サイト側のフッター・プライバシーポリシーに使われます。同じ値を入れてください。

---

## 4. シークレットの登録

### Cloudflare Worker 側

```bash
# Resend の APIキー
npx wrangler secret put RESEND_API_KEY

# 配信APIを叩くための共有シークレット（下のコマンドで生成した値を使う）
npx wrangler secret put NEWSLETTER_SEND_TOKEN

# 配信停止リンクの署名鍵
npx wrangler secret put UNSUBSCRIBE_SECRET
```

ランダム値の生成:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> `UNSUBSCRIBE_SECRET` を後から変更すると、**過去に配信したメールの配信停止リンクがすべて無効になります**。
> 一度決めたら変更しないでください。

### GitHub 側

リポジトリの Settings → Secrets and variables → Actions で登録します。

**Secrets**

| 名前 | 内容 |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API キー |
| `CLOUDFLARE_API_TOKEN` | Cloudflare APIトークン（`Edit Cloudflare Workers` 権限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウントID |
| `NEWSLETTER_SEND_TOKEN` | 上で Worker に登録したものと**同じ値** |

**Variables**

| 名前 | 内容 |
| --- | --- |
| `SITE_URL` | 公開URL（`wrangler.toml` と同じ値） |

---

## 5. 動作確認

### ローカルで動かす

```bash
npm run build          # 先に dist/ を作る
npm run db:init:local  # ローカルD1にテーブルを作る
npm run preview        # wrangler dev（http://localhost:8787）
```

Astro のUIだけを高速に編集したいときは `npm run dev`（API は動きません）。

### 週次エージェントを試す（書き込みなし）

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run agent:weekly -- --dry-run
```

生成される記事と更新内容が標準出力に表示されます。問題なければ `--dry-run` を外します。

### 配信を試す（実際には送らない）

```bash
export SITE_URL=https://...
export NEWSLETTER_SEND_TOKEN=...
npm run agent:newsletter -- --dry-run
```

購読者数だけが返ります。

### GitHub Actions から手動実行

Actions → 「週次リサーチと配信」→ Run workflow。
`dry_run` にチェックを入れると、書き込みも配信も行わずに動作だけ確認できます。

---

## 6. 定期実行について

`schedule` は**デフォルトブランチ上のワークフローだけ**が実行されます。
作業ブランチのままではcronは動きません。`main` にマージしてください。

cron は UTC で指定します。`0 0 * * 1` は月曜 00:00 UTC = **月曜 09:00 JST** です。

---

## 7. 公開前チェックリスト

- [ ] `wrangler.toml` の `database_id` を実IDに差し替えた
- [ ] `[vars]` の運営者名・所在地・連絡先を実在の値にした
- [ ] `src/config.ts` の `PUBLISHER` も同じ値にした
- [ ] Resend の送信ドメインを検証済み（SPF / DKIM / DMARC）
- [ ] `/privacy/` のプライバシーポリシーを自分の運用に合わせて確認した
- [ ] テスト用アドレスで購読 → 確認メール → 配信停止まで一通り動かした
- [ ] 確認メール・配信メールのフッターに運営者名と配信停止リンクが出ている
