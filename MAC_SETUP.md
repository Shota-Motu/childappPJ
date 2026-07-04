# Mac での iPhone ビルド手順

## 初回セットアップ

1. App Store から **Xcode** をインストールし、一度起動してライセンス同意 + iOS コンポーネントを入れる
2. Node.js LTS を入れる（未導入なら https://nodejs.org ）
3. このプロジェクトを展開して依存関係をインストール:

```bash
cd child-app
npm install
```

## iPhone へビルド

1. iPhone を USB で接続（「このコンピュータを信頼」→ 信頼）
2. 実行:

```bash
npx expo run:ios --device
```

3. 署名エラーで止まったら:
   - `open ios/*.xcworkspace` で Xcode を開く
   - Xcode → Settings → Accounts で Apple ID を追加（無料アカウント可）
   - プロジェクト → Signing & Capabilities → Team に Personal Team を設定
   - もう一度 `npx expo run:ios --device`
4. iPhone 側（初回のみ）:
   - 設定 → 一般 → VPN とデバイス管理 → 自分の Apple ID を「信頼」
   - 設定 → プライバシーとセキュリティ → デベロッパモード を ON（再起動あり）

## 以降の日常開発（Windows で OK）

dev build は一度入れれば、普段は Windows 側で:

```powershell
npx expo start
```

iPhone と PC を同じ Wi-Fi につなぎ、dev build アプリから開発サーバーに接続する。
Mac が再び必要になるのはネイティブ依存を追加・変更したときだけ。

> 注意: 無料 Apple ID の署名は 7 日で失効するため、切れたら再ビルドが必要。
