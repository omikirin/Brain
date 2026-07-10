/* CryptoNinja キャラシート生成スクリプト（fal.ai / Nano Banana Pro）
 *
 * GitHub Actions（.github/workflows/generate-sheet.yml）から呼ばれる想定。
 * 環境変数:
 *   FAL_KEY    … fal.ai の APIキー（必須／リポジトリ Secrets に登録）
 *   CHAR       … キャラ番号か名前（例 "032" / "Seori"）。既定 "032"
 *   VARIANT    … "sheet"(モデルシート全体) か prompts のキー
 *                (chibi/normal/modern/scifi/fantasy/isekai)。既定 "sheet"
 *   REF_MODE   … "auto"(参照画像があれば使う)/"on"/"off"。既定 "auto"
 *   NUM        … 生成枚数(1-4)。既定 1
 *   MODEL_TIER … "pro"(既定, Nano Banana Pro / Gemini 3 Pro Image) か
 *                "standard"(Nano Banana / Gemini 2.5 Flash Image)
 *   RESOLUTION … "1K"/"2K"/"4K"。既定は sheet=2K、それ以外=1K
 *
 * 出力:
 *   VARIANT=sheet  → images/characters/<no>_<slug>/sheet.png
 *   それ以外        → images/characters/<no>_<slug>/gen-<variant>.png
 *   複数枚時は末尾に -2, -3 … を付与
 */
import { fal } from '@fal-ai/client';
import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = (k, d) => process.env[k] && process.env[k].trim() ? process.env[k].trim() : d;

const CHAR = env('CHAR', '032');
const VARIANT = env('VARIANT', 'sheet');
const REF_MODE = env('REF_MODE', 'auto');
const NUM = Math.min(4, Math.max(1, parseInt(env('NUM', '1'), 10) || 1));
const MODEL_TIER = env('MODEL_TIER', 'pro') === 'standard' ? 'standard' : 'pro';

if (!process.env.FAL_KEY) {
  console.error('❌ FAL_KEY が未設定です。リポジトリの Settings → Secrets and variables → Actions に FAL_KEY を登録してください。');
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

const slug = name => name.toLowerCase().split('(')[0].trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const exists = async p => { try { await access(p, constants.F_OK); return true; } catch { return false; } };

async function main() {
  const data = JSON.parse(await readFile(path.join(ROOT, 'data/characters.json'), 'utf8'));
  const key = String(CHAR).toLowerCase();
  const c = data.characters.find(x =>
    x.no === CHAR || String(Number(CHAR)).padStart(3, '0') === x.no ||
    x.name.toLowerCase() === key || slug(x.name) === key);
  if (!c) { console.error(`❌ キャラが見つかりません: ${CHAR}`); process.exit(1); }

  const dir = `images/characters/${c.no}_${slug(c.name)}`;

  // プロンプトと比率を決定
  const ROW_TITLES = {
    row1: 'ROW 1 — "CHIBI TURNAROUND"',
    row2: 'ROW 2 — "FULL-BODY TURNAROUND"',
    row3: 'ROW 3 — "ALT-WORLD VARIANTS"',
    row4: 'ROW 4 — "EXPRESSION ICONS x WORLDS"',
    row5: 'ROW 5 — "PIXEL ART / DOT-E"',
  };
  // アニメ版シート仕様 — アニメ3面図を同一性の基準に、アニメ頭身に限定した設定資料を作る
  function buildAnimePrompt(ch) {
    const name = ch.name.split('(')[0].trim();
    const idMatch = ch.output_prompt?.en?.match(/IDENTITY \(absolute reference\): ([\s\S]*?)\n\n/);
    const identity = idMatch ? idMatch[1].trim() : (ch.prompts?.normal?.en || ch.name);
    return (
`Create ONE cohesive high-resolution ANIME character model sheet for the CryptoNinja character "${name}", on a clean light-grey background, divided into 4 horizontal bands. This sheet is ANIME-PROPORTION ONLY: every figure is drawn at a normal 7-to-8-head-tall anime body ratio with clean lineart and detailed cel-shading — absolutely NO chibi anywhere on this sheet.\n\n` +
`IDENTITY (absolute reference): ${identity} If a reference image is attached (an anime turnaround sheet), it OVERRIDES this text — match its face, hairstyle, colors, outfit and proportions exactly.\n\n` +
`TEXT RULES: render ONLY the caption strings listed below, in clean bold sans-serif capitals. Do not invent, alter or add any other text, letters or logos anywhere.\n\n` +
`HEADER (top of sheet): "ANIME MODEL SHEET: ${name.toUpperCase()}" and smaller "CRYPTONINJA".\n\n` +
`ROW 1 — caption "TURNAROUND": full body, neutral A-pose, exactly 3 views left-to-right labeled "FRONT" / "SIDE" / "BACK".\n\n` +
`ROW 2 — caption "ACTION POSES": exactly 4 dynamic full-body poses (running, attacking with signature weapon, jumping, signature ninjutsu stance), consistent design, no labels other than the row caption.\n\n` +
`ROW 3 — caption "EXPRESSION SHEET": a strict table of bust-up expression portraits in RECTANGULAR bordered cells with dark-navy cell backgrounds. EXACTLY 2 rows and EXACTLY 4 columns = 8 cells. Cell labels in order: "NEUTRAL" / "SMILE" / "ANGRY" / "SAD" / "SURPRISED" / "SHY" / "DETERMINED" / "LAUGH". Fill every cell — no empty cells, no circular frames.\n\n` +
`ROW 4 — caption "GAME SPRITES": retro pixel-art sprites of the SAME anime-proportioned (tall) character on a transparent-look checkerboard, in TWO labeled groups side by side, "48x48" and "64x64". Each group: idle sprites in 3 views (front/side/back) on one line, and a walking animation as ONE horizontal strip of EXACTLY 4 equal frames on the next line. Keep the tall proportions readable.\n\n` +
`REQUIREMENTS: identity consistent everywhere; no watermark; no cropping at panel edges; no duplicate or missing views; even lighting; captions exactly as specified. Usable as a production reference for anime and 2D games.\n\n` +
`SHEET LAYOUT: portrait 4:5. Top-to-bottom: HEADER → ROW 1 → ROW 2 → ROW 3 → ROW 4, each band with a small dark label tab at its top-left. Even margins and consistent gutters.`);
  }
  const ANIME_ROW_TITLES = {
    'anime-row1': 'ROW 1 — "TURNAROUND"',
    'anime-row2': 'ROW 2 — "ACTION POSES"',
    'anime-row3': 'ROW 3 — "EXPRESSION SHEET"',
    'anime-row4': 'ROW 4 — "GAME SPRITES"',
  };

  let prompt, aspect, outName;
  if (VARIANT === 'sheet') {
    if (!c.output_prompt?.en) { console.error(`❌ ${c.name} には output_prompt がありません（モデルシート未対応）。`); process.exit(1); }
    prompt = c.output_prompt.en;
    aspect = '4:5';
    outName = 'sheet';
  } else if (VARIANT === 'anime-sheet') {
    prompt = buildAnimePrompt(c);
    aspect = '4:5';
    outName = 'anime/sheet';
  } else if (ANIME_ROW_TITLES[VARIANT]) {
    prompt =
      `From the anime model-sheet specification below, RENDER ONLY the section ${ANIME_ROW_TITLES[VARIANT]} ` +
      `as ONE standalone wide image. Fill the whole canvas with just that section's content at large size. ` +
      `Ignore the other rows, the header and the 4:5 sheet layout. Keep the TEXT RULES and the IDENTITY section exactly.\n\n` +
      buildAnimePrompt(c);
    aspect = '16:9';
    outName = `anime/rows/${VARIANT.replace('anime-', '')}`;
  } else if (ROW_TITLES[VARIANT]) {
    // 行単位の生成 — シート全体で崩れた行だけを高解像度で作り直す
    if (!c.output_prompt?.en) { console.error(`❌ ${c.name} には output_prompt がありません。`); process.exit(1); }
    prompt =
      `From the model-sheet specification below, RENDER ONLY the section ${ROW_TITLES[VARIANT]} ` +
      `as ONE standalone wide image. Fill the whole canvas with just that section's content at large size. ` +
      `Ignore the other rows, the header and the 4:5 sheet layout. Keep the TEXT RULES and the IDENTITY section exactly.\n\n` +
      c.output_prompt.en;
    aspect = '16:9';
    outName = `rows/${VARIANT}`;
  } else {
    if (!c.prompts?.[VARIANT]?.en) { console.error(`❌ ${c.name} に prompts.${VARIANT} がありません。`); process.exit(1); }
    prompt = c.prompts[VARIANT].en;
    aspect = '1:1';
    outName = `gen-${VARIANT}`;
  }

  // 参照画像（image-to-image で同一性を保つ）
  // 探索順: images/refs/（中央置き場）→ キャラフォルダ。アニメ系バリアントは _anime ref を使う
  const isAnime = VARIANT.startsWith('anime');
  const id = `${c.no}_${slug(c.name)}`;
  const refCandidates = isAnime
    ? [path.join(ROOT, 'images/refs/anime', `${id}.png`), path.join(ROOT, 'images/refs', `${id}_anime.png`), path.join(ROOT, dir, 'anime-ref.png')]
    : [path.join(ROOT, 'images/refs', `${id}.png`), path.join(ROOT, dir, 'ref.png')];
  let refPath = null;
  if (REF_MODE !== 'off') {
    for (const p of refCandidates) { if (await exists(p)) { refPath = p; break; } }
  }
  const useRef = !!refPath;
  if (REF_MODE === 'on' && !useRef) {
    console.error(`❌ REF_MODE=on ですが参照画像がありません。次のいずれかに置いてください:\n  ${refCandidates.map(p => path.relative(ROOT, p)).join('\n  ')}`);
    process.exit(1);
  }

  const base = MODEL_TIER === 'pro' ? 'fal-ai/nano-banana-pro' : 'fal-ai/nano-banana';
  const model = useRef ? `${base}/edit` : base;
  const resolution = env('RESOLUTION',
    (VARIANT === 'sheet' || VARIANT === 'anime-sheet' || ROW_TITLES[VARIANT] || ANIME_ROW_TITLES[VARIANT]) ? '2K' : '1K');
  const input = { prompt, num_images: NUM, output_format: 'png', aspect_ratio: aspect };
  if (MODEL_TIER === 'pro') input.resolution = resolution;

  if (env('DRY_RUN', '')) {
    console.log('🔎 DRY_RUN — 送信せずに内容を表示します');
    console.log(JSON.stringify({ character: `${c.name} (#${c.no})`, model, useRef, output: `${dir}/${outName}.png`, input: { ...input, prompt: prompt.slice(0, 120) + '…' } }, null, 2));
    return;
  }

  if (useRef) {
    console.log(`🖼  参照画像を fal storage にアップロード: ${path.relative(ROOT, refPath)}`);
    const buf = await readFile(refPath);
    const url = await fal.storage.upload(new Blob([buf], { type: 'image/png' }));
    input.image_urls = [url];
    // edit モードでは同一性維持を促す指示を先頭に追加
    input.prompt = `Using the attached reference image as the exact character design (keep the face, hairstyle, colors and equipment identical), ${prompt}`;
  }

  console.log(`🎨 生成開始  キャラ=${c.name}(#${c.no})  種別=${VARIANT}  モデル=${model}  枚数=${NUM}  比率=${aspect}${input.resolution ? `  解像度=${input.resolution}` : ''}`);
  const result = await fal.subscribe(model, {
    input,
    logs: true,
    onQueueUpdate: u => { if (u.status === 'IN_PROGRESS') (u.logs || []).forEach(l => l.message && console.log('  ', l.message)); },
  });

  const images = result.data?.images || [];
  if (!images.length) { console.error('❌ 画像が返りませんでした。', JSON.stringify(result.data)); process.exit(1); }

  const saved = [];
  for (let i = 0; i < images.length; i++) {
    const suffix = i === 0 ? '' : `-${i + 1}`;
    const out = path.join(ROOT, dir, `${outName}${suffix}.png`);
    await mkdir(path.dirname(out), { recursive: true });
    const res = await fetch(images[i].url);
    if (!res.ok) { console.error(`❌ ダウンロード失敗: ${images[i].url}`); process.exit(1); }
    await writeFile(out, Buffer.from(await res.arrayBuffer()));
    saved.push(path.relative(ROOT, out));
    console.log(`✅ 保存: ${path.relative(ROOT, out)}`);
  }

  // 後続ステップ用に出力パスを GITHUB_OUTPUT へ
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `saved=${saved.join(',')}\nchar=${c.no}_${slug(c.name)}\n`, { flag: 'a' });
  }
  console.log(`🎉 完了（${saved.length}枚）`);
}

main().catch(e => { console.error('❌ エラー:', e?.message || e); process.exit(1); });
