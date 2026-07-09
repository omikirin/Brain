/* CryptoNinja キャラシート生成スクリプト（fal.ai / Nano Banana）
 *
 * GitHub Actions（.github/workflows/generate-sheet.yml）から呼ばれる想定。
 * 環境変数:
 *   FAL_KEY   … fal.ai の APIキー（必須／リポジトリ Secrets に登録）
 *   CHAR      … キャラ番号か名前（例 "032" / "Seori"）。既定 "032"
 *   VARIANT   … "sheet"(モデルシート全体) か prompts のキー
 *               (chibi/normal/modern/scifi/fantasy/isekai)。既定 "sheet"
 *   REF_MODE  … "auto"(参照画像があれば使う)/"on"/"off"。既定 "auto"
 *   NUM       … 生成枚数(1-4)。既定 1
 *
 * 出力:
 *   VARIANT=sheet  → images/characters/<no>_<slug>/sheet.png
 *   それ以外        → images/characters/<no>_<slug>/gen-<variant>.png
 *   複数枚時は末尾に -2, -3 … を付与
 */
import { fal } from '@fal-ai/client';
import { readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = (k, d) => process.env[k] && process.env[k].trim() ? process.env[k].trim() : d;

const CHAR = env('CHAR', '032');
const VARIANT = env('VARIANT', 'sheet');
const REF_MODE = env('REF_MODE', 'auto');
const NUM = Math.min(4, Math.max(1, parseInt(env('NUM', '1'), 10) || 1));

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
  let prompt, aspect, outName;
  if (VARIANT === 'sheet') {
    if (!c.output_prompt?.en) { console.error(`❌ ${c.name} には output_prompt がありません（モデルシート未対応）。`); process.exit(1); }
    prompt = c.output_prompt.en;
    aspect = '4:5';
    outName = 'sheet';
  } else {
    if (!c.prompts?.[VARIANT]?.en) { console.error(`❌ ${c.name} に prompts.${VARIANT} がありません。`); process.exit(1); }
    prompt = c.prompts[VARIANT].en;
    aspect = '1:1';
    outName = `gen-${VARIANT}`;
  }

  // 参照画像（image-to-image で同一性を保つ）
  const refPath = path.join(ROOT, dir, 'ref.png');
  let useRef = false;
  if (REF_MODE !== 'off' && await exists(refPath)) useRef = true;
  if (REF_MODE === 'on' && !useRef) { console.error(`❌ REF_MODE=on ですが参照画像がありません: ${dir}/ref.png`); process.exit(1); }

  const model = useRef ? 'fal-ai/nano-banana/edit' : 'fal-ai/nano-banana';
  const input = { prompt, num_images: NUM, output_format: 'png', aspect_ratio: aspect };

  if (env('DRY_RUN', '')) {
    console.log('🔎 DRY_RUN — 送信せずに内容を表示します');
    console.log(JSON.stringify({ character: `${c.name} (#${c.no})`, model, useRef, output: `${dir}/${outName}.png`, input: { ...input, prompt: prompt.slice(0, 120) + '…' } }, null, 2));
    return;
  }

  if (useRef) {
    console.log(`🖼  参照画像を fal storage にアップロード: ${dir}/ref.png`);
    const buf = await readFile(refPath);
    const url = await fal.storage.upload(new Blob([buf], { type: 'image/png' }));
    input.image_urls = [url];
    // edit モードでは同一性維持を促す指示を先頭に追加
    input.prompt = `Using the attached reference image as the exact character design (keep the face, hairstyle, colors and equipment identical), ${prompt}`;
  }

  console.log(`🎨 生成開始  キャラ=${c.name}(#${c.no})  種別=${VARIANT}  モデル=${model}  枚数=${NUM}  比率=${aspect}`);
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
