/* Brain購入者向けページのビルダー（本文＋配布ファイルの暗号化）
 *
 * 1) 本文: members-src.html（非公開・.gitignore対象）を暗号化して members.html に埋め込む
 *    （無ければ members-src.example.html を使用）
 * 2) 配布物: members-files/ （非公開・.gitignore対象）に置いたファイルを
 *    それぞれ暗号化して members-data/<名前>.enc に出力し、
 *    購入者ページの「ダウンロード」欄からパスワードで復号DLできるようにする
 *
 * 暗号: PBKDF2-SHA256(31万回) → AES-256-GCM。
 * リポジトリ・公開サイトに載るのは暗号文のみで、パスワードなしでは復元不可。
 *
 * 使い方:
 *   PASSWORD='好きなパスワード' node scripts/build-members.mjs
 */
import { webcrypto as crypto } from 'node:crypto';
import { readFile, writeFile, access, readdir, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PASSWORD = process.env.PASSWORD;
if (!PASSWORD) {
  console.error("❌ PASSWORD を環境変数で指定してください: PASSWORD='xxx' node scripts/build-members.mjs");
  process.exit(1);
}

const exists = async p => { try { await access(p); return true; } catch { return false; } };
const enc = new TextEncoder();
const b64 = u8 => Buffer.from(u8).toString('base64');
const ITER = 310000;
const salt = crypto.getRandomValues(new Uint8Array(16));

const baseKey = await crypto.subtle.importKey('raw', enc.encode(PASSWORD), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
  baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);

async function encrypt(bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return { iv, cipher };
}

/* --- 本文 --- */
const srcPath = (await exists(path.join(ROOT, 'members-src.html')))
  ? path.join(ROOT, 'members-src.html')
  : path.join(ROOT, 'members-src.example.html');
const plaintext = await readFile(srcPath, 'utf8');
const body = await encrypt(enc.encode(plaintext));
console.log(`📄 本文: ${path.relative(ROOT, srcPath)} (${plaintext.length}文字)`);

/* --- 配布ファイル --- */
const filesDir = path.join(ROOT, 'members-files');
const outDir = path.join(ROOT, 'members-data');
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
const manifest = [];
if (await exists(filesDir)) {
  for (const name of (await readdir(filesDir)).sort()) {
    const fp = path.join(filesDir, name);
    if (!(await stat(fp)).isFile()) continue;
    const data = await readFile(fp);
    const { iv, cipher } = await encrypt(new Uint8Array(data));
    const encName = name + '.enc';
    await writeFile(path.join(outDir, encName), Buffer.from(cipher));
    manifest.push({ name, size: data.length, iv: b64(iv), path: `members-data/${encName}` });
    console.log(`📦 配布物: ${name} (${(data.length/1024).toFixed(1)}KB) → ${encName}`);
  }
}
if (!manifest.length) console.log('ℹ️ members-files/ に配布ファイルがありません（DL欄は空になります）');
await writeFile(path.join(outDir, '.gitkeep'), '');

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>購入者専用ページ — CryptoNinja 同人お助けサイト</title>
<style>
  :root{--bg:#12121a; --panel:#1c1c28; --panel2:#242436; --line:#33334a; --text:#e8e8f0; --sub:#9a9ab0; --accent:#e0483e}
  *{box-sizing:border-box; margin:0; padding:0}
  body{background:var(--bg); color:var(--text); font-family:"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif; line-height:1.7}
  .gate{max-width:420px; margin:14vh auto 0; padding:32px 28px; background:var(--panel); border:1px solid var(--line); border-radius:16px; text-align:center}
  .gate h1{font-size:1.2rem; margin-bottom:6px}
  .gate h1 span{color:var(--accent)}
  .gate p{color:var(--sub); font-size:.85rem; margin-bottom:18px}
  .gate input{width:100%; background:var(--panel2); color:var(--text); border:1px solid var(--line); border-radius:10px; padding:12px 14px; font-size:1rem; text-align:center; letter-spacing:.1em}
  .gate button{width:100%; margin-top:12px; background:var(--accent); color:#fff; border:none; border-radius:10px; padding:12px; font-size:1rem; font-weight:700; cursor:pointer}
  .gate button:disabled{opacity:.5}
  .gate .err{color:var(--accent); font-size:.85rem; margin-top:10px; min-height:1.2em}
  .gate .back{display:inline-block; margin-top:16px; color:var(--sub); font-size:.8rem}
  #content{display:none; max-width:860px; margin:0 auto; padding:24px 16px 20px}
  #downloads{display:none; max-width:860px; margin:0 auto; padding:0 16px 80px}
  #downloads h2{font-size:1.05rem; color:var(--accent); margin:18px 0 10px; border-bottom:1px solid var(--line); padding-bottom:6px}
  .dl{display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:12px 16px; margin:8px 0}
  .dl .nm{font-size:.92rem; font-weight:700; word-break:break-all}
  .dl .sz{color:var(--sub); font-size:.78rem}
  .dl button{margin-left:auto; background:var(--accent); color:#fff; border:none; border-radius:8px; padding:8px 16px; font-size:.85rem; font-weight:700; cursor:pointer; white-space:nowrap}
  .dl button:disabled{opacity:.5}
</style>
</head>
<body>
<div class="gate" id="gate">
  <h1>Brain<span>購入者</span>専用ページ</h1>
  <p>Brainに記載のパスワードを入力してください。<br>本文・配布ファイルは暗号化されており、パスワードなしでは復元できません。</p>
  <input id="pw" type="password" placeholder="パスワード" autocomplete="off">
  <button id="unlock">開く</button>
  <div class="err" id="err"></div>
  <a class="back" href="index.html">← 図鑑へ戻る</a>
</div>
<div id="content"></div>
<div id="downloads"></div>

<script>
const DATA = {
  salt: "${b64(salt)}",
  iter: ${ITER},
  body: { iv: "${b64(body.iv)}", cipher: "${b64(body.cipher)}" },
  files: ${JSON.stringify(manifest)}
};
const b2u = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
let KEY = null;

async function deriveKey(pw) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b2u(DATA.salt), iterations: DATA.iter, hash: 'SHA-256' },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

async function unlock(pw, silent) {
  const btn = document.getElementById('unlock');
  btn.disabled = true; btn.textContent = '復号中…';
  try {
    const key = await deriveKey(pw);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b2u(DATA.body.iv) }, key, b2u(DATA.body.cipher));
    KEY = key;
    sessionStorage.setItem('members_pw', pw);
    document.getElementById('gate').style.display = 'none';
    const c = document.getElementById('content');
    c.innerHTML = new TextDecoder().decode(plain);
    c.style.display = 'block';
    renderDownloads();
  } catch (e) {
    if (!silent) document.getElementById('err').textContent = 'パスワードが違います';
    sessionStorage.removeItem('members_pw');
  } finally {
    btn.disabled = false; btn.textContent = '開く';
  }
}

function fmtSize(n){ return n > 1048576 ? (n/1048576).toFixed(1)+' MB' : (n/1024).toFixed(1)+' KB'; }

function renderDownloads() {
  if (!DATA.files.length) return;
  const box = document.getElementById('downloads');
  box.innerHTML = '<h2>📥 ダウンロード（購入者限定）</h2>' + DATA.files.map((f, i) =>
    \`<div class="dl"><div><div class="nm">\${f.name}</div><div class="sz">\${fmtSize(f.size)}</div></div>
      <button data-i="\${i}">ダウンロード</button></div>\`).join('');
  box.style.display = 'block';
  box.querySelectorAll('button').forEach(b => b.onclick = () => download(+b.dataset.i, b));
}

async function download(i, btn) {
  const f = DATA.files[i];
  btn.disabled = true; btn.textContent = '復号中…';
  try {
    const res = await fetch(f.path);
    if (!res.ok) throw new Error('fetch failed');
    const cipher = new Uint8Array(await res.arrayBuffer());
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b2u(f.iv) }, KEY, cipher);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([plain]));
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(a.href);
    btn.textContent = '✓ 保存しました';
    setTimeout(() => { btn.textContent = 'ダウンロード'; btn.disabled = false; }, 1800);
  } catch (e) {
    btn.textContent = '失敗（再試行）'; btn.disabled = false;
  }
}

document.getElementById('unlock').onclick = () => unlock(document.getElementById('pw').value, false);
document.getElementById('pw').addEventListener('keydown', e => { if (e.key === 'Enter') unlock(e.target.value, false); });
const saved = sessionStorage.getItem('members_pw');
if (saved) unlock(saved, true);
</script>
</body>
</html>
`;

await writeFile(path.join(ROOT, 'members.html'), html);
console.log(`✅ members.html を生成（本文 + 配布物${manifest.length}件 / AES-256-GCM, PBKDF2 ${ITER}回）`);
