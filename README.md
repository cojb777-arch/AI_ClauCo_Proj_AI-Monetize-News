# AI Monetize Lab

AIで収益を上げているサービスの実例と、その収益化ノウハウを**毎週リサーチして公開・配信する**研究メディアです。

リサーチ・執筆・カタログ更新・メール配信までを、週1回のエージェントが自動で実行します。

---

## できること

| 機能 | 内容 |
| --- | --- |
| 研究記事の自動生成 | 毎週 Claude が Web検索でAI収益化事例を調査し、出典付きの記事を書いて公開する |
| 収益化事例カタログ | 掲載済みサービスの料金・提供状況を毎週確認して更新する |
| 手法ランキング | 収益化手法を5軸で相対評価し、根拠が出たときだけスコアを見直す |
| ニュースレター配信 | 生成した記事を購読者へ自動配信する（ダブルオプトイン・配信停止リンク付き） |

## 技術構成

| 層 | 使うもの |
| --- | --- |
| サイト | Astro（静的生成） |
| ホスティング / API | Cloudflare Workers（静的アセット + `/api/*`） |
| 購読者データベース | Cloudflare D1 |
| メール配信 | Resend |
| リサーチ・執筆 | Claude API（Web検索ツール + 構造化出力） |
| 定期実行 | GitHub Actions（cron） |

---

## ディレクトリ

```
src/                 Astro のサイト本体
  content/articles/    記事Markdown（エージェントが追記する）
  pages/               各ページ
  components/          UIコンポーネント
data/
  cases.json           収益化事例カタログ
  rankings.json        手法ランキング
worker/                Cloudflare Worker（購読API・配信API）
  schema.sql           D1 のテーブル定義
scripts/
  weekly-research.mjs  週次リサーチエージェント
  send-newsletter.mjs  ニュースレター配信
.github/workflows/     定期実行・デプロイ・CI
docs/SETUP.md          セットアップ手順
```

---

## はじめかた

セットアップは [`docs/SETUP.md`](docs/SETUP.md) にまとめてあります。

```bash
npm install
npm run build          # サイトをビルド
npm run db:init:local  # ローカルD1にテーブルを作成
npm run preview        # http://localhost:8787 で API 込みで確認
```

主なコマンド:

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | Astro の開発サーバー（APIは動きません） |
| `npm run preview` | Worker 込みのローカル実行 |
| `npm run deploy` | ビルドして Cloudflare へデプロイ |
| `npm run agent:weekly -- --dry-run` | 週次リサーチを書き込みなしで試す |
| `npm run agent:newsletter -- --dry-run` | 配信対象の件数だけ確認する |

---

## APIエンドポイント

| メソッド | パス | 用途 |
| --- | --- | --- |
| `POST` | `/api/subscribe` | 購読申込（確認メールを送る） |
| `GET` | `/api/confirm?token=` | 購読の確認（ダブルオプトイン） |
| `GET` `POST` | `/api/unsubscribe?token=` | 配信停止（POST は RFC 8058 ワンクリック用） |
| `POST` | `/api/newsletter/send` | 配信実行（Bearer トークン必須） |
| `GET` | `/api/health` | 死活確認 |

---

## 個人情報の取り扱いについて

メールアドレスは個人情報として扱う前提で実装しています。

- **ダブルオプトイン** — 確認メールのリンクを踏むまで購読は成立しません
- **同意の記録** — 申込・確認・停止の日時とIP、User-Agent を `consent_log` に保存します
- **配信停止** — 全メールのフッターにリンクを置き、`List-Unsubscribe` ヘッダーにも対応しています
- **送信者情報の明示** — 特定電子メール法に基づき、全メールに運営者名・所在地・連絡先を記載します
- **トークンの保護** — 確認トークンはハッシュのみ保存、配信停止トークンはHMACで都度導出します
- **越境移転の開示** — Cloudflare（米国）・Resend（米国）への委託をプライバシーポリシーに記載しています

`/privacy/` のプライバシーポリシーは雛形です。**公開前に運営者情報を実在の値に差し替え、
実際の運用に合っているか確認してください**（本実装は法的助言ではありません）。

---

## 記事の品質について

エージェントには次の制約を課しています。

- 売上・利用者数・料金などの数値は、一次情報で確認できたものだけ書く
- 確認できなかった数値は「未確認」と明記し、推測で埋めない
- すべての記事に出典リンクを添える
- 自動生成であることを記事上に明示する
- ランキングのスコア変更は1回あたり1点まで、理由を `changelog` に残す
