# CryptoNinja 同人お助けサイト

CryptoNinja NFT キャラクターの二次創作（同人）制作を助けるための静的サイトです。

## 今あるもの

- **キャラクター図鑑** (`index.html`) — 全38キャラの設定・忍術・武器・誕生日・得意ジャンル・相関関係・作画プロンプト（chibi / 通常頭身 / 現代パロ / SF / ファンタジー / 異世界）を検索・フィルタ付きで閲覧できます。プロンプトはワンクリックでコピー可能。
- **画像置き場** (`images/characters/`) — キャラごとのフォルダに画像を置くと図鑑に自動表示されます。
- **SVGモーションシステム** (`motion.html`) — SVGキャラをモーション付きで動かせるゲーム支援ツール。図鑑ヘッダーのリンクから開けます。
- **キャラシート分割** (`sheet.html?no=001`) — キャラ1体ずつの独立シートページ。前後キャラ移動、1体分のJSONダウンロード付き。
- **ゲーム組み込みガイド** (`embed.html`) — シートをゲーム等に取り込む4つの方法（iframe / `<cn-sheet>` Web Component / `js/cn-data.js` API / 生JSON）をライブデモ付きで解説。
- **キャラシート自動生成** (`.github/workflows/generate-sheet.yml`) — GitHub Actions から fal.ai（Nano Banana / Gemini画像生成）を呼び、`output_prompt` を基にキャラのモデルシートを生成してリポジトリに保存します。

## 使い方

静的サイトなので、ローカルで見るには：

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

### 公開（GitHub Pages）

`.github/workflows/pages.yml` により、既定ブランチへの push で自動デプロイされます。**初回のみ** リポジトリの **Settings → Pages → Build and deployment → Source** を **「GitHub Actions」** に設定してください。公開URL: `https://<ユーザー名>.github.io/<リポジトリ名>/`

## キャラシートを fal.ai で生成する

GitHub Actions 上で fal.ai を呼び、モデルシート（三面図＋世界観バリエ＋表情グリッド＋ドット絵）や各画風バリエを生成します。

**セットアップ（初回のみ）**

1. [fal.ai](https://fal.ai/) で API キーを取得
2. リポジトリの **Settings → Secrets and variables → Actions → New repository secret** で
   - Name: `FAL_KEY`
   - Secret: 取得したキー
   を登録

**実行**

1. **Actions** タブ →「**Generate Character Sheet (fal.ai)**」→ **Run workflow**
2. 入力項目:

   | 入力 | 説明 |
   |---|---|
   | `character` | キャラ番号か名前（例 `032` / `Seori`） |
   | `variant` | `sheet`（モデルシート全体）または画風（`chibi`/`normal`/`modern`/`scifi`/`fantasy`/`isekai`） |
   | `ref_mode` | 参照画像 `ref.png` の利用。`auto`（あれば使う）/`on`/`off` |
   | `num` | 生成枚数（1〜4） |
   | `model_tier` | `pro`（既定・Nano Banana Pro／Gemini 3 Pro Image）/ `standard`（Nano Banana／Gemini 2.5 Flash Image、安価・高速） |
   | `resolution` | `pro`時のみ有効。空欄なら `sheet`=2K、それ以外=1K（`1K`/`2K`/`4K`を指定可） |
   | `dry_run` | ✅ で生成せず送信内容だけ確認 |

3. 生成物は自動で `images/characters/<番号>_<名前>/` に保存・コミットされます
   - `variant=sheet` → `sheet.png`（シートページのモデルシート欄に自動表示）
   - それ以外 → `gen-<variant>.png`

**同一性を高めたい場合**: `images/characters/<番号>_<名前>/ref.png` に元NFT画像を置くと、`ref_mode=auto`/`on` で image-to-image（`nano-banana/edit`）が使われ、顔・配色・装備を寄せて生成します。

**ローカルで試す**（任意）:

```bash
cd scripts && npm install
FAL_KEY=xxx CHAR=032 VARIANT=sheet DRY_RUN=1 node generate-sheet.mjs  # 送信内容の確認
FAL_KEY=xxx CHAR=032 VARIANT=sheet node generate-sheet.mjs            # 実生成
```

## 画像の置き方

`images/characters/<番号>_<名前>/` に以下の名前で置いてください：

| ファイル名 | 用途 |
|---|---|
| `main.png` | 一覧カードのサムネイル＋詳細ギャラリー |
| `01.png` 〜 `12.png` | 詳細ページのギャラリー |

例: `images/characters/001_jin/main.png`

## データ

- `data/characters.json` — キャラクターデータ（出典: https://www.ninja-dao.com/characters）
- 注意: chibi プロンプトの視覚特徴は Jin のみ実画像参照。他キャラは設定テキストからの推定を含むため、公式ビジュアルと差異がある可能性があります。

## ライセンス・二次創作について

CryptoNinja の二次創作ガイドラインに従ってください: https://www.crypto-ninja.jp/
