# セットアップ手順

初回に一度だけ行う作業です。所要 15〜30分。

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
   └─ 3. npm run build（Astro）→ npx wrangler deploy
           静的サイトを Cloudflare へ配信
```

サーバー側の処理は持たないため、データベースもAPIキーの受け渡しも不要です。

---

## 1. 設定値の差し替え

### `src/config.ts`

| 項目 | 内容 |
| --- | --- |
| `SITE.name` | サイト名 |
| `SITE.tagline` | 一行の説明 |
| `PUBLISHER.name` | 運営者名（フッターとプライバシーポリシーに表示） |
| `PUBLISHER.contactEmail` | 掲載内容についての連絡先 |

> 運営者名と連絡先は法的な表示義務ではありませんが、
> 掲載取り下げの依頼や誤りの指摘を受けられる窓口がないサイトは信頼されません。記載を推奨します。

### `wrangler.toml`

`name` を自分のWorker名に変えます（`https://<name>.<サブドメイン>.workers.dev` になります）。

---

## 2. 公開先を選ぶ

このサイトはサーバー側の処理を持たない静的サイトなので、どこにでも置けます。
`.github/workflows/deploy.yml` は **Cloudflare Workers と GitHub Pages の両方に対応**しており、
設定した方だけが動きます（両方同時でも構いません）。

| | Cloudflare Workers | GitHub Pages |
| --- | --- | --- |
| URL | `<name>.<サブドメイン>.workers.dev` または独自ドメイン | `<user>.github.io/<repo>/` |
| base パス | `/`（ルート配信） | `/<repo>/`（サブディレクトリ配信） |
| 独自ドメイン | 無料・DNSもCloudflare上で完結 | 可能（CNAME設定が必要） |
| 将来APIを足す | そのまま同じWorkerに追加できる | 不可（別サービスが必要） |
| 設定の手間 | APIトークンの発行が必要 | リポジトリ設定だけで済む |

まず動かして見たいだけなら GitHub Pages が最短です。
独自ドメインで本運用するなら Cloudflare が扱いやすいです。

### 2-A. Cloudflare Workers

```bash
npx wrangler login
npm run deploy
```

`wrangler.toml` の `name` を自分のWorker名に変えてください
（`https://<name>.<サブドメイン>.workers.dev` になります）。
独自ドメインは Workers & Pages → 対象Worker → 設定 → ドメインとルート から追加します。

> **「有効な URL がありません」と表示される場合**
> デプロイは成功しているのに外から見られない、という状態です。
> workers.dev の公開が無効になっているのが原因で、`wrangler.toml` の
> `workers_dev = true` で有効になります（設定済み）。
> ダッシュボードから直す場合は、対象Worker → 設定 → ドメインとルート →
> workers.dev を「有効」に切り替えます。

> **ダッシュボードからGitHubリポジトリを接続する場合（Workers Builds）**
> 「プロジェクト名」は `wrangler.toml` の `name` と**同じ値**にしてください。
> 食い違うと、意図しない名前の Worker が作られます。
> ビルドコマンドは `npm run build`、デプロイコマンドは `npx wrangler deploy` です。
> 「Protect with Cloudflare Access」は**オフのまま**にしてください。
> オンにすると閲覧にログインが必要になり、検索エンジンもクロールできなくなります。

> **Workers と Pages のどちらを使うべきか**
> 静的サイトの配信に関しては、どちらも同じことができます。
> ただし Cloudflare は**新規プロジェクトには Workers を推奨**しており、
> Pages は既存プロジェクトの維持が中心で、新機能は Workers 側に入っています。
> このリポジトリは Workers 前提（`wrangler.toml` の `[assets]`）で設定してあります。
> 将来APIやDBを足したくなったとき、同じWorkerに追記するだけで済むのも利点です。

### 2-B. GitHub Pages

Settings → Pages → **Source を「GitHub Actions」に変更**するだけです。
`main` に push すると自動でデプロイされ、公開URLが同じ画面に表示されます。

> **その画面の「Configure」ボタンは押さないでください。**
> 「GitHub Pages Jekyll」「Static HTML」はどちらもサンプルのワークフローを
> 新規に追加するボタンです。このリポジトリには専用のデプロイ処理
> （`.github/workflows/deploy.yml`）がすでにあるため、
> 追加すると Jekyll がAstroのソースをそのままビルドしようとして壊れます。
> 押してしまった場合は、追加された `.github/workflows/jekyll-gh-pages.yml`
> （または `static.yml`）を削除してください。

> 公開URLは**最初のデプロイが成功するまで表示されません**。
> Source を変更した直後は空欄のままですが、異常ではありません。

> プロジェクトサイトは `https://<user>.github.io/<repo>/` というサブディレクトリ配信になります。
> ワークフローが `BASE_PATH` を自動で渡すので、サイト内リンクは自動で調整されます。
> `SITE_URL` の Variable を設定していても、GitHub Pages 側のビルドでは
> Pages が返す実際のURLが優先されます。

---

## 3. GitHub の設定

Settings → Secrets and variables → Actions で登録します。

**Secrets**

| 名前 | 必要な場合 | 内容 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | 常に必要 | Claude API キー |
| `CLOUDFLARE_API_TOKEN` | Cloudflareを使う場合 | `Edit Cloudflare Workers` 権限のAPIトークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflareを使う場合 | Cloudflare アカウントID |

**Variables**

| 名前 | 必要な場合 | 内容 |
| --- | --- | --- |
| `SITE_URL` | Cloudflareを使う場合 | 公開URL（末尾スラッシュなし） |

Cloudflare のシークレットを設定していない場合、該当ジョブは
「スキップしました」という通知を出して正常終了します。エラーにはなりません。

GitHub Pages 側は Variables の設定は不要です。
Settings → Pages の Source が「GitHub Actions」になっていれば動きます。

---

## 4. 動作確認

### ローカルで見る

```bash
npm run dev        # http://localhost:4321
```

### 週次エージェントを試す（書き込みなし）

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run agent:weekly -- --dry-run
```

生成される記事と更新内容が標準出力に表示されます。
内容に納得できたら `--dry-run` を外して実行すると、実際にファイルが書き出されます。

### GitHub Actions から手動実行

Actions → 「週次リサーチと公開」→ Run workflow。
`dry_run` にチェックを入れると、書き込みを行わずに動作だけ確認できます。

---

## 5. 定期実行について

`schedule` は**デフォルトブランチ上のワークフローだけ**が実行されます。
作業ブランチのままではcronは動きません。`main` にマージしてください。

cron は UTC で指定します。`0 0 * * 1` は月曜 00:00 UTC = **月曜 09:00 JST** です。
曜日や時刻を変えるときは `.github/workflows/weekly-research.yml` の `cron` を編集します。

---

## 6. 公開前チェックリスト

- [ ] `src/config.ts` のサイト名・運営者名・連絡先を実在の値にした
- [ ] 公開先を決めて設定した（Cloudflare のシークレット、または Pages の Source）
- [ ] Cloudflare を使う場合、`wrangler.toml` の `name` を変えた
- [ ] `/privacy/` と `/about/` の内容を自分の運用に合わせて確認した
- [ ] `npm run agent:weekly -- --dry-run` で生成される記事の品質を確認した

---

## 7. 将来、広告やアフィリエイトを入れる場合

いまの構成では不要ですが、収益化する段階で以下が必要になります。

- **ステマ規制（景品表示法）** — アフィリエイトリンクや、提供を受けて書いた記事には
  「広告」「PR」と明示する必要があります。記事の frontmatter に区分を持たせ、
  該当記事の冒頭に表示する仕組みを足すことになります。
- **アクセス解析を入れる場合** — 取得する情報と目的をプライバシーポリシーに追記します。
- **自分で商品を売る場合** — 特定商取引法に基づく表記（氏名・住所・電話番号等）が必要になります。
