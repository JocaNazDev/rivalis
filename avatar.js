/* ============================================================
   Rivalis · avatar.js
   Gerador de rostos em SVG. Independente do jogo: não depende de
   nada e não mexe em nada. Uso:

     const cfg = Avatar.random();
     el.innerHTML = Avatar.svg(cfg, {size:160});
     const codigo = Avatar.code(cfg);        // "2-3-5-1-0-2-4-1-0"
     const cfg2   = Avatar.parse(codigo);    // volta o objeto

   Campos de cfg: face, skin, hair, hairColor, eyes, eyeColor,
   brows, mouth, scar (todos índices numéricos).
   ============================================================ */
(function (root) {
'use strict';

/* ---------- Paletas ---------- */
const SKIN = [
  {id:'pele1', name:'Clara',        c:'#f6d5bd', s:'#e0b193'},
  {id:'pele2', name:'Rosada',       c:'#f0c3a8', s:'#d79d80'},
  {id:'pele3', name:'Bege',         c:'#e3b184', s:'#c58f63'},
  {id:'pele4', name:'Dourada',      c:'#d29a63', s:'#b17b47'},
  {id:'pele5', name:'Morena',       c:'#b87745', s:'#965c31'},
  {id:'pele6', name:'Castanha',     c:'#8f552f', s:'#6f3f21'},
  {id:'pele7', name:'Escura',       c:'#6b3d22', s:'#512c17'},
  {id:'pele8', name:'Muito escura', c:'#4a2817', s:'#361b0f'},
];
const HAIRC = [
  {id:'preto',    name:'Preto',    c:'#171a20'},
  {id:'castanho', name:'Castanho', c:'#4a2c17'},
  {id:'claro',    name:'Cast. claro', c:'#7b4a24'},
  {id:'loiro',    name:'Loiro',    c:'#d8a441'},
  {id:'ruivo',    name:'Ruivo',    c:'#9e3b18'},
  {id:'grisalho', name:'Grisalho', c:'#9aa1b5'},
  {id:'branco',   name:'Branco',   c:'#e7e9f0'},
  {id:'azul',     name:'Azul',     c:'#2f6fd0'},
  {id:'roxo',     name:'Roxo',     c:'#7c3aed'},
  {id:'verde',    name:'Verde',    c:'#1f9d61'},
];
const EYEC = [
  {id:'castanho', name:'Castanho', c:'#4a2c17'},
  {id:'mel',      name:'Mel',      c:'#a4712a'},
  {id:'preto',    name:'Preto',    c:'#1b1f27'},
  {id:'verde',    name:'Verde',    c:'#2f7d4f'},
  {id:'azul',     name:'Azul',     c:'#2f6fd0'},
  {id:'cinza',    name:'Cinza',    c:'#7b8496'},
];

/* ---------- Peças ---------- */
// Rosto: cada forma é um caminho fechado (viewBox 0 0 100 100)
const FACE = [
  {id:'oval',     name:'Oval',     ex:25, d:'M50 16C67 16 76 32 76 52C76 72 64 87 50 87C36 87 24 72 24 52C24 32 33 16 50 16Z'},
  {id:'redondo',  name:'Redondo',  ex:20, d:'M50 15C70 15 82 31 82 52C82 73 68 88 50 88C32 88 18 73 18 52C18 31 30 15 50 15Z'},
  {id:'quadrado', name:'Quadrado', ex:25, d:'M26 31C26 19 35 14 50 14C65 14 74 19 74 31L75 66C75 81 68 88 50 88C32 88 25 81 25 66Z'},
  {id:'coracao',  name:'Coração',  ex:22, d:'M50 14C73 14 82 29 81 45C80 59 61 91 50 91C39 91 20 59 19 45C18 29 27 14 50 14Z'},
  {id:'longo',    name:'Alongado', ex:29, d:'M50 13C64 13 71 29 71 50C71 74 61 90 50 90C39 90 29 74 29 50C29 29 36 13 50 13Z'},
  {id:'anguloso', name:'Anguloso', ex:24, d:'M50 14C68 14 78 25 78 42L74 64C72 78 63 87 50 87C37 87 28 78 26 64L22 42C22 25 32 14 50 14Z'},
];

// Cabelo: função que recebe a cor e devolve os elementos SVG.
// A base (touca) cobre o alto da cabeça e a testa; cada estilo varia a partir dela.
const CAP = c => `<path d="M50 7C74 7 85 23 85 46C85 49 84 51 83 52C81 43 79 35 75 32C67 39 57 42 50 42C43 42 33 39 25 32C21 35 19 43 17 52C16 51 15 49 15 46C15 23 26 7 50 7Z" fill="${c}"/>`;

const HAIR = [
  {id:'careca', name:'Careca', draw: () => ''},
  {id:'curto', name:'Curto', draw: c => CAP(c)},
  {id:'franja', name:'Franja', draw: c =>
    `<path d="M50 7C74 7 85 23 85 46C85 49 84 51 83 52L82 34C74 40 62 42 50 42C38 42 26 40 18 34L17 52C16 51 15 49 15 46C15 23 26 7 50 7Z" fill="${c}"/>
     <path d="M18 33C26 39 38 42 50 42C62 42 74 39 82 33L82 24C74 17 62 13 50 13C38 13 26 17 18 24Z" fill="${c}"/>`},
  {id:'ondulado', name:'Ondulado', draw: c =>
    CAP(c) +
    `<path d="M16 44C11 54 12 68 18 76C14 64 16 54 19 47Z" fill="${c}"/>
     <path d="M84 44C89 54 88 68 82 76C86 64 84 54 81 47Z" fill="${c}"/>
     <path d="M24 30C28 36 32 38 36 37C33 41 27 40 23 35Z" fill="${c}"/>
     <path d="M76 30C72 36 68 38 64 37C67 41 73 40 77 35Z" fill="${c}"/>`},
  {id:'cacheado', name:'Cacheado', draw: c =>
    CAP(c) +
    [[22,30],[28,18],[38,10],[50,6],[62,10],[72,18],[78,30],[83,42],[17,42]]
      .map(([x,y])=>`<circle cx="${x}" cy="${y}" r="9.5" fill="${c}"/>`).join('')},
  {id:'espetado', name:'Espetado', draw: c =>
    CAP(c) +
    `<path d="M20 40L19 16L30 30L36 8L44 26L50 4L56 26L64 8L70 30L81 16L80 40C74 32 64 28 50 28C36 28 26 32 20 40Z" fill="${c}"/>`},
  {id:'moicano', name:'Moicano', draw: c =>
    `<path d="M50 9C66 9 78 20 81 36C78 33 72 31 65 30C63 22 58 14 50 10C42 14 37 22 35 30C28 31 22 33 19 36C22 20 34 9 50 9Z" fill="${c}" opacity=".35"/>
     <path d="M40 34C39 21 43 9 50 3C57 9 61 21 60 34C56 31 44 31 40 34Z" fill="${c}"/>`},
  {id:'coque', name:'Coque', draw: c =>
    `<circle cx="50" cy="8" r="11" fill="${c}"/>` + CAP(c)},
  {id:'rabo', name:'Rabo de cavalo', draw: c =>
    CAP(c) +
    `<path d="M74 34C86 39 90 54 85 67C83 73 79 77 74 79C81 68 83 54 71 44Z" fill="${c}"/>
     <circle cx="77" cy="38" r="5.5" fill="${c}"/>`},
  {id:'longo', name:'Longo', draw: c =>
    `<rect x="14" y="38" width="12" height="52" rx="6" fill="${c}"/>
     <rect x="74" y="38" width="12" height="52" rx="6" fill="${c}"/>` + CAP(c)},
  {id:'trancas', name:'Tranças', draw: c =>
    CAP(c) +
    `<rect x="18" y="44" width="9" height="44" rx="4.5" fill="${c}"/>
     <rect x="73" y="44" width="9" height="44" rx="4.5" fill="${c}"/>
     ${[54,63,72,81].map(y=>`<path d="M18 ${y}H27M73 ${y}H82" stroke="#0004" stroke-width="1.8"/>`).join('')}`},
  {id:'raspado', name:'Raspado', draw: c =>
    `<path d="M50 9C72 9 83 24 83 45C83 47 82 49 81 51C79 43 77 35 73 32C66 38 57 40 50 40C43 40 34 38 27 32C23 35 21 43 19 51C18 49 17 47 17 45C17 24 28 9 50 9Z" fill="${c}" opacity=".45"/>`},
];

// Olhos (desenhados espelhados nos dois lados). dir = 1 esquerda, -1 direita
const LASH = '#00000055';
const EYES = [
  {id:'normal', name:'Normais', draw:(x,ec) =>
    `<ellipse cx="${x}" cy="50" rx="5.6" ry="4.1" fill="#fff"/>
     <circle cx="${x}" cy="50" r="2.8" fill="${ec}"/><circle cx="${x}" cy="50" r="1.2" fill="#12141a"/>
     <circle cx="${x+1.1}" cy="48.7" r=".8" fill="#fff"/>
     <path d="M${x-5.8} 47.2C${x-3} 44.2 ${x+3} 44.2 ${x+5.8} 47.2" stroke="${LASH}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`},
  {id:'grandes', name:'Grandes', draw:(x,ec) =>
    `<ellipse cx="${x}" cy="50" rx="6.8" ry="5.6" fill="#fff"/>
     <circle cx="${x}" cy="50" r="3.6" fill="${ec}"/><circle cx="${x}" cy="50" r="1.7" fill="#12141a"/>
     <circle cx="${x+1.5}" cy="48.3" r="1.1" fill="#fff"/>
     <path d="M${x-7} 46.4C${x-4} 42.2 ${x+4} 42.2 ${x+7} 46.4" stroke="${LASH}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`},
  {id:'amendoados', name:'Amendoados', draw:(x,ec,dir) =>
    `<path d="M${x-6.4*dir} 52C${x-3*dir} 45.6 ${x+3*dir} 44.6 ${x+6.4*dir} 48.4C${x+3*dir} 53.8 ${x-3*dir} 54.6 ${x-6.4*dir} 52Z" fill="#fff"/>
     <circle cx="${x}" cy="49.8" r="2.7" fill="${ec}"/><circle cx="${x}" cy="49.8" r="1.2" fill="#12141a"/>
     <path d="M${x-6.6*dir} 51.4C${x-3*dir} 44.8 ${x+3*dir} 43.8 ${x+6.8*dir} 47.8" stroke="${LASH}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`},
  {id:'semicerrados', name:'Semicerrados', draw:(x,ec) =>
    `<path d="M${x-6} 50.2C${x-3} 47 ${x+3} 47 ${x+6} 50.2C${x+3} 53 ${x-3} 53 ${x-6} 50.2Z" fill="#fff"/>
     <circle cx="${x}" cy="50.2" r="2.5" fill="${ec}"/><circle cx="${x}" cy="50.2" r="1.1" fill="#12141a"/>
     <path d="M${x-6.4} 49.2C${x-3} 46.4 ${x+3} 46.4 ${x+6.4} 49.2" stroke="${LASH}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`},
  {id:'redondos', name:'Redondos', draw:(x,ec) =>
    `<circle cx="${x}" cy="50" r="5.2" fill="#fff"/>
     <circle cx="${x}" cy="50" r="3.1" fill="${ec}"/><circle cx="${x}" cy="50" r="1.4" fill="#12141a"/>
     <circle cx="${x+1.4}" cy="48.5" r="1" fill="#fff"/>
     <circle cx="${x}" cy="50" r="5.2" fill="none" stroke="${LASH}" stroke-width="1.1"/>`},
  {id:'cansados', name:'Cansados', draw:(x,ec) =>
    `<ellipse cx="${x}" cy="50.6" rx="5.6" ry="3.4" fill="#fff"/>
     <circle cx="${x}" cy="50.6" r="2.6" fill="${ec}"/><circle cx="${x}" cy="50.6" r="1.1" fill="#12141a"/>
     <path d="M${x-6} 48.2C${x-3} 45.8 ${x+3} 45.8 ${x+6} 48.2" stroke="${LASH}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
     <path d="M${x-4.8} 55.4C${x-2} 57 ${x+2} 57 ${x+4.8} 55.4" stroke="#00000033" stroke-width="1.1" fill="none" stroke-linecap="round"/>`},
];

// Sobrancelhas (usam a cor do cabelo)
const BROWS = [
  {id:'retas', name:'Retas', draw:(x,c) =>
    `<path d="M${x-7} 40.6L${x+7} 40.2" stroke="${c}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`},
  {id:'arqueadas', name:'Arqueadas', draw:(x,c) =>
    `<path d="M${x-7} 41C${x-4} 36.6 ${x+4} 36.6 ${x+7} 40.4" stroke="${c}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`},
  {id:'grossas', name:'Grossas', draw:(x,c) =>
    `<path d="M${x-7.4} 40.8C${x-3} 37.4 ${x+3} 37.6 ${x+7.4} 40.2" stroke="${c}" stroke-width="4.2" stroke-linecap="round" fill="none"/>`},
  {id:'finas', name:'Finas', draw:(x,c) =>
    `<path d="M${x-6.6} 40.4C${x-3} 38 ${x+3} 38.2 ${x+6.6} 40" stroke="${c}" stroke-width="1.4" stroke-linecap="round" fill="none"/>`},
  {id:'franzidas', name:'Franzidas', draw:(x,c,dir) =>
    `<path d="M${x-6.8*dir} 37.8L${x+6.8*dir} 42" stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none"/>`},
  {id:'preocupadas', name:'Preocupadas', draw:(x,c,dir) =>
    `<path d="M${x-6.8*dir} 42.4L${x+6.8*dir} 38.4" stroke="${c}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`},
];

// Boca
const MOUTH = [
  {id:'neutra', name:'Neutra', draw:() =>
    `<path d="M42 69H58" stroke="#8c4a3c" stroke-width="2.2" stroke-linecap="round" fill="none"/>`},
  {id:'sorriso', name:'Sorriso', draw:() =>
    `<path d="M41 67C45 72 55 72 59 67" stroke="#8c4a3c" stroke-width="2.4" stroke-linecap="round" fill="none"/>`},
  {id:'largo', name:'Sorriso largo', draw:() =>
    `<path d="M39 66C44 76 56 76 61 66Z" fill="#7a3630"/>
     <path d="M40.6 67.4H59.4C58 69.4 42 69.4 40.6 67.4Z" fill="#fff"/>`},
  {id:'seria', name:'Séria', draw:() =>
    `<path d="M41 69.6C45 67.8 55 67.8 59 69.6" stroke="#8c4a3c" stroke-width="2.6" stroke-linecap="round" fill="none"/>`},
  {id:'torta', name:'Torta', draw:() =>
    `<path d="M41 70C46 70 54 66.5 59 66.5" stroke="#8c4a3c" stroke-width="2.4" stroke-linecap="round" fill="none"/>`},
  {id:'aberta', name:'Aberta', draw:() =>
    `<ellipse cx="50" cy="69.5" rx="6" ry="5" fill="#7a3630"/>
     <path d="M44.4 67.6H55.6C55 69 45 69 44.4 67.6Z" fill="#fff"/>`},
  {id:'bigode', name:'Com bigode', draw:(hc) =>
    `<path d="M41 69C45 73 55 73 59 69" stroke="#8c4a3c" stroke-width="2.2" stroke-linecap="round" fill="none"/>
     <path d="M50 63C46 61 40 62 38 65C42 66 46 65.4 50 64.6C54 65.4 58 66 62 65C60 62 54 61 50 63Z" fill="${hc}"/>`},
];

// Cicatrizes e marcas
const SCAR = [
  {id:'nenhuma', name:'Nenhuma', draw:()=>''},
  {id:'olho', name:'No olho', draw:() =>
    `<path d="M62.5 36L62.5 60" stroke="#a9604a" stroke-width="2" stroke-linecap="round"/>
     <path d="M59 42H66M59 54H66" stroke="#a9604a" stroke-width="1.5" stroke-linecap="round"/>`},
  {id:'bochecha', name:'Na bochecha', draw:() =>
    `<path d="M32 56L36 66" stroke="#a9604a" stroke-width="2" stroke-linecap="round"/>
     <path d="M31 60H37M33 64H39" stroke="#a9604a" stroke-width="1.4" stroke-linecap="round"/>`},
  {id:'testa', name:'Na testa', draw:() =>
    `<path d="M38 32C42 27 47 33 52 28" stroke="#a9604a" stroke-width="2" stroke-linecap="round" fill="none"/>`},
  {id:'labio', name:'No lábio', draw:() =>
    `<path d="M56 62L58 74" stroke="#a9604a" stroke-width="1.8" stroke-linecap="round"/>
     <path d="M54 66H60" stroke="#a9604a" stroke-width="1.3" stroke-linecap="round"/>`},
  {id:'dupla', name:'Dupla no rosto', draw:() =>
    `<path d="M34 50L30 62M66 50L70 62" stroke="#a9604a" stroke-width="1.9" stroke-linecap="round"/>`},
  {id:'tapaolho', name:'Tapa-olho', draw:() =>
    `<path d="M20 36L78 44" stroke="#15171d" stroke-width="2.6"/>
     <rect x="54" y="42" width="17" height="15" rx="4" fill="#15171d"/>`},
];

const PARTS = {
  face:      {name:'Rosto',        list:FACE},
  skin:      {name:'Pele',         list:SKIN,  color:true},
  hair:      {name:'Cabelo',       list:HAIR},
  hairColor: {name:'Cor do cabelo',list:HAIRC, color:true},
  eyes:      {name:'Olhos',        list:EYES},
  eyeColor:  {name:'Cor dos olhos',list:EYEC,  color:true},
  brows:     {name:'Sobrancelhas', list:BROWS},
  mouth:     {name:'Boca',         list:MOUTH},
  scar:      {name:'Cicatriz',     list:SCAR},
};
const KEYS = Object.keys(PARTS);

/* ---------- Utilidades ---------- */
const clamp = (i, len) => { i = Number(i); return (Number.isFinite(i) && i >= 0 && i < len) ? Math.floor(i) : 0; };
function normalize(cfg){
  const out = {};
  cfg = cfg || {};
  for(const k of KEYS) out[k] = clamp(cfg[k], PARTS[k].list.length);
  return out;
}
function random(rng){
  const r = rng || Math.random;
  const out = {};
  for(const k of KEYS) out[k] = Math.floor(r() * PARTS[k].list.length);
  return out;
}
// Mesmo texto gera sempre o mesmo rosto (útil para dar avatar automático a um jogador)
function fromString(str){
  let h = 2166136261;
  for(let i=0; i<String(str).length; i++){ h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619); }
  const rng = () => { h ^= h<<13; h ^= h>>>17; h ^= h<<5; return ((h>>>0) % 100000) / 100000; };
  return random(rng);
}
const code  = cfg => KEYS.map(k => normalize(cfg)[k]).join('-');
const parse = str => {
  const v = String(str||'').split('-');
  const out = {};
  KEYS.forEach((k,i) => out[k] = clamp(v[i], PARTS[k].list.length));
  return out;
};

/* ---------- Desenho ---------- */
function svg(cfg, opt){
  const o = normalize(cfg);
  opt = opt || {};
  const size = opt.size || 120;
  const skin = SKIN[o.skin], hairC = HAIRC[o.hairColor].c, eyeC = EYEC[o.eyeColor].c;
  const face = FACE[o.face], hair = HAIR[o.hair], eyes = EYES[o.eyes];
  const brows = BROWS[o.brows], mouth = MOUTH[o.mouth], scar = SCAR[o.scar];
  const uid = 'av' + Math.random().toString(36).slice(2, 8);

  const body = [
    opt.bg === false ? '' : `<circle cx="50" cy="50" r="50" fill="${opt.bg || '#e8edf7'}"/>`,
    // pescoço e ombros
    `<path d="M41 74H59V84C59 88 55 90 50 90C45 90 41 88 41 84Z" fill="${skin.s}"/>`,
    `<path d="M24 100C26 91 36 86 50 86C64 86 74 91 76 100Z" fill="${opt.shirt || '#39405a'}"/>`,
    // orelhas
    `<ellipse cx="${face.ex}" cy="55" rx="4.4" ry="6.2" fill="${skin.c}"/><ellipse cx="${100-face.ex}" cy="55" rx="4.4" ry="6.2" fill="${skin.c}"/>`,
    `<ellipse cx="${face.ex}" cy="55" rx="2" ry="3" fill="${skin.s}" opacity=".7"/><ellipse cx="${100-face.ex}" cy="55" rx="2" ry="3" fill="${skin.s}" opacity=".7"/>`,
    // rosto
    `<path d="${face.d}" fill="${skin.c}"/>`,
    // sombra lateral, para o rosto não ficar chapado
    `<path d="${face.d}" fill="none" stroke="#00000018" stroke-width="1.6"/>`,
    // nariz
    `<path d="M50 52C48.4 57 47 59.6 46.6 61.2C46.2 62.8 48 63.4 50 63.4C52 63.4 53.8 62.8 53.4 61.2C53 59.6 51.6 57 50 52Z" fill="${skin.s}" opacity=".75"/>`,
    // olhos (esquerdo e direito espelhados)
    eyes.draw(37.5, eyeC, 1),
    eyes.draw(62.5, eyeC, -1),
    // sobrancelhas
    brows.draw(37.5, hairC, 1),
    brows.draw(62.5, hairC, -1),
    // boca
    mouth.draw(hairC),
    // cabelo por cima
    hair.draw(hairC),
    // cicatriz sempre no topo
    scar.draw(),
  ].join('');

  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="Avatar do personagem" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="${uid}"><circle cx="50" cy="50" r="50"/></clipPath></defs>
  <g clip-path="url(#${uid})">${body}</g></svg>`;
}

root.Avatar = { PARTS, KEYS, SKIN, HAIRC, EYEC, FACE, HAIR, EYES, BROWS, MOUTH, SCAR,
                svg, random, fromString, normalize, code, parse };

})(typeof window !== 'undefined' ? window : globalThis);
