# セットアップ手順

初回に一度だけ行う作業です。所要 15〜30分。

---

## 全体像

```
GitHub Actions（毎週月曜 09:00 JST）
   │
   ├─ 1. claude-code-action（Claude のサブスク枠で動く）
   │       docs/agent/weekly-research.md の手順書に従って
   │       Web検索で事例を調査 → 記事Markdownを生成
   │       data/cases.json・data/rankings.json も更新
   │
   ├─ 2. scripts/validate-content.mjs で検証
   │       ルール違反があればここで停止し、コミットしない
   │
   ├─ 3. git commit & push
   │
   └─ 4. npm run build（Astro）→ Cloudflare / GitHub Pages へ配信
```

サーバー側の処理は持たないため、データベースは不要です。
リサーチは Claude のサブスクリプション枠で動くので、Anthropic API キーも不要です。

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
| `CLAUDE_CODE_OAUTH_TOKEN` | 週次リサーチを動かす場合 | Claude サブスクリプションのトークン（下記参照） |
| `CLOUDFLARE_API_TOKEN` | Cloudflareを使う場合 | `Edit Cloudflare Workers` 権限のAPIトークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflareを使う場合 | Cloudflare アカウントID |

### CLAUDE_CODE_OAUTH_TOKEN の取り方

週次エージェントは **Claude のサブスクリプション（Pro / Max）の枠**で動きます。
Anthropic API の従量課金は発生しません。

手元のターミナルで次を実行します。

```bash
claude setup-token
```

ブラウザが開いて認証を求められ、完了するとトークンが表示されます。
その値を GitHub の Secrets に `CLAUDE_CODE_OAUTH_TOKEN` という名前で登録してください。

> **注意**
> - このトークンは、実行した人のサブスクリプションに紐づきます。
>   週次リサーチの消費は、普段 Claude Code や Claude アプリを使う枠と共通です。
> - 有効期限があります。切れたら同じ手順で発行し直して Secrets を更新してください。
> - 手元で Claude Code を使うときに `ANTHROPIC_API_KEY` を環境変数に設定していると、
>   サブスクではなくAPI従量課金が使われます。設定していないか確認してください。

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

### 週次エージェントを試す（公開なし）

Actions → 「週次リサーチと公開」→ Run workflow で、
**`dry_run` にチェックを入れて実行**します。

エージェントが記事を書いて検証まで行いますが、コミットも公開もしません。
生成された記事の全文は、実行結果の Summary に表示されるのでそこで品質を確認できます。

納得できたらチェックを外して実行すると、実際に公開されます。

### 記事の内容だけ検証する

```bash
npm run validate
```

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
- [ ] `CLAUDE_CODE_OAUTH_TOKEN` を登録した
- [ ] 週次リサーチを `dry_run` で1回実行し、生成される記事の品質を確認した

---

## 7. ワークフローの安全性について

`.github/workflows/` で使っている外部アクションは、すべて**コミットSHAで固定**しています。

```yaml
uses: anthropics/claude-code-action@dcb5774… # v1
```

`@v1` のようなタグは作者が向き先を変えられるため、万一そのアカウントが乗っ取られると、
次の実行で悪意あるコードが動き、Secrets に登録したトークンを抜かれる恐れがあります。
SHAで固定しておけば、タグが差し替えられてもこちらは元のコードを使い続けます。

固定したままでは更新が届かないので、**Dependabot** で補っています
（`.github/dependabot.yml`）。新しい版が出ると
「SHAをこれに上げませんか」というプルリクエストが自動で作られるので、
中身を確認してマージしてください。自動では適用されません。

| 対象 | 頻度 |
| --- | --- |
| GitHub Actions | 毎週月曜 |
| npm パッケージ（Astro など） | 毎月 |

> Dependabot のPRが来たら、`Files changed` で差分を確認してからマージしてください。
> SHAが変わるだけの小さな差分のはずです。見慣れない変更が混ざっていたら、
> マージせずに内容を確認してください。

そのほか、Secrets を扱うワークフローは `schedule` と `workflow_dispatch` でしか
起動しないようにしてあります。プルリクエストからは起動しないため、
第三者がPR経由でトークンを引き出すことはできません。

---

## 8. 将来、広告やアフィリエイトを入れる場合

いまの構成では不要ですが、収益化する段階で以下が必要になります。

- **ステマ規制（景品表示法）** — アフィリエイトリンクや、提供を受けて書いた記事には
  「広告」「PR」と明示する必要があります。記事の frontmatter に区分を持たせ、
  該当記事の冒頭に表示する仕組みを足すことになります。
- **アクセス解析を入れる場合** — 取得する情報と目的をプライバシーポリシーに追記します。
- **自分で商品を売る場合** — 特定商取引法に基づく表記（氏名・住所・電話番号等）が必要になります。
