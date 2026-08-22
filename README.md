# AI Monetize Lab

AIで収益を上げているサービスの実例と、その収益化ノウハウを**毎週リサーチして公開する**研究メディアです。

リサーチ・執筆・カタログ更新・公開までを、週1回のエージェントが自動で実行します。

---

## できること

| 機能 | 内容 |
| --- | --- |
| 研究記事の自動生成 | 毎週 Claude が Web検索でAI収益化事例を調査し、出典付きの記事を書いて公開する |
| 収益化事例カタログ | 掲載済みサービスの料金・提供状況を毎週確認して更新する |
| 手法ランキング | 収益化手法を5軸で相対評価し、根拠が出たときだけスコアを見直す |
| RSS配信 | 更新をRSSフィードで購読できる |

読者の個人情報は一切取得しません。会員登録もメールマガジンもフォームもない、静的サイトです。

## 技術構成

| 層 | 使うもの |
| --- | --- |
| サイト | Astro（静的生成） |
| ホスティング | Cloudflare Workers または GitHub Pages（どちらも対応） |
| リサーチ・執筆 | Claude Code（GitHub Actions 上で実行） |
| 認証 | Claude のサブスクリプション（Pro / Max）。APIキー不要 |
| 定期実行 | GitHub Actions（cron） |

サーバー側の処理を持たないため、静的ホスティングならどこにでも置けます。
GitHub Actions のデプロイワークフローは Cloudflare Workers と GitHub Pages の
両方に対応していて、設定した方だけが動きます（両方同時でも構いません）。
サブディレクトリ配信（`<user>.github.io/<repo>/`）でもリンクが壊れないよう、
サイト内リンクは `BASE_PATH` に追従します。

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
scripts/
  validate-content.mjs 生成物の検証（ルール違反を機械的に弾く）
docs/
  agent/weekly-research.md  週次エージェントへの手順書
  SETUP.md                  セットアップ手順
.github/workflows/     定期実行・デプロイ・CI
```

---

## はじめかた

セットアップは [`docs/SETUP.md`](docs/SETUP.md) にまとめてあります。

```bash
npm install
npm run dev      # http://localhost:4321
```

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` | サイトをビルド（`dist/`） |
| `npm run preview` | ビルド結果をローカルで確認 |
| `npm run deploy` | ビルドして Cloudflare へデプロイ |
| `npm run validate` | 記事とデータの内容を検証する |

---

## 週次エージェントの仕組み

毎週月曜、GitHub Actions が Claude Code を起動します。エージェントは
[`docs/agent/weekly-research.md`](docs/agent/weekly-research.md) の手順書を読んで、
Web検索で事例を調べ、記事を書き、事例カタログとランキングを更新します。

認証には **Claude のサブスクリプション（Pro / Max）** を使うため、
Anthropic API の従量課金は発生しません。手元で `claude setup-token` を実行して
得たトークンを、GitHub Secrets に `CLAUDE_CODE_OAUTH_TOKEN` として登録します。

エージェントはコードで縛られていないので、書かれた内容は
`scripts/validate-content.mjs` が機械的に検証します。
検証に落ちたものはコミットされず、公開されません。

| 検証項目 | 内容 |
| --- | --- |
| 変更範囲 | 記事の新規追加と2つのJSON以外を触っていないか |
| 既存記事 | 編集・削除されていないか（追加のみ許可） |
| frontmatter | 必須項目、日付形式、カテゴリ、タグ数 |
| 出典 | 1件以上あるか、URLが実在する形式か |
| 本文 | h1を使っていないか、短すぎないか |
| 事例カタログ | JSONが壊れていないか、id重複、事例が減っていないか |
| ランキング | スコアが1〜5か、変更幅が1点以内か、理由が残っているか |

## 記事の品質と法的リスクへの配慮

エージェントには次の制約を課しています。

**正確さ**
- 売上・利用者数・料金などの数値は、一次情報で確認できたものだけ書く
- 確認できなかった数値は「未確認」と明記し、推測で埋めない
- すべての記事に出典リンクを添える
- 自動生成であることを記事上に明示する
- ランキングのスコア変更は1回あたり1点まで、理由を `changelog` に残す

**著作権**
- 参照元の文章をコピーせず、自分の言葉で書き直す
- 引用が必要な場合のみ blockquote で最小限にとどめ、直後に出所を書く
- 料金表などの事実データは転記せず、整理し直して出典を添える

**名誉・信用**
- 特定の個人・企業について、確認できない不利益な断定を書かない
- 問題を指摘する場合は、確認できた事実と誰の見解かを分けて書く

## 運用中に困ったら

週次リサーチが失敗するようになったら、まず**トークンの期限切れ**を疑ってください。
症状の見分け方と復旧手順は
[`docs/SETUP.md` の「困ったときは」](docs/SETUP.md#7-困ったときは)にまとめてあります。

要点だけ書くと、手元で `claude setup-token` を実行し直し、
GitHub の Secrets の `CLAUDE_CODE_OAUTH_TOKEN` を新しい値で上書きするだけです。

## 公開前に差し替えるもの

- `src/config.ts` の `SITE`（サイト名）と `PUBLISHER`（運営者名・連絡先）
  - 連絡先は空にすると、フッターと各ページから連絡先の表示が消えます
- Cloudflare を使う場合: `wrangler.toml` の `name`、GitHub の Variables に `SITE_URL`
- GitHub Pages を使う場合: Settings → Pages の Source を「GitHub Actions」に変更
  （同じ画面の「Configure」ボタンは押さないこと。デプロイ処理はすでにあります）

`/privacy/` のプライバシーポリシーと `/about/` の免責事項は雛形です。
公開前に自分の運用に合っているか確認してください（本実装は法的助言ではありません）。
