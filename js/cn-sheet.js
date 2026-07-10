/* <cn-sheet> Web Component — キャラシートをどのページにも埋め込める部品
 * 使い方:
 *   <script type="module" src="js/cn-sheet.js"></script>
 *   <cn-sheet no="001"></cn-sheet>
 *   <cn-sheet no="019" compact></cn-sheet>   … 相関・プロンプトを省いた小型版
 */
import { getCharacter, imageDir, refImage, CLAN_JP, CLAN_COLOR, VARIANTS } from './cn-data.js';

const CSS = `
  :host{display:block; font-family:"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;
    --bg:#1c1c28; --bg2:#242436; --line:#33334a; --text:#e8e8f0; --sub:#9a9ab0; --accent:#e0483e;}
  .sheet{background:var(--bg); color:var(--text); border:1px solid var(--line); border-radius:14px;
    padding:16px; line-height:1.6; container-type:inline-size;}
  .head{display:flex; gap:14px; align-items:center;}
  .face{width:88px; height:88px; border-radius:12px; background:var(--bg2); flex:0 0 auto;
    display:flex; align-items:center; justify-content:center; font-size:2.2rem; font-weight:700;
    color:var(--sub); overflow:hidden;}
  .face img{width:100%; height:100%; object-fit:cover;}
  h2{margin:0; font-size:1.2rem;}
  h2 small{color:var(--sub); font-size:.7em; margin-left:8px; font-weight:400;}
  .badges{display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;}
  .badge{font-size:.7rem; padding:1px 9px; border-radius:10px; border:1px solid var(--line); color:var(--sub);}
  .badge.clan{color:#111; font-weight:700; border:none;}
  .meta{display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:6px; margin:12px 0; font-size:.82rem;}
  .meta div{background:var(--bg2); border-radius:8px; padding:6px 10px;}
  .meta b{display:block; color:var(--sub); font-size:.68rem; font-weight:400;}
  .setting{background:var(--bg2); border-left:3px solid var(--accent); padding:8px 12px;
    border-radius:0 8px 8px 0; font-size:.85rem;}
  h3{font-size:.85rem; color:var(--accent); margin:14px 0 6px;}
  .rel{display:flex; flex-wrap:wrap; gap:6px; font-size:.78rem;}
  .rel span{background:var(--bg2); border:1px solid var(--line); border-radius:8px; padding:5px 10px;}
  .rel b{color:var(--accent);}
  .err{color:var(--accent); padding:12px; font-size:.85rem;}
`;

class CnSheet extends HTMLElement {
  static observedAttributes = ['no', 'compact'];
  connectedCallback() { this.render(); }
  attributeChangedCallback() { if (this.isConnected) this.render(); }

  async render() {
    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style><div class="sheet">読み込み中…</div>`;
    const box = root.querySelector('.sheet');
    let c;
    try { c = await getCharacter(this.getAttribute('no') || ''); }
    catch (e) { box.innerHTML = `<div class="err">${e.message}</div>`; return; }
    if (!c) { box.innerHTML = `<div class="err">キャラが見つかりません: ${this.getAttribute('no')}</div>`; return; }
    const compact = this.hasAttribute('compact');
    const esc = s => String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
    box.innerHTML = `
      <div class="head">
        <div class="face"><span>${esc(c.name[0])}</span></div>
        <div>
          <h2>${esc(c.name)}<small>#${c.no}</small></h2>
          <div class="badges">
            <span class="badge clan" style="background:${CLAN_COLOR[c.clan] || '#888'}">${CLAN_JP[c.clan] || esc(c.clan)}</span>
            <span class="badge">${esc(c.ninjutsu)}</span>
            <span class="badge">${esc(c.weapon)}</span>
          </div>
        </div>
      </div>
      <div class="meta">
        <div><b>誕生日</b>${esc(c.birthday)}</div>
        <div><b>得意ジャンル</b>${esc(c.genre)}</div>
      </div>
      <div class="setting">${esc(c.setting)}</div>
      ${!compact && c.relationships?.length ? `<h3>相関</h3><div class="rel">${
        c.relationships.map(r => `<span><b>${esc(r.type)}</b> ${esc(r.name)}</span>`).join('')}</div>` : ''}`;
    const candidates = [imageDir(c) + 'main.png', refImage(c)];
    (function tryFace(i) {
      if (i >= candidates.length) return;
      const img = new Image();
      img.src = candidates[i];
      img.alt = c.name;
      img.onload = () => { const f = box.querySelector('.face'); f.textContent = ''; f.appendChild(img); };
      img.onerror = () => tryFace(i + 1);
    })(0);
  }
}
customElements.define('cn-sheet', CnSheet);
