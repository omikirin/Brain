/* Brain購入者向けページのビルダー
 *
 * members-src.html（非公開・.gitignore対象）の本文を
 * パスワード由来の鍵(PBKDF2-SHA256 → AES-256-GCM)で暗号化し、
 * 復号UI付きの members.html を生成する。
 * 暗号文だけが公開リポジトリに載るため、パスワードなしでは中身を読めない。
 *
 * 使い方:
 *   PASSWORD='好きなパスワード' node scripts/build-members.mjs
 *   （members-src.html が無ければ members-src.example.html を使う）
 */
import { webcrypto as crypto } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PASSWORD = process.env.PASSWORD;
if (!PASSWORD) {
  console.error("❌ PASSWORD を環境変数で指定してください: PASSWORD='xxx' node scripts/build-members.mjs");
  process.exit(1);
}

const exists = async p => { try { await access(p); return true; } catch { return false; } };
const srcPath = (await exists(path.join(ROOT, 'members-src.html')))
  ? path.join(ROOT, 'members-src.html')
  : path.join(ROOT, 'members-src.example.html');
const plaintext = await readFile(srcPath, 'utf8');
console.log(`📄 本文: ${path.relative(ROOT, srcPath)} (${plaintext.length}文字)`);

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const ITER = 310000;

const baseKey = await crypto.subtle.importKey('raw', enc.encode(PASSWORD), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
  baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext)));

const b64 = u8 => Buffer.from(u8).toString('base64');

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
  #content{display:none; max-width:860px; margin:0 auto; padding:24px 16px 80px}
</style>
</head>
<body>
<div class="gate" id="gate">
  <h1>Brain<span>購入者</span>専用ページ</h1>
  <p>Brainに記載のパスワードを入力してください。<br>本文は暗号化されており、パスワードなしでは復元できません。</p>
  <input id="pw" type="password" placeholder="パスワード" autocomplete="off">
  <button id="unlock">開く</button>
  <div class="err" id="err"></div>
  <a class="back" href="index.html">← 図鑑へ戻る</a>
</div>
<div id="content"></div>

<script>
const DATA = {
  salt: "${b64(salt)}",
  iv: "${b64(iv)}",
  cipher: "${b64(cipher)}",
  iter: ${ITER}
};
const b2u = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));

async function tryUnlock(pw) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b2u(DATA.salt), iterations: DATA.iter, hash: 'SHA-256' },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b2u(DATA.iv) }, key, b2u(DATA.cipher));
  return new TextDecoder().decode(plain);
}

async function unlock(pw, silent) {
  const btn = document.getElementById('unlock');
  btn.disabled = true; btn.textContent = '復号中…';
  try {
    const html = await tryUnlock(pw);
    sessionStorage.setItem('members_pw', pw);
    document.getElementById('gate').style.display = 'none';
    const c = document.getElementById('content');
    c.innerHTML = html;
    c.style.display = 'block';
  } catch (e) {
    if (!silent) document.getElementById('err').textContent = 'パスワードが違います';
    sessionStorage.removeItem('members_pw');
  } finally {
    btn.disabled = false; btn.textContent = '開く';
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
console.log('✅ members.html を生成しました（AES-256-GCM / PBKDF2 ' + ITER + '回）');
