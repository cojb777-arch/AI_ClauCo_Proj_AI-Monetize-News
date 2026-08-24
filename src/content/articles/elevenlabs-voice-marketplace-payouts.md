---
title: "ElevenLabs の声マーケットプレイスを分解する — 素材の提供者に分配する収益モデル"
description: "ElevenLabs は買い手からクレジットで課金し、声の提供者へ1,000文字あたりで分配しています。公開されている単価から取り分の構造を計算し、個人が同じ両面市場を小さく作る条件と障壁を整理します。"
pubDate: 2026-08-24
category: research
tags: ["収益モデル", "マーケットプレイス", "音声合成", "価格設計"]
author: agent
sources:
  - title: "ElevenLabs Pricing for Creators & Businesses of All Sizes"
    url: "https://elevenlabs.io/pricing"
    publisher: "ElevenLabs"
  - title: "ElevenAPI Pricing for creators and businesses of all sizes"
    url: "https://elevenlabs.io/pricing/api"
    publisher: "ElevenLabs"
  - title: "Payouts | ElevenLabs Documentation"
    url: "https://elevenlabs.io/docs/eleven-creative/voices/payouts"
    publisher: "ElevenLabs"
  - title: "Voice Library | ElevenLabs Documentation"
    url: "https://elevenlabs.io/docs/eleven-creative/voices/voice-library"
    publisher: "ElevenLabs"
  - title: "What are custom rates and credit multipliers? | ElevenLabs Documentation"
    url: "https://elevenlabs.io/docs/help-center/product/voice-customization/voice-library/what-are-custom-rates-and-credit-multipliers"
    publisher: "ElevenLabs"
  - title: "How to monetize your voice with ElevenLabs Voice Library"
    url: "https://elevenlabs.io/blog/monetize-your-voice-with-elevenlabs-voice-library-and-create-passive-income"
    publisher: "ElevenLabs"
  - title: "$22M earned by voice creators, doubling in 6 months"
    url: "https://elevenlabs.io/blog/22-million-earned-by-voice-creators-on-elevenlabs"
    publisher: "ElevenLabs"
  - title: "The ElevenLabs Voice Library Addendum"
    url: "https://elevenlabs.io/vla"
    publisher: "ElevenLabs"
---

AIプロダクトの多くは「モデルの出力を売る」一面市場です。ElevenLabs の音声合成も表面上はそう見えますが、実際には**素材の提供者に金銭を分配する両面市場**が組み込まれています。声を貸した個人が、その声が使われた分だけ報酬を受け取る仕組みです。

同社の公式ブログによれば、Voice Library の提供者が受け取った累計報酬は2025年11月時点で1,100万ドル、2026年5月22日公開の投稿では**2,200万ドルを超え、6か月で倍増**したとされています。同投稿は報酬を得ている提供者を **10,400人以上**としています。個人が収益を得る側に立てる構造なので、買い手側と売り手側を分けて分解します。

## 買い手側：クレジットの階層課金

公式料金ページに掲載されている月額プランと同梱クレジットは次の通りです（2026年8月24日確認）。

| プラン | 月額 | 同梱クレジット |
| --- | --- | --- |
| Free | $0 | 10,000 |
| Starter | $6 | 30,000 |
| Creator | $22 | 121,000 |
| Pro | $99 | 600,000 |
| Scale | $299 | 1,800,000 |
| Business | $990 | 6,000,000 |

同ページは、年額払いが「10か月分の支払いで2か月無料に相当」すること、**商用ライセンスは Starter 以上**に付くこと、未使用クレジットは最大2か月分繰り越せて残高上限は月間枠の3倍であること（Free は対象外）を示しています。不足分は繰り越し上限の対象外となる従量トップアップで買い足す形です。

一方 API 料金ページは、同じ従量軸を**1,000文字あたりのドル価格**で公開しています。v3 と v2 Multilingual が $0.10、v3 Conversational と Flash / Turbo が $0.05 です。プラン側は「クレジット」、API 側は「文字」で表示されており、両者の換算率は料金ページ上には出ていません。**プラン単価と API 単価を直接比べることはできない**点に注意してください。

## 売り手側：1,000文字あたりの分配

公式ドキュメントによれば、報酬を受け取るには Creator プラン以上で Professional Voice Clone を作り、Voice Captcha による本人確認を通し、Voice Library に公開する必要があります。ドキュメントは学習用に約2時間の高品質な録音を求めており、公式ブログは最低30分としています。さらに**受け取り続けるには Starter 以上の有料契約の維持**と Stripe Connect の設定が要ります。

分配額の決まり方は、公式ドキュメント上では数値が公開されていません。Voice Library Addendum（利用規約の追補）は、報酬が「利用したユーザーの料金プラン」「生成された文字数」「選択した Notice Period」で決まるとし、**無料ユーザーの利用は報酬の対象外**と明記しています。Notice Period は公開を取り下げてから声が使えなくなるまでの猶予期間で、ドキュメントは最短30日・最長2年、長いほど報酬が増えると説明しています。ただし**一度公開したら短くはできず、延長しかできません**。

具体的な単価は公式ブログ（2025年6月25日公開、2026年7月28日更新）にのみ示されており、既定は 1,000文字あたり約 $0.03、HQ ステータスや希少性のある声は最大 $0.20 まで、とされています。ただしこの上限に関わるカスタムレートは、現在のドキュメントで**新規公開の声には使えないレガシー機能**と説明されています。既存のカスタムレート付きの声は「クレジット乗数」として買い手側のコストに転嫁され、2倍の乗数なら生成に2倍のクレジットを消費します。

支払いは Stripe Connect 経由で、残高が最低額（多くの国で $10）を超えると6〜8日ごとに自動処理されます。対応は64か国に限られ、税務申告は受け取る側の責任です。

## 取り分を計算する

単位が揃っている数字だけで比べると、API 表示価格 $0.10 / 1,000文字（v3・v2 Multilingual）に対して既定の分配は $0.03 / 1,000文字、つまり**提供者の取り分は約3割**です。$0.05 のモデルで生成された場合は約6割になります。実際の請求はプラン同梱枠を通るため、この比率はあくまで公開単価どうしの比較です。

累計2,200万ドルを 10,400人で割ると1人あたり約2,100ドルですが、これは**サービス開始からの累計**であり、分布も偏っているはずです。月収の目安として読むべき数字ではありません。個々の提供者の実収入は公開されていません。

## 弱点とリスク

- **単価が事業者の裁量**：既定レートは規約とブログにしかなく、算定式は非公開。将来の据え置きも約束されていません。
- **上振れの手段が閉じている**：新規参入者はカスタムレートを選べず、上限に近い単価を取りに行けません。
- **撤退が遅い**：Notice Period は延長のみ可能で、公開済み出力は期間終了後も残ります。
- **有料契約が前提**：報酬を受け取り続けるには月額を払い続ける必要があり、少額の受取なら実質赤字になり得ます。
- **単一プラットフォーム依存**：掲載可否は運営の裁量で、対応国も限定されています。

## 個人がこの構造を小さく再現するには

学ぶべきなのは音声合成そのものではなく、**「素材の供給者に従量で分配する両面市場」**という型です。小さく作るなら、必要になるのは次の4点です。

1. **計測単位**：文字数のように、供給者の貢献を機械的に数えられる単位。数えられないものは分配できません。
2. **供給者の本人確認**：権利の帰属を確認する手順。ElevenLabs は録画による確認を課しています。
3. **支払いインフラ**：Stripe Connect のようなマーケットプレイス送金。最低額と支払い頻度をまとめて処理コストを下げます。
4. **無料利用の切り離し**：無料枠の利用を分配対象から外さないと、集客コストが分配額として二重に出ていきます。

障壁は需要側です。供給者は分配額が出て初めて集まるため、**先に買い手のトラフィックを作る必要**があります。供給者を先に集める設計にすると、報酬ゼロの期間が長引いて離脱します。個人が始めるなら、既存の顧客がいる領域で、素材の一部だけを外部から調達する形が現実的です。

## まとめ

ElevenLabs の収益モデルは、買い手からのクレジット課金と、素材提供者への従量分配が同じ「文字数」という軸で接続されている点が要です。公開単価どうしで見れば提供者の取り分は約3割、単価の決定権は完全に事業者側にあります。

次に検証すべきなのは、自分の事業で**貢献を数えられる単位が定義できるか**です。数えられるなら分配できます。数えられないなら、両面市場ではなく買い切りの外注として設計したほうが破綻しません。単価の交渉余地が閉じていく方向（カスタムレートのレガシー化）も、供給者として参加する前に見ておく価値があります。
