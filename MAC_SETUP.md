# Mac での iPhone ビルド手順

## 初回セットアップ

1. App Store から **Xcode** をインストールし、一度起動してライセンス同意 + iOS コンポーネントを入れる
2. Node.js LTS を入れる（未導入なら https://nodejs.org ）
3. リポジトリを取得して依存関係をインストール:

```bash
git clone https://github.com/Shota-Motu/childappPJ.git
cd childappPJ
npm install
```

> 既にクローン済みで pull しただけの場合も、`package.json` が変わっていたら
> 念のため `npm install` を実行してください（ネイティブ依存が増えているとビルドに反映されないため）。

## iPhone へビルド

1. iPhone を USB で接続（「このコンピュータを信頼」→ 信頼）
2. 実行:

```bash
npx expo run:ios --device
```

初回はネイティブの `ios/` フォルダ生成 + CocoaPods インストールが走るため数分かかります。

3. 署名エラーで止まったら:
   - `open ios/*.xcworkspace` で Xcode を開く
   - Xcode → Settings → Accounts で Apple ID を追加（無料アカウント可）
   - 左のプロジェクトナビゲータ → ターゲット → Signing & Capabilities → Team に Personal Team を設定
   - もう一度 `npx expo run:ios --device`
4. iPhone 側（初回のみ）:
   - 設定 → 一般 → VPN とデバイス管理 → 自分の Apple ID を「信頼」
   - 設定 → プライバシーとセキュリティ → デベロッパモード を ON（再起動あり）
5. 初回起動時、以下の許可ダイアログが順に出るので「許可」する:
   - カメラ / マイク（1秒動画の撮影用）
   - フォトライブラリ（撮り逃した日の取り込み用）
   - 通知（毎日のリマインド用。設定画面で ON にしたときに表示）

## うまくいかない時によくある原因

| 症状 | 原因と対処 |
|---|---|
| `xcrun: error: unable to find utility "xcodebuild"` | Xcode 未インストール、または `xcode-select --install` が未実行 |
| CocoaPods 関連のエラー | `sudo gem install cocoapods` してから再実行 |
| ビルドは通るが「Untrusted Developer」で起動できない | 上記 iPhone 側手順4（信頼設定）を先に行う |
| 数日後に急に起動しなくなった | 無料 Apple ID 署名は **7日で失効**。`npx expo run:ios --device` を再実行すれば直る |
| `run:ios` がプロジェクトの変化を拾わない | `ios/` フォルダは自動生成物（.gitignore 対象）。設定変更を反映したい時は `npx expo prebuild --clean` を挟んでから再ビルド |

## 以降の日常開発（Windows で OK）

dev build を一度 iPhone に入れれば、普段の JS/TS 編集は Windows 側で:

```powershell
npx expo start
```

iPhone と PC を同じ Wi-Fi につなぎ、dev build アプリを起動すると自動で開発サーバーに接続します。
Windows で編集したコードはそのまま反映されます。

**Mac が再び必要になるタイミング**（= ネイティブ層が変わる時）:
- 新しい expo パッケージ（ネイティブモジュールを含むもの）を追加した
- `app.json` の `plugins` や `ios`/`android` 設定を変更した
- Expo SDK 自体をアップデートした

このときは Mac 側で `git pull && npm install && npx expo run:ios --device` を再実行してください。
