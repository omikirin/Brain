/* CryptoNinja 図鑑データAPI
 * ゲーム等から利用する場合:
 *   import { loadCharacters, getCharacter, imageDir } from './js/cn-data.js'
 *   const all = await loadCharacters();
 *   const jin = await getCharacter('001');        // 番号
 *   const rei = await getCharacter('Rei');        // 名前でも可
 */
const BASE = new URL('..', import.meta.url); // リポジトリルート

export const CLAN_JP = { Iga: '伊賀', Koka: '甲賀', Fuma: '風魔', Saika: '雑賀', 'Heavenly Realm': '天界' };
export const CLAN_COLOR = { Iga: '#4a7bd0', Koka: '#4caf78', Fuma: '#b04ad0', Saika: '#d0a040', 'Heavenly Realm': '#e0e0e8' };
export const VARIANTS = { chibi: 'ちび（2頭身）', normal: '通常頭身', modern: '現代パロ', scifi: 'SF', fantasy: 'ファンタジー', isekai: '異世界' };

export const slug = name =>
  name.toLowerCase().split('(')[0].trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const imageDir = c => new URL(`images/characters/${c.no}_${slug(c.name)}/`, BASE).href;
export const refImage = c => new URL(`images/refs/${c.no}_${slug(c.name)}.png`, BASE).href;

let _cache = null;
export async function loadCharacters() {
  if (!_cache) {
    const res = await fetch(new URL('data/characters.json', BASE));
    if (!res.ok) throw new Error(`characters.json の取得に失敗: ${res.status}`);
    _cache = await res.json();
  }
  return _cache;
}

export async function getCharacter(key) {
  const d = await loadCharacters();
  const k = String(key).toLowerCase();
  return d.characters.find(c =>
    c.no === key || String(Number(key)).padStart(3, '0') === c.no ||
    c.name.toLowerCase() === k || slug(c.name) === k) || null;
}

export async function listCharacters(filter = {}) {
  const d = await loadCharacters();
  return d.characters.filter(c =>
    (!filter.clan || c.clan === filter.clan) &&
    (!filter.ninjutsu || c.ninjutsu === filter.ninjutsu) &&
    (!filter.genre || c.genre === filter.genre));
}
