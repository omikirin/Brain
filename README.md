# CryptoNinja 同人お助けサイト

CryptoNinja NFT キャラクターの二次創作（同人）制作を助けるための静的サイトです。

## 今あるもの

- **キャラクター図鑑** (`index.html`) — 全38キャラの設定・忍術・武器・誕生日・得意ジャンル・相関関係・作画プロンプト（chibi / 通常頭身 / 現代パロ / SF / ファンタジー / 異世界）を検索・フィルタ付きで閲覧できます。プロンプトはワンクリックでコピー可能。
- **画像置き場** (`images/characters/`) — キャラごとのフォルダに画像を置くと図鑑に自動表示されます。
- **SVGモーションシステム** (`motion.html`) — SVGキャラをモーション付きで動かせるゲーム支援ツール。図鑑ヘッダーのリンクから開けます。
- **キャラシート分割** (`sheet.html?no=001`) — キャラ1体ずつの独立シートページ。前後キャラ移動、1体分のJSONダウンロード付き。
- **ゲーム組み込みガイド** (`embed.html`) — シートをゲーム等に取り込む4つの方法（iframe / `<cn-sheet>` Web Component / `js/cn-data.js` API / 生JSON）をライブデモ付きで解説。
- **同人スタジオ** (`studio.html`) — キャラ2人とジャンルを選んで、小説→ネーム→漫画原稿（見開き2P・各ページ3コマ）まで作れる制作支援ページ。
- **シートリーダー** (`reader.html`) — 16pシート画像を見開き漫画として読めるビューア（ポップUI・セリフオーバーレイ・単ページ/16p一覧切替・スワイプ対応）。サンプル作品『おむかえのお願い』収録。クリプト忍者のシートは 同人スタジオ(工程②)のネームJSON → `scripts/generate_sheets.py`（fal.ai）で生成し `?work=ninja` で読めます。
- **購入者専用ページ** (`members.html`) — Brain購入者向けのパスワード保護ページ。本文・配布ファイルはAES-256-GCMで暗号化され、正しいパスワードでのみブラウザ内で復号されます（公開リポジトリでも中身は読めません）。
- **サイト全体の購入者ゲート** (`js/gate.js`) — 図鑑・シート・SVGモーション・組み込みガイド・同人スタジオの閲覧ページはすべて購入者ゲート配下。未認証でアクセスすると `members.html` に転送され、パスワード入力後に元のページへ戻ります（同ブラウザのタブを閉じるまで再入力不要）。
- **キャラシート自動生成** (`.github/workflows/generate-sheet.yml`) — GitHub Actions から fal.ai（Nano Banana / Nano Banana Pro）を呼び、`output_prompt` を基にキャラのモデルシートを生成してリポジトリに保存します。
- **モデルシート分割表示** (`scripts/split_sheet.py`) — 生成された1枚のモデルシート画像を三面図・世界観バリエ・表情・ドット絵ごとのパネル画像に切り出し、`sheet.html` の「モデルシート分割」欄に個別表示します。

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
   | `variant` | `sheet`（モデルシート全体）／ `row1`〜`row5`（崩れた行だけ横長で再生成: 1=ちび三面図 2=通常三面図 3=世界観バリエ 4=表情グリッド 5=ドット絵）／ `anime-sheet`（アニメ版シート全体・非ちび）／ `anime-row1`〜`anime-row4`（アニメ版の行単位: 1=三面図 2=アクションポーズ 3=表情 4=ゲームスプライト）／ 画風（`chibi`/`normal`/`modern`/`scifi`/`fantasy`/`isekai`） |
   | `ref_mode` | 参照画像 `ref.png` の利用。`auto`（あれば使う）/`on`/`off` |
   | `num` | 生成枚数（1〜4） |
   | `model_tier` | `pro`（既定・Nano Banana Pro／Gemini 3 Pro Image）/ `standard`（Nano Banana／Gemini 2.5 Flash Image、安価・高速） |
   | `resolution` | `pro`時のみ有効。空欄なら `sheet`=2K、それ以外=1K（`1K`/`2K`/`4K`を指定可） |
   | `dry_run` | ✅ で生成せず送信内容だけ確認 |

3. 生成物は自動で `images/characters/<番号>_<名前>/` に保存・コミットされます
   - `variant=sheet` → `sheet.png`（シートページのモデルシート欄に自動表示）
   - それ以外 → `gen-<variant>.png`

**参照画像（Character Ref）**: `images/refs/` にまとめて置きます（詳細は `images/refs/README.md`）。

- `images/refs/<番号>_<スラッグ>.png` — ベース（NFT/ちび）ref。`sheet`/`row*` 等の生成で使用
- `images/refs/anime/<番号>_<スラッグ>.png` — アニメ版ref（アニメ3面図シート）。`anime-sheet`/`anime-row*` で使用

refがあると `ref_mode=auto`/`on` で image-to-image（`nano-banana-pro/edit`）が使われ、顔・配色・装備を参照画像に寄せて生成します。旧来のキャラフォルダ内 `ref.png`/`anime-ref.png` も引き続き認識されます。

**アニメ版シート**: アニメ3面図refを基準に、アニメ頭身限定（非ちび）の設定資料——三面図・アクションポーズ・表情・ゲームスプライト（48×48/64×64）——を `variant=anime-sheet` で生成できます。生成物はキャラフォルダの `anime/` に保存され、シートページの「アニメ版シート」欄（アニメ版限定の表示）に自動で出ます。

**ローカルで試す**（任意）:

```bash
cd scripts && npm install
FAL_KEY=xxx CHAR=032 VARIANT=sheet DRY_RUN=1 node generate-sheet.mjs  # 送信内容の確認
FAL_KEY=xxx CHAR=032 VARIANT=sheet node generate-sheet.mjs            # 実生成
```

### モデルシートをパネルごとに分割表示する

`sheet.png` が生成されたら、パネル座標を目視で決めて `scripts/split_sheet.py` に追記し、実行すると
`images/characters/<番号>_<名前>/panels/<パネルID>.png` が作られ、`sheet.html` の「モデルシート分割」欄に
パネルごとの画像として自動表示されます（座標は生成のたびに微妙にレイアウトが変わるため、新しいキャラでは
都度確認・調整が必要です）。

```bash
python3 scripts/split_sheet.py 032
```

## 購入者専用ページの運用

1. `members-src.example.html` を `members-src.html` にコピーして本文を書く（このファイルは `.gitignore` 済みでリポジトリに載りません）
2. パスワードを決めて再生成:

```bash
PASSWORD='新しいパスワード' node scripts/build-members.mjs
```

3. 生成された `members.html` をコミット＆プッシュ（暗号文のみが公開されます）
4. Brainの購入者向け本文にパスワードを記載

### 配布ファイル（DL成果物）の非公開化

購入者にだけダウンロードさせたいファイル（JSON・ZIP・画像など）は `members-files/` に置いて再生成するだけです：

1. `members-files/` に配布したいファイルを置く（このフォルダは `.gitignore` 済み＝生データはリポジトリに載りません）
2. `PASSWORD='パスワード' node scripts/build-members.mjs` で再生成
   - 各ファイルが暗号化されて `members-data/*.enc` に出力されます（これをコミット）
   - 購入者ページに「📥 ダウンロード」欄が自動で出て、パスワード入力後にブラウザ内で復号→保存されます
3. `members.html` と `members-data/` をコミット＆プッシュ

公開されるのは暗号文（`.enc`）だけなので、公開サイト・公開リポジトリのままでもDL成果物は購入者以外に読めません。

現在の初期パスワードは `cryptoninja-brain`、配布物のサンプルとして `cryptoninja_characters.json` を暗号化済みです。**公開前に必ずパスワードを変更してください。**

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
