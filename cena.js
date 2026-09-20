/* ============================================================
   Rivalis · cena.js
   Gerador de cenas vetoriais para as missões. Desenha em SVG, sem
   imagens, sem internet e sem IA: o texto do mestre é lido por
   palavras-chave e cai num dos cenários desenhados aqui.

     const cfg = Cena.fromText('entramos na gruta à noite, com tochas');
     el.innerHTML = Cena.svg(cfg, {w:640});
     Cena.code(cfg)   -> 'gruta.noite.limpo.tochas~a1b2'
     Cena.parse(code) -> volta o objeto

   cfg = { id, time, weather, props:[], seed }
   ============================================================ */
(function (root) {
'use strict';

const W = 320, H = 180;                       // proporção 16:9

/* ---------- sorteio com semente (mesma semente = mesmo desenho) ---------- */
function mkRng(seed){
  let h = 2166136261;
  for(let i=0;i<String(seed).length;i++){ h ^= String(seed).charCodeAt(i); h = Math.imul(h, 16777619); }
  return function(){ h ^= h<<13; h ^= h>>>17; h ^= h<<5; return ((h>>>0) % 1e6) / 1e6; };
}
const R = (rng,a,b) => a + rng()*(b-a);
const Ri = (rng,a,b) => Math.floor(R(rng,a,b+1));

/* ---------- hora do dia: céu e clima geral ---------- */
const TIME = {
  dia:      {name:'Dia',       sky:['#8fc7ee','#dcf0fd'], tint:'',            glow:'#fff3d0', ground:'#6b7b52'},
  tarde:    {name:'Entardecer',sky:['#e8763c','#f7c98a'], tint:'#ff7a2f22',   glow:'#ffd9a0', ground:'#5a4a3a'},
  noite:    {name:'Noite',     sky:['#16224a','#3a4e80'], tint:'#0b14402e',   glow:'#9fc2ff', ground:'#2b3548'},
  penumbra: {name:'Penumbra',  sky:['#243043','#3c4a63'], tint:'#0000001c',   glow:'#ffbe6b', ground:'#343642'},
};
const WEATHER = { limpo:'Limpo', chuva:'Chuva', neve:'Neve', nevoa:'Névoa' };
const PROPS = {
  fogueira:{name:'Fogueira'}, tochas:{name:'Tochas'}, figuras:{name:'Silhuetas'},
  barris:{name:'Barris'}, caixotes:{name:'Caixotes'}, alerta:{name:'Luz de alerta'},
};

/* ---------- desenho: ajudantes ---------- */
let UID = 0;
const uid = p => `${p}${(++UID).toString(36)}`;
const rect = (x,y,w,h,f,extra) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"${extra||''}/>`;
const path = (d,f,extra) => `<path d="${d}" fill="${f}"${extra||''}/>`;
const line = (x1,y1,x2,y2,c,w,extra) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"${extra||''}/>`;
const circ = (cx,cy,r,f,extra) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"${extra||''}/>`;
function grad(id, c1, c2, vertical){
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical?0:1}" y2="${vertical?1:0}">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
}
function radial(id, c1, c2){
  return `<radialGradient id="${id}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`;
}
// luz quente de fogo/tocha
const lightBall = (defs, cx, cy, r, color) => {
  const id = uid('lt'); defs.push(radial(id, color, color.slice(0,7) + '00'));
  return circ(cx, cy, r, `url(#${id})`, ' opacity=".75"');
};
function fire(x, y, s, defs){
  return lightBall(defs, x, y-2*s, 26*s, '#ff9a3c')
    + path(`M${x-4*s} ${y}L${x+4*s} ${y}L${x+3*s} ${y+2*s}L${x-3*s} ${y+2*s}Z`, '#4a3524')
    + line(x-5*s, y+1*s, x+5*s, y-1*s, '#5b4029', 2*s)
    + line(x-5*s, y-1*s, x+5*s, y+1*s, '#6b4a30', 2*s)
    + path(`M${x} ${y-9*s}C${x+4*s} ${y-5*s} ${x+3*s} ${y-1*s} ${x} ${y-1*s}C${x-3*s} ${y-1*s} ${x-4*s} ${y-5*s} ${x} ${y-9*s}Z`, '#ff7a1a')
    + path(`M${x} ${y-6*s}C${x+2*s} ${y-3*s} ${x+2*s} ${y-1*s} ${x} ${y-1*s}C${x-2*s} ${y-1*s} ${x-2*s} ${y-3*s} ${x} ${y-6*s}Z`, '#ffd24a');
}
function torch(x, y, defs, flip){
  const d = flip ? -1 : 1;
  return lightBall(defs, x, y-6, 30, '#ffab4a')
    + path(`M${x-1.6} ${y}L${x+1.6} ${y}L${x+1.2*d} ${y+14}L${x-1.2*d} ${y+14}Z`, '#4a3524')
    + path(`M${x} ${y-9}C${x+3.4} ${y-5} ${x+2.6} ${y-1} ${x} ${y-1}C${x-2.6} ${y-1} ${x-3.4} ${y-5} ${x} ${y-9}Z`, '#ff8a22')
    + path(`M${x} ${y-6}C${x+1.8} ${y-3.4} ${x+1.8} ${y-1.4} ${x} ${y-1.4}C${x-1.8} ${y-1.4} ${x-1.8} ${y-3.4} ${x} ${y-6}Z`, '#ffe07a');
}
// silhuetas de gente/criatura ao fundo
function figure(x, groundY, h, color, hunched){
  const w = h*0.34;
  const head = h*0.19;
  return path(`M${x-w/2} ${groundY}L${x-w/2.6} ${groundY-h*0.55}L${x-w/2} ${groundY-h*0.7}` +
    `Q${x} ${groundY-h*(hunched?0.78:0.84)} ${x+w/2} ${groundY-h*0.7}` +
    `L${x+w/2.6} ${groundY-h*0.55}L${x+w/2} ${groundY}Z`, color)
    + circ(x, groundY - h*(hunched?0.82:0.9), head/2, color);
}

/* ---------- cenários ---------- */
const SCENES = {

gruta: {
  name:'Gruta', emoji:'🕳️',
  words:['gruta','caverna','toca','mina','subterr','buraco','tunel','túnel','catacumba'],
  draw(o){
    const {defs, rng, T} = o, s = [];
    const skyId = uid('g'); defs.push(grad(skyId, T.sky[1], T.sky[0], true));
    s.push(rect(0,0,W,H,'#3b3340'));
    // paredes: três camadas, da mais clara ao fundo à mais escura na frente
    s.push(path(`M0 0H${W}V30C246 44 236 78 232 ${H}H88C84 78 74 44 0 30Z`, '#494052'));
    s.push(path(`M0 0H${W}V16C258 32 248 70 244 ${H}H76C72 70 62 32 0 16Z`, '#3a3242'));
    s.push(path(`M0 0H${W}V6C272 20 262 62 258 ${H}H62C58 62 48 20 0 6Z`, '#2c2634'));
    // saída da gruta ao fundo, com a luz de fora entrando
    s.push(path(`M128 158C126 104 140 72 160 72C180 72 194 104 192 158Z`, '#171520'));
    s.push(path(`M133 158C131 108 143 78 160 78C177 78 189 108 187 158Z`, `url(#${skyId})`));
    s.push(path(`M139 158C137 112 147 86 160 86C173 86 183 112 181 158Z`, T.glow, ' opacity=".2"'));
    if(o.T===TIME.noite) s.push(circ(154,100,3.5,'#eef2ff'));
    // luz derramada no chão, vinda da saída
    const flo = uid('fl'); defs.push(radial(flo, T.glow + '55', T.glow + '00'));
    s.push(`<ellipse cx="160" cy="160" rx="70" ry="22" fill="url(#${flo})" opacity=".55"/>`);
    // brilho de umidade nas bordas
    s.push(path(`M92 ${H}C94 92 108 66 126 58C114 72 104 96 104 ${H}Z`, '#6f6480', ' opacity=".22"'));
    s.push(path(`M228 ${H}C226 92 212 66 194 58C206 72 216 96 216 ${H}Z`, '#6f6480', ' opacity=".22"'));
    // estalactites
    let x = 2;
    while(x < W-4){
      const w = R(rng,10,22), h = R(rng,14,46);
      s.push(path(`M${x} 0L${x+w} 0L${x+w*0.62} ${h*0.55}L${x+w/2} ${h}L${x+w*0.38} ${h*0.55}Z`, '#564b60'));
      s.push(path(`M${x+w*0.42} 0L${x+w*0.6} 0L${x+w/2} ${h*0.85}Z`, '#6a5d78', ' opacity=".8"'));
      x += w + R(rng,3,14);
    }
    // chão de pedra irregular
    s.push(path(`M0 ${H}H${W}V148C240 138 200 148 160 144C120 140 80 150 0 146Z`, '#443b4c'));
    s.push(path(`M0 ${H}H${W}V158C240 150 200 158 160 155C120 152 80 160 0 157Z`, '#382f3e'));
    // pedregulhos arredondados espalhados
    for(let i=0;i<7;i++){
      const px = R(rng,10,W-10), py = R(rng,150,174), w = R(rng,10,26), h = w*R(rng,0.35,0.55);
      s.push(path(`M${px-w/2} ${py}C${px-w/2.2} ${py-h} ${px+w/2.2} ${py-h*1.1} ${px+w/2} ${py}Z`, '#4b4155'));
      s.push(path(`M${px-w/3} ${py}C${px-w/3.4} ${py-h*0.7} ${px} ${py-h*0.8} ${px+w/6} ${py-h*0.2}Z`, '#5a4f66', ' opacity=".7"'));
    }
    // duas estalagmites grandes, nos cantos
    for(const [px,h] of [[36,34],[286,26]]){
      s.push(path(`M${px-7} 158C${px-4} 148 ${px-3} ${158-h} ${px} ${158-h}C${px+3} ${158-h} ${px+4} 148 ${px+7} 158Z`, '#50465c'));
      s.push(path(`M${px-2.5} 158C${px-1} 148 ${px-1} ${158-h*0.9} ${px} ${158-h*0.9}C${px+1} ${158-h*0.9} ${px+1.6} 150 ${px+3} 158Z`, '#61566e'));
    }
    // poça d'água com reflexo
    s.push(`<ellipse cx="228" cy="168" rx="52" ry="7" fill="#33414f" opacity=".85"/>`);
    s.push(`<ellipse cx="228" cy="167" rx="34" ry="3.5" fill="${T.glow}" opacity=".16"/>`);
    if(o.has('figuras')){ s.push(figure(104,152,32,'#1d1826',true)); s.push(figure(128,154,27,'#1d1826',true)); }
    if(o.has('barris')) s.push(barrels(62,152));
    if(o.has('caixotes')) s.push(crates(252,152));
    if(o.has('fogueira')) s.push(fire(56,152,1.7,defs));
    if(o.has('tochas')){ s.push(torch(24,58,defs)); s.push(torch(296,58,defs,true)); }
    return s.join('');
  }
},

cela: {
  name:'Cela', emoji:'⛓️',
  words:['cela','prisao','prisão','masmorra','calabouço','calabouco','cadeia','xadrez','grades','cárcere','carcere'],
  draw(o){
    const {defs, rng, T} = o, s = [];
    const skyId = uid('g'); defs.push(grad(skyId, T.sky[0], T.sky[1], true));
    s.push(rect(0,0,W,H,'#2b2a2c'));
    // blocos de pedra
    for(let y=0; y<H; y+=18){
      for(let x=(y/18)%2?-14:0; x<W; x+=34){
        s.push(rect(x+1, y+1, 32, 16, y<120 ? '#3a3739' : '#343133'));
      }
    }
    // janelinha com grade
    s.push(rect(196,26,52,40,'#17161a'));
    s.push(rect(200,30,44,32,`url(#${skyId})`));
    if(o.T===TIME.noite) s.push(circ(232,40,5,'#e9eeff'));
    for(let i=0;i<4;i++) s.push(rect(203+i*11,30,3,32,'#1d1c20'));
    // raio de luz entrando
    const lid = uid('ly'); defs.push(grad(lid, T.glow+'66', T.glow+'00', true));
    s.push(path(`M200 62L244 62L286 ${H}L150 ${H}Z`, `url(#${lid})`, ' opacity=".5"'));
    // chão e palha
    s.push(rect(0,148,W,32,'#241f1c'));
    for(let i=0;i<34;i++){ const x=R(rng,4,W-4), y=R(rng,150,176); s.push(line(x,y,x+R(rng,5,12),y-R(rng,1,4),'#6b5a34',1.2,' opacity=".7"')); }
    // corrente na parede
    s.push(circ(58,70,3,'#5a5558'));
    for(let i=0;i<6;i++) s.push(`<ellipse cx="${58+i*3}" cy="${74+i*7}" rx="3" ry="4" fill="none" stroke="#6a6568" stroke-width="1.4"/>`);
    // grades na frente (a cela vista de dentro)
    s.push(rect(0,0,W,6,'#111014'));
    for(let x=14; x<W; x+=30) s.push(rect(x,0,7,H,'#141317'));
    s.push(rect(0,120,W,7,'#141317'));
    if(o.has('figuras')) s.push(figure(120,148,34,'#14131a'));
    if(o.has('barris')) s.push(barrels(280,148));
    if(o.has('caixotes')) s.push(crates(26,148));
    if(o.has('fogueira')) s.push(fire(160,146,1.3,defs));
    if(o.has('tochas')) s.push(torch(96,52,defs));
    return s.join('');
  }
},

taverna: {
  name:'Taverna', emoji:'🍺',
  words:['taverna','bar','estalagem','pub','boteco','hospedaria','salao de bebida','mesa de taverna'],
  draw(o){
    const {defs, rng, T} = o, s = [];
    const skyId = uid('g'); defs.push(grad(skyId, T.sky[0], T.sky[1], true));
    s.push(rect(0,0,W,H,'#3a2a1d'));
    for(let x=0; x<W; x+=22) s.push(rect(x,0,20,120,'#43301f'));
    for(let x=0; x<W; x+=22) s.push(line(x+20,0,x+20,120,'#2f2116',1.4));
    // janela
    s.push(rect(22,26,54,40,'#2a1d13'));
    s.push(rect(26,30,46,32,`url(#${skyId})`));
    s.push(line(49,30,49,62,'#2a1d13',3)); s.push(line(26,46,72,46,'#2a1d13',3));
    // prateleira com garrafas
    s.push(rect(150,44,140,5,'#5a4126'));
    for(let i=0;i<9;i++){ const x=158+i*15, h=R(rng,12,20);
      s.push(rect(x,44-h,7,h, ['#3f6b45','#6b3f3f','#6b5b2f','#3f4f6b'][Ri(rng,0,3)]));
      s.push(rect(x+2.4,44-h-4,2.2,4,'#2e2a22')); }
    // balcão
    s.push(rect(0,112,W,10,'#6b4a2a'));
    s.push(rect(0,122,W,58,'#4a3320'));
    for(let x=6; x<W; x+=40) s.push(rect(x,124,30,54,'#553a24'));
    // canecas
    for(let i=0;i<3;i++){ const x=40+i*26; s.push(rect(x,102,12,11,'#b9975b')); s.push(rect(x+11,105,4,5,'#b9975b')); s.push(rect(x,100,12,3,'#efe6cf')); }
    // lampião pendurado
    s.push(line(250,0,250,34,'#2b1f14',1.6));
    s.push(path('M244 34H256L258 48H242Z','#3b2a1a'));
    s.push(lightBall(defs,250,44,36,'#ffb95a'));
    s.push(rect(245,38,10,9,'#ffd98a'));
    if(o.has('barris')) s.push(barrels(292,112));
    if(o.has('caixotes')) s.push(crates(118,112));
    if(o.has('figuras')){ s.push(figure(96,112,42,'#241708')); s.push(figure(196,112,40,'#241708')); }
    if(o.has('fogueira')) s.push(fire(300,150,1.2,defs));
    if(o.has('tochas')) s.push(torch(120,40,defs));
    return s.join('');
  }
},

salao: {
  name:'Salão do trono', emoji:'👑',
  words:['salao','salão','trono','corte','castelo','palacio','palácio','coroa','rei','rainha','nobre'],
  draw(o){
    const {defs, T} = o, s = [];
    const skyId = uid('g'); defs.push(grad(skyId, T.sky[0], T.sky[1], true));
    s.push(rect(0,0,W,H,'#2b2740'));
    // janelões ao fundo
    for(let i=0;i<3;i++){ const x=40+i*98;
      s.push(path(`M${x} 108V50C${x} 32 ${x+20} 22 ${x+30} 22C${x+40} 22 ${x+60} 32 ${x+60} 50V108Z`, '#1d1a2d'));
      s.push(path(`M${x+5} 104V52C${x+5} 36 ${x+22} 27 ${x+30} 27C${x+38} 27 ${x+55} 36 ${x+55} 52V104Z`, `url(#${skyId})`));
      s.push(line(x+30,27,x+30,104,'#1d1a2d',3));
    }
    // colunas
    for(const x of [12, 96, 210, 292]){
      s.push(rect(x-9,0,18,H,'#3b3556'));
      s.push(rect(x-12,0,24,10,'#4a4368'));
      s.push(rect(x-12,104,24,8,'#4a4368'));
    }
    // piso e tapete
    s.push(rect(0,112,W,68,'#332e4a'));
    s.push(path(`M134 112H186L236 ${H}H84Z`, '#7e2233'));
    s.push(path(`M141 112H179L220 ${H}H100Z`, '#96293c'));
    // degraus e trono
    s.push(rect(126,100,68,6,'#4a4368')); s.push(rect(132,94,56,6,'#544c74'));
    s.push(path('M142 94V58C142 48 150 44 160 44C170 44 178 48 178 58V94Z','#584a2a'));
    s.push(path('M146 94V60C146 52 152 49 160 49C168 49 174 52 174 60V94Z','#7d6a36'));
    s.push(circ(160,40,5,'#d9b64a'));
    // estandartes
    s.push(path('M56 18H84V74L70 66L56 74Z','#6a2233'));
    s.push(path('M236 18H264V74L250 66L236 74Z','#6a2233'));
    if(o.has('figuras')){ s.push(figure(108,112,46,'#1b1830')); s.push(figure(214,112,46,'#1b1830')); }
    if(o.has('tochas')){ s.push(torch(30,56,defs)); s.push(torch(290,56,defs,true)); }
    if(o.has('fogueira')) s.push(fire(60,150,1.3,defs));
    if(o.has('barris')) s.push(barrels(292,150));
    if(o.has('caixotes')) s.push(crates(22,150));
    return s.join('');
  }
},

floresta: {
  name:'Floresta', emoji:'🌲',
  words:['floresta','mata','bosque','selva','arvore','árvore','arvores','árvores','trilha','clareira','pantano','pântano'],
  draw(o){
    const {defs, rng, T} = o, s = [];
    const skyId = uid('g'); defs.push(grad(skyId, T.sky[0], T.sky[1], true));
    s.push(rect(0,0,W,H,`url(#${skyId})`));
    // lua ou sol
    if(o.T===TIME.noite){
      s.push(circ(262,36,13,'#e7ecff'));
      for(let i=0;i<40;i++) s.push(circ(R(rng,0,W),R(rng,0,90),R(rng,0.4,1.1),'#dbe6ff',` opacity="${R(rng,.3,.9).toFixed(2)}"`));
    } else s.push(circ(262,36,15,T.glow));
    // montanhas ao fundo
    s.push(path(`M0 104L52 62L94 104L140 70L196 104L252 66L${W} 104V${H}H0Z`, '#39485a'));
    // três camadas de árvores
    const trees = (baseY, h, color, step) => {
      let out = '';
      for(let x=-10; x<W+20; x+=step){
        const hh = h * R(rng,0.8,1.2), w = hh*0.5;
        out += path(`M${x} ${baseY}L${x-w/2} ${baseY}L${x} ${baseY-hh}L${x+w/2} ${baseY}Z`, color);
        out += path(`M${x} ${baseY-hh*0.35}L${x-w/2.6} ${baseY-hh*0.35}L${x} ${baseY-hh*1.12}L${x+w/2.6} ${baseY-hh*0.35}Z`, color);
      }
      return out;
    };
    s.push(trees(116, 44, '#24372f', 26));
    s.push(trees(132, 60, '#1b2a25', 34));
    // chão e trilha
    s.push(path(`M0 ${H}H${W}V128C220 136 120 124 0 134Z`, T===TIME.dia ? '#4b5b38' : '#2b3327'));
    s.push(path(`M126 ${H}L150 130H172L206 ${H}Z`, '#5a4c36'));
    // árvores da frente
    s.push(path(`M18 ${H}L10 120L26 118L34 ${H}Z`, '#141d1a'));
    s.push(path(`M${W-18} ${H}L${W-34} 116L${W-8} 112L${W} ${H}Z`, '#141d1a'));
    if(o.T===TIME.noite) for(let i=0;i<14;i++) s.push(circ(R(rng,20,300),R(rng,110,164),1.2,'#c8ff8a',' opacity=".8"'));
    if(o.has('figuras')){ s.push(figure(112,140,34,'#10160f')); s.push(figure(196,142,30,'#10160f')); }
    if(o.has('fogueira')) s.push(fire(160,152,1.6,defs));
    if(o.has('tochas')) s.push(torch(62,120,defs));
    if(o.has('barris')) s.push(barrels(266,148));
    if(o.has('caixotes')) s.push(crates(44,150));
    return s.join('');
  }
},

nave: {
  name:'Nave / estação', emoji:'🚀',
  words:['nave','estacao','estação','espaco','espaço','orbita','órbita','corredor','astronave','modulo','módulo','laborator'],
  draw(o){
    const {defs, rng, has} = o, s = [];
    s.push(rect(0,0,W,H,'#161b24'));
    // corredor em perspectiva
    const cx = 160, cy = 88;
    for(let i=4;i>=1;i--){
      const k = i/4, w = 300*k, h = 168*k;
      s.push(rect(cx-w/2, cy-h/2, w, h, i%2 ? '#1d2531' : '#212a37'));
      s.push(`<rect x="${cx-w/2}" y="${cy-h/2}" width="${w}" height="${h}" fill="none" stroke="#2c384a" stroke-width="1.5"/>`);
    }
    // painéis nas paredes
    for(let i=0;i<4;i++){
      s.push(rect(8+i*6, 40+i*4, 5, 100-i*8, '#2a3546'));
      s.push(rect(W-13-i*6, 40+i*4, 5, 100-i*8, '#2a3546'));
    }
    s.push(rect(22,64,26,18,'#25405c')); s.push(rect(25,67,20,5,'#4f9bd8')); s.push(rect(25,74,12,3,'#3f7fae'));
    s.push(rect(272,64,26,18,'#25405c')); s.push(rect(275,67,20,12,'#2b5570'));
    // luzes do teto
    for(let i=0;i<4;i++){ const k=(i+1)/5, w=120*(1-k*0.6);
      s.push(rect(cx-w/2, 10+i*7, w, 3, '#cfe6ff', ' opacity=".55"')); }
    // porta ao fundo com janela para o espaço
    s.push(rect(cx-30, cy-26, 60, 58, '#0c1018'));
    s.push(circ(cx, cy-2, 20, '#05070e'));
    for(let i=0;i<26;i++) s.push(circ(cx + R(rng,-18,18), cy-2 + R(rng,-18,18), R(rng,.4,1.2), '#cfe0ff', ` opacity="${R(rng,.4,1).toFixed(2)}"`));
    s.push(circ(cx+8, cy+6, 6, '#3f6b8f')); s.push(circ(cx+6, cy+4, 4.6, '#5b90b8'));
    // piso
    s.push(rect(0,150,W,30,'#1a222e'));
    for(let x=0;x<W;x+=26) s.push(line(x,150,x-10,H,'#232d3c',1.4));
    if(has('alerta')){
      const id = uid('al'); defs.push(radial(id, '#ff2f2f88', '#ff2f2f00'));
      s.push(rect(0,0,W,H,`url(#${id})`, ' opacity=".55"'));
      s.push(circ(28,30,5,'#ff4444')); s.push(circ(292,30,5,'#ff4444'));
    }
    if(has('figuras')){ s.push(figure(96,150,44,'#0d131c')); s.push(figure(226,150,40,'#0d131c')); }
    if(has('caixotes')) s.push(crates(52,150));
    if(has('barris')) s.push(barrels(258,150));
    return s.join('');
  }
},

carro: {
  name:'Dentro do carro', emoji:'🚗',
  words:['carro','dentro do carro','estrada','rodovia','dirigindo','van','caminhao','caminhão','volante','carona','fuga de carro','banco de tras'],
  draw(o){
    const {defs, rng, T} = o, s = [];
    const skyId = uid('g'); defs.push(grad(skyId, T.sky[0], T.sky[1], true));
    const dia = o.T === TIME.dia, noite = o.T === TIME.noite;
    s.push(rect(0,0,W,H,'#14141a'));
    // --- o que se vê pelo para-brisa
    s.push(rect(18,14,284,96,`url(#${skyId})`));
    if(noite){ for(let i=0;i<24;i++) s.push(circ(R(rng,24,296), R(rng,18,52), R(rng,.5,1.2), '#dde7ff', ` opacity="${R(rng,.4,1).toFixed(2)}"`)); }
    else s.push(circ(238,40,13,T.glow,' opacity=".95"'));
    // horizonte e morros
    s.push(path(`M18 74L70 60L120 72L170 56L226 70L270 58L302 74V110H18Z`, dia ? '#4d6b54' : noite ? '#232f45' : '#4a4352'));
    s.push(rect(18,74,284,3, dia ? '#6b8a63' : '#2c3950'));
    // estrada em perspectiva
    s.push(path('M18 110H302L204 74H136Z', dia ? '#4a4a52' : '#2b2c36'));
    s.push(path('M136 74H204L212 78H128Z', '#565660', ' opacity=".5"'));
    // faixas centrais
    for(let i=0;i<5;i++){
      const k = i/5, y = 76 + k*k*34, w = 2 + k*7, h = 2 + k*4;
      s.push(rect(170 - w/2, y, w, h, '#e9e2c4', ` opacity="${(0.55 + k*0.4).toFixed(2)}"`));
    }
    // acostamento
    s.push(path('M18 110L136 74H132L10 110Z', '#c9c4b4', ' opacity=".55"'));
    s.push(path('M302 110L204 74H208L310 110Z', '#c9c4b4', ' opacity=".55"'));
    if(noite){  // faróis iluminando a pista
      const id = uid('hl'); defs.push(radial(id, '#fff2c088', '#fff2c000'));
      s.push(`<ellipse cx="170" cy="104" rx="120" ry="34" fill="url(#${id})" opacity=".7"/>`);
    }
    // --- interior do carro: a moldura é feita de peças, para o vidro não ser tapado
    s.push(rect(0,0,W,14,'#24242b'));                               // teto
    s.push(path('M0 0H26L18 110H0Z', '#24242b'));                   // coluna esquerda
    s.push(path(`M${W} 0H294L302 110H${W}Z`, '#24242b'));           // coluna direita
    s.push(path('M0 14H320V19H0Z', '#2d2d36'));                     // friso do teto
    s.push(path('M18 104H302V110H18Z', '#1b1b21'));                 // base do vidro
    // retrovisor
    s.push(rect(142,6,38,13,'#2b2b33')); s.push(rect(145,8,32,9,'#55626e'));
    // painel
    s.push(path(`M0 110H${W}V${H}H0Z`, '#1e1e25'));
    s.push(path(`M0 110H${W}V124C250 136 70 136 0 124Z`, '#2b2b34'));
    s.push(rect(0,132,W,4,'#34343f'));
    // instrumentos
    s.push(circ(72,152,21,'#131318')); s.push(circ(72,152,17,'#232330'));
    s.push(line(72,152,84,142,'#9fb0c6',2.4)); s.push(circ(72,152,3.4,'#9fb0c6'));
    s.push(circ(124,154,15,'#131318')); s.push(circ(124,154,11.5,'#232330'));
    s.push(line(124,154,130,146,'#e0663c',1.8));
    // console central
    s.push(rect(150,140,40,26,'#1a1a21'));
    s.push(rect(154,144,32,8,'#2f4a5e')); s.push(rect(156,146,10,4,'#63a8d6'));
    for(let i=0;i<3;i++) s.push(circ(160+i*11,160,3,'#3a3a45'));
    // volante
    s.push(`<circle cx="246" cy="156" r="32" fill="none" stroke="#2c2c35" stroke-width="10"/>`);
    s.push(line(216,156,276,156,'#2c2c35',7)); s.push(circ(246,156,9,'#353540'));
    if(o.has('alerta')){ s.push(circ(100,168,4,'#ff4444')); s.push(circ(112,168,4,'#ffb444')); }
    if(o.has('figuras')) s.push(figure(296,110,56,'#0f0f14'));
    return s.join('');
  }
},

beco: {
  name:'Beco da cidade', emoji:'🌃',
  words:['beco','rua','cidade','viela','avenida','esquina','calçada','calcada','predio','prédio','urbano','favela','bairro'],
  draw(o){
    const {defs, rng, T} = o, s = [];
    const skyId = uid('g'); defs.push(grad(skyId, T.sky[0], T.sky[1], true));
    const noite = o.T === TIME.noite;
    s.push(rect(0,0,W,H,`url(#${skyId})`));
    if(noite) for(let i=0;i<26;i++) s.push(circ(R(rng,110,210), R(rng,4,46), R(rng,.4,1), '#e3ebff', ' opacity=".7"'));
    // prédio do fundo, fechando o beco
    s.push(rect(108,26,104,88,'#39415a'));
    for(let y=34;y<104;y+=18) for(let x=116;x<204;x+=22){
      const on = rng() < (noite ? .55 : .2);
      s.push(rect(x,y,14,11, on ? '#ffd68a' : '#232a3d', on ? ' opacity=".95"' : ''));
    }
    // porta ao fundo
    s.push(rect(146,86,28,28,'#1e2433')); s.push(circ(170,101,1.8,'#c9a24a'));
    // prédios laterais em perspectiva
    s.push(path(`M0 0H84L108 30V${H}H0Z`, '#2d3348'));
    s.push(path(`M${W} 0H236L212 30V${H}H${W}Z`, '#272d40'));
    s.push(path(`M84 0H100L120 32H108Z`, '#39405a'));
    s.push(path(`M236 0H220L200 32H212Z`, '#333a52'));
    // janelas laterais, alinhadas em grade
    for(let r=0;r<4;r++) for(let c=0;c<3;c++){
      const y = 18 + r*30;
      const on1 = rng() < (noite ? .5 : .15), on2 = rng() < (noite ? .5 : .15);
      s.push(rect(10 + c*30, y, 18, 14, on1 ? '#ffd68a' : '#1b2131', on1 ? ' opacity=".9"' : ''));
      s.push(rect(W-28 - c*30, y, 18, 14, on2 ? '#ffd68a' : '#181e2c', on2 ? ' opacity=".9"' : ''));
    }
    // escada de incêndio à direita
    for(let i=0;i<3;i++){ const y=46+i*30;
      s.push(rect(230,y,52,3,'#3a4258')); s.push(line(244,y,238,y+30,'#3a4258',1.6)); s.push(line(266,y,272,y+30,'#3a4258',1.6)); }
    // rua
    s.push(path(`M108 114H212L${W} ${H}H0Z`, '#2f3446'));
    s.push(path(`M150 114H170L200 ${H}H120Z`, '#373d52', ' opacity=".8"'));
    s.push(rect(0,112,W,4,'#242938'));
    // reflexo molhado
    s.push(`<ellipse cx="160" cy="166" rx="86" ry="10" fill="#4b5group" opacity="0"/>`);
    s.push(`<ellipse cx="160" cy="166" rx="86" ry="10" fill="#47526b" opacity=".55"/>`);
    s.push(`<ellipse cx="96" cy="150" rx="30" ry="5" fill="#47526b" opacity=".4"/>`);
    // poste
    s.push(rect(62,50,5,74,'#1b2130'));
    s.push(path('M62 50H92V55H62Z','#1b2130'));
    s.push(path('M84 55H100L96 64H88Z','#2a3142'));
    s.push(lightBall(defs,92,66,52,'#ffd68a'));
    s.push(rect(86,60,12,4,'#ffeab8'));
    if(noite) s.push(`<ellipse cx="92" cy="160" rx="34" ry="7" fill="#ffd68a" opacity=".16"/>`);
    // lixeira
    s.push(rect(214,116,46,28,'#2c4038')); s.push(rect(212,112,50,6,'#38503f'));
    s.push(line(220,120,220,140,'#26382f',2)); s.push(line(252,120,252,140,'#26382f',2));
    if(o.has('figuras')){ s.push(figure(122,152,46,'#12161f')); s.push(figure(158,148,40,'#12161f')); }
    if(o.has('fogueira')) s.push(fire(46,152,1.3,defs));
    if(o.has('caixotes')) s.push(crates(274,154));
    if(o.has('barris')) s.push(barrels(22,154));
    return s.join('');
  }
},

};

/* ---------- objetos soltos ---------- */
function barrels(x, y){
  const one = (bx, by, s) =>
    path(`M${bx-7*s} ${by}C${bx-9*s} ${by-8*s} ${bx-9*s} ${by-14*s} ${bx-7*s} ${by-20*s}H${bx+7*s}C${bx+9*s} ${by-14*s} ${bx+9*s} ${by-8*s} ${bx+7*s} ${by}Z`, '#5a3f22')
    + rect(bx-8.6*s, by-14*s, 17.2*s, 2.4*s, '#7a6136') + rect(bx-8.6*s, by-7*s, 17.2*s, 2.4*s, '#7a6136');
  return one(x, y, 1) + one(x+15, y, .82);
}
function crates(x, y){
  const one = (cx, cy, s) =>
    rect(cx-9*s, cy-18*s, 18*s, 18*s, '#6b5231')
    + `<rect x="${cx-9*s}" y="${cy-18*s}" width="${18*s}" height="${18*s}" fill="none" stroke="#4a3821" stroke-width="${1.6*s}"/>`
    + line(cx-9*s, cy-18*s, cx+9*s, cy, '#4a3821', 1.4*s);
  return one(x, y, 1) + one(x+17, y, .78) + one(x+6, y-18, .62);
}

/* ---------- clima (camada por cima de tudo) ---------- */
function weatherLayer(w, rng, defs){
  if(w === 'chuva'){
    let out = '';
    for(let i=0;i<90;i++){ const x=R(rng,-20,W+20), y=R(rng,0,H);
      out += line(x, y, x-5, y+13, '#bcd3ef', 1, ` opacity="${R(rng,.15,.5).toFixed(2)}"`); }
    return out + rect(0,0,W,H,'#3b5470',' opacity=".14"');
  }
  if(w === 'neve'){
    let out = rect(0,0,W,H,'#9fb6cf',' opacity=".10"');
    for(let i=0;i<110;i++) out += circ(R(rng,0,W), R(rng,0,H), R(rng,.7,2), '#ffffff', ` opacity="${R(rng,.3,.95).toFixed(2)}"`);
    return out;
  }
  if(w === 'nevoa'){
    const id = uid('fg'); defs.push(grad(id, '#c9d6e300', '#c9d6e355', true));
    let out = rect(0,70,W,110,`url(#${id})`, ' opacity=".55"');
    for(let i=0;i<3;i++){ const y=R(rng,110,168);
      out += `<ellipse cx="${R(rng,60,260)}" cy="${y}" rx="${R(rng,70,130)}" ry="${R(rng,5,9)}" fill="#cfdae6" opacity="${R(rng,.07,.13).toFixed(2)}"/>`; }
    return out;
  }
  return '';
}

/* ---------- leitura do texto do mestre ---------- */
const norm = t => String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const TIME_WORDS = {
  noite:['noite','madrugada','escuro','escuridao','lua','anoitec','breu'],
  tarde:['tarde','entardecer','por do sol','crepusculo','fim de tarde','amanhec','aurora'],
  penumbra:['penumbra','sombrio','sombra','mal iluminad','pouca luz','abafad','umido'],
  dia:['dia','manha','sol','meio-dia','claro','luz do dia','tarde ensolarada'],
};
const WEATHER_WORDS = {
  chuva:['chuva','chovendo','tempestade','temporal','chuvisco','molhad','trovoada'],
  neve:['neve','nevando','gelo','gelad','nevasca','inverno','congelad'],
  nevoa:['nevoa','neblina','bruma','fumaca','cerracao','vapor'],
};
const PROP_WORDS = {
  fogueira:['fogueira','fogo','chamas','lareira','brasa','incendio'],
  tochas:['tocha','tochas','archote','lampiao','lanterna','candeeiro'],
  figuras:['goblin','guarda','sentinela','figura','vulto','inimigo','soldado','bandido','criatura','silhueta','gente','pessoas','tripula','multidao','orc','ladrao'],
  barris:['barril','barris','tonel','toneis','pipa de'],
  caixotes:['caixote','caixotes','caixa','caixas','engradado','carga','suprimento'],
  alerta:['alerta','alarme','emergencia','vermelho pisc','sirene','perigo'],
};
function hits(txt, words){ return words.some(w => txt.includes(w)); }

function fromText(text, seed){
  const t = norm(text);
  // cenário: o que tiver mais palavras batendo
  let best = null, bestScore = 0;
  for(const id in SCENES){
    const score = SCENES[id].words.reduce((n,w) => n + (t.includes(norm(w)) ? 1 : 0), 0);
    if(score > bestScore){ best = id; bestScore = score; }
  }
  const cfg = { id: best || 'gruta', matched: bestScore > 0, time:'penumbra', weather:'limpo', props:[], seed: seed || String(Math.floor(Math.random()*1e6)) };
  for(const k in TIME_WORDS) if(hits(t, TIME_WORDS[k])){ cfg.time = k; break; }
  if(!best && !bestScore) cfg.time = 'penumbra';
  for(const k in WEATHER_WORDS) if(hits(t, WEATHER_WORDS[k])) cfg.weather = k;
  for(const k in PROP_WORDS) if(hits(t, PROP_WORDS[k])) cfg.props.push(k);
  return cfg;
}

/* ---------- API de desenho ---------- */
function normalize(cfg){
  cfg = cfg || {};
  return {
    id: SCENES[cfg.id] ? cfg.id : 'gruta',
    time: TIME[cfg.time] ? cfg.time : 'penumbra',
    weather: WEATHER[cfg.weather] ? cfg.weather : 'limpo',
    props: Array.isArray(cfg.props) ? cfg.props.filter(p => PROPS[p]) : [],
    seed: String(cfg.seed || '1'),
  };
}
function svg(cfg, opt){
  const c = normalize(cfg);
  opt = opt || {};
  const defs = [], rng = mkRng(c.id + c.time + c.weather + c.props.join('') + c.seed);
  const T = TIME[c.time];
  const o = { defs, rng, T, has: p => c.props.includes(p) };
  const body = SCENES[c.id].draw(o);
  const weather = weatherLayer(c.weather, rng, defs);
  const vig = uid('vg');
  defs.push(`<radialGradient id="${vig}"><stop offset=".62" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".3"/></radialGradient>`);
  const w = opt.w || 640;
  return `<svg viewBox="0 0 ${W} ${H}" width="${w}" height="${Math.round(w*H/W)}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Cena: ${SCENES[c.id].name}" xmlns="http://www.w3.org/2000/svg">
  <defs>${defs.join('')}</defs>
  ${body}${weather}
  ${T.tint ? rect(0,0,W,H,T.tint) : ''}
  ${rect(0,0,W,H,`url(#${vig})`)}
</svg>`;
}
const code  = cfg => { const c = normalize(cfg); return `${c.id}.${c.time}.${c.weather}.${c.props.join('+')||'-'}~${c.seed}`; };
const parse = str => {
  const [main, seed] = String(str||'').split('~');
  const [id, time, weather, props] = String(main||'').split('.');
  return normalize({id, time, weather, props: props && props !== '-' ? props.split('+') : [], seed});
};
const random = () => {
  const ids = Object.keys(SCENES), times = Object.keys(TIME), ws = Object.keys(WEATHER), ps = Object.keys(PROPS);
  const rng = Math.random;
  return normalize({ id: ids[Math.floor(rng()*ids.length)], time: times[Math.floor(rng()*times.length)],
    weather: ws[Math.floor(rng()*ws.length)], props: ps.filter(()=>rng()<.35), seed: String(Math.floor(rng()*1e6)) });
};

root.Cena = { SCENES, TIME, WEATHER, PROPS, svg, fromText, normalize, code, parse, random, W, H };

})(typeof window !== 'undefined' ? window : globalThis);
