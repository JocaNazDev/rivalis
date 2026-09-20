/* ============================================================
   Rivalis · rivalis-core.js
   O NÚCLEO DO JOGO. Roda só no aparelho do mestre: guarda o estado,
   sorteia os papéis, valida tudo que chega dos jogadores e decide o
   que cada um pode ver.

   Regras de ouro deste arquivo:
   1. Nada que sai daqui para um jogador contém segredo de outro.
      Papel alheio, voto antes da revelação e carta de missão de cada
      um nunca entram na visão enviada.
   2. Cada jogador tem DOIS identificadores:
        cid = segredo, só o mestre e o dono conhecem (é a senha dele)
        pid = público, é o que aparece no estado e nas telas
      Assim ninguém consegue se passar por outro jogador.
   3. Toda mensagem recebida é tratada como não confiável: tipo,
      formato, tamanho e faixa de valores são conferidos, e há limite
      de mensagens por segundo.

   API:
     Game.init({send, onChange})     send(connKey, msg) entrega ao jogador
     Game.create(code) / Game.load(saved) / Game.save()
     Game.input(connKey, msg)        mensagem crua vinda de um jogador
     Game.dropConn(connKey)          conexão caiu
     Game.act.<ação>()               ações do mestre (botões da tela)
     Game.hostView(showRoles)        visão do mestre
     Game.state                      estado bruto (só o mestre tem)
   ============================================================ */
(function (root) {
'use strict';

/* ---------- Tabelas e textos (regras do jogo) ---------- */
const TABLE = {
  3:{spies:1,sizes:[1,2,2,2,2]},
  4:{spies:1,sizes:[2,2,2,3,3]},
  5:{spies:2,sizes:[2,3,2,3,3]},
  6:{spies:2,sizes:[2,3,4,3,4]},
  7:{spies:3,sizes:[2,3,3,4,4]},
  8:{spies:3,sizes:[3,4,4,5,5]},
  9:{spies:3,sizes:[3,4,4,5,5]},
  10:{spies:4,sizes:[3,4,4,5,5]},
};
const needsTwo = (n,i) => n >= 7 && i === 3;
const sabs = n => n === 1 ? '1 sabotagem' : n + ' sabotagens';

const TPL = {
  accuse:[
    'Acho que {X} é espião.',
    '{X} votou estranho na última votação.',
    'Não confio em {X} nessa equipe.',
    '{X} estava na missão que falhou.',
    '{X} está quieto demais...',
    '{X} está defendendo espião, certeza.',
  ],
  defend:[
    'Confio em {X}.',
    '{X} estava numa missão que deu certo.',
    'Coloco minha mão no fogo por {X}.',
    'Deixem {X} em paz, não tem prova nenhuma.',
    '{X} deveria entrar na próxima equipe.',
  ],
  say:[
    'Eu sou da resistência!',
    'Não sou espião, juro!',
    'Quero entrar na próxima equipe.',
    'Aprovem essa equipe!',
    'Rejeitem essa equipe!',
    'Tem espião nessa equipe.',
    'Alguém aqui está mentindo.',
    'Confiem em mim.',
    'Vamos com calma, pensem bem.',
  ],
};
const KIND_LABEL = {accuse:'Acusar', defend:'Defender', ally:'Aliança', say:'Falar'};

/* ---------- Lore: a história da sala ---------- */
const LORE_MAX = {title:60, world:1200, call:600, mtitle:60, mtext:600, win:600};
const M5 = (a,b,c,d,e) => [a,b,c,d,e].map(x => ({title:x[0], text:x[1], scene:x[2] || ''}));
// código de cena do cena.js, ex.: 'gruta.noite.limpo.tochas+figuras~4812'
const isScene = v => typeof v === 'string' && /^[a-z]{2,12}\.[a-z]{2,10}\.[a-z]{2,10}\.([a-z]{2,10}(\+[a-z]{2,10}){0,5}|-)~[a-z0-9]{1,12}$/.test(v);

const LORE_PRESETS = [
{ id:'goblins', name:'A Gruta dos Goblins',
  title:'A Gruta dos Goblins',
  world:'A vila de Pedra Fria perdeu três caravanas em um mês. Todos sabem o motivo: os goblins voltaram a ocupar a gruta do rio. O conselho reuniu os melhores guerreiros que restaram e prometeu ouro, terras e o fim do medo.\n\nO que o conselho não contou é que alguém aceitou ouro dos goblins antes. Um de vocês entra na gruta para fazer a missão fracassar, e ninguém sabe quem.',
  call:'Entrem na gruta, limpem os salões um a um e cheguem ao salão do chefe. Três avanços bem-sucedidos e a gruta é de vocês. Três fracassos e Pedra Fria cai.',
  missions: M5(
   ['A boca da gruta','O cheiro de enxofre sobe do buraco. Duas sentinelas goblins cochilam perto da fogueira. Quem entrar precisa passar sem fazer barulho: uma pedra no lugar errado acorda a gruta inteira.','gruta.noite.limpo.fogueira+figuras~7'],
   ['A ponte de cordas','Um vão fundo corta o caminho, com uma ponte velha balançando sobre a água preta. Alguém precisa atravessar primeiro e firmar as cordas do outro lado. Se as cordas cederem, ninguém passa.','gruta.penumbra.nevoa.tochas~12'],
   ['O salão dos tambores','Os goblins se reúnem ao som dos tambores. O plano é simples: cortar as peles dos tambores durante a troca de guarda. Sem o sinal, eles não conseguem se juntar para o contra-ataque.','gruta.penumbra.limpo.tochas+figuras~21'],
   ['A despensa envenenada','A comida da gruta fica num salão fechado. Basta trocar os barris e metade dos goblins vai dormir doente amanhã. Basta também alguém avisar os goblins para tudo desandar.','gruta.penumbra.limpo.barris+caixotes~33'],
   ['O salão do chefe','Grunga, o Quebra-Ossos, espera sentado num trono de ossos. É agora. Quem entrar nesse salão volta como herói de Pedra Fria, ou não volta.','gruta.penumbra.limpo.fogueira+figuras~44'],
  ),
  cover:'floresta.noite.nevoa.fogueira+figuras~5',
  winR:'A gruta está silenciosa. Pedra Fria acende as fogueiras da festa e o nome de vocês vai entrar nas canções do inverno.',
  winS:'Os tambores ecoam pelo vale. A gruta cuspiu vocês de volta, e alguém desce o rio com uma bolsa de ouro goblin tilintando no cinto.' },

{ id:'nave', name:'Estação Kessler',
  title:'Estação Kessler',
  world:'A estação Kessler perdeu contato com a Terra há 40 dias. A tripulação de vocês chegou para religar os sistemas antes que a órbita decaia de vez.\n\nA empresa que construiu a estação não quer ninguém lendo os registros antigos. Alguém aqui foi pago para garantir que a Kessler caia com os segredos dentro.',
  call:'Religuem os sistemas críticos, um de cada vez. Três sistemas de volta e a estação sobe de órbita. Três falhas e ela queima na atmosfera com vocês dentro.',
  missions: M5(
   ['Energia auxiliar','Os corredores estão no escuro e no frio. Alguém precisa descer até o reator auxiliar e religar as células na ordem certa. Na ordem errada, tudo apaga de vez.','nave.penumbra.limpo.-~4'],
   ['Ar e pressão','O setor B está com pressão caindo devagar. É preciso soldar as placas do casco por fora, no vácuo, com meia hora de oxigênio nas costas.','nave.noite.limpo.alerta~9'],
   ['Antena de longo alcance','Sem a antena, ninguém na Terra sabe que vocês estão vivos. O prato está travado de gelo e desalinhado. Basta um ajuste de graus para o sinal sair.','nave.noite.limpo.figuras~14'],
   ['Núcleo de dados','Os registros dos 40 dias perdidos estão num núcleo trancado. Copiar tudo leva minutos, e qualquer comando errado apaga o conteúdo para sempre.','nave.penumbra.limpo.caixotes~19'],
   ['Correção de órbita','Último empurrão. Os motores precisam queimar no tempo exato para a Kessler subir. Um segundo a mais e ela mergulha.','nave.noite.limpo.alerta+figuras~24'],
  ),
  cover:'nave.noite.limpo.alerta~2',
  winR:'A Kessler sobe. A Terra responde ao chamado de vocês depois de 40 dias de silêncio, e os registros chegam inteiros.',
  winS:'A estação entra na atmosfera como uma estrela cadente. Ninguém na Terra vai saber o que aconteceu ali, e era exatamente esse o plano de alguém.' },

{ id:'corte', name:'A Corte de Inverno',
  title:'A Corte de Inverno',
  world:'O rei morreu sem herdeiro e a corte se fechou para escolher o próximo nome. Vocês são os conselheiros que restaram fiéis, ou pelo menos é o que todos dizem uns aos outros.\n\nUma casa rival plantou alguém nesta sala. Enquanto vocês tentam segurar o reino, essa pessoa trabalha para que tudo desmorone antes da primavera.',
  call:'Conduzam o reino por cinco decisões até a coroação. Três decisões bem tomadas e a coroa fica em pé. Três desastres e a corte cai nas mãos da casa rival.',
  missions: M5(
   ['O selo real','O selo precisa ser guardado antes que alguém falsifique uma ordem em nome do rei morto. Quem levar o selo até a cripta terá as mãos livres no caminho.','salao.tarde.limpo.figuras~6'],
   ['O tesouro da corte','Os cofres precisam ser contados e lacrados diante de testemunhas. Moedas somem fácil quando a contagem é feita por quem não deveria.','cela.penumbra.limpo.caixotes+tochas~11'],
   ['A carta aos generais','Uma carta vai partir para os quartéis do norte pedindo lealdade. Basta trocar uma linha para transformar um pedido de paz numa declaração de guerra.','salao.noite.limpo.tochas~16'],
   ['O banquete','A corte inteira se senta à mesa. É a hora de costurar alianças, e também a hora perfeita para uma taça errada chegar à pessoa errada.','taverna.noite.limpo.figuras+barris~23'],
   ['A coroação','O manto está pronto, o povo espera na praça. Quem subir os degraus ao lado do herdeiro decide o que o reino vai ser amanhã.','salao.dia.limpo.figuras~31'],
  ),
  cover:'salao.tarde.limpo.tochas+figuras~3',
  winR:'A coroa desce sobre a cabeça certa. A primavera chega com o reino inteiro, e a casa rival volta para o norte de mãos vazias.',
  winS:'Os portões se abrem para os estandartes da casa rival. Alguém desta sala assiste a tudo do alto da escadaria, finalmente sem precisar fingir.' },
];

function blankLore(){
  return { title:'', world:'', call:'', cover:'',
           missions: Array.from({length:5}, ()=>({title:'', text:'', scene:''})), winR:'', winS:'' };
}
const clean = (v, max) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, max).trim();
function cleanLore(l){
  if(!isObj(l)) return blankLore();
  const out = blankLore();
  out.title = clean(l.title, LORE_MAX.title);
  out.world = clean(l.world, LORE_MAX.world);
  out.call  = clean(l.call,  LORE_MAX.call);
  out.winR  = clean(l.winR,  LORE_MAX.win);
  out.winS  = clean(l.winS,  LORE_MAX.win);
  const ms = Array.isArray(l.missions) ? l.missions : [];
  out.cover = isScene(l.cover) ? l.cover : '';
  out.missions = out.missions.map((_, i) => ({
    title: clean(ms[i] && ms[i].title, LORE_MAX.mtitle),
    text:  clean(ms[i] && ms[i].text,  LORE_MAX.mtext),
    scene: (ms[i] && isScene(ms[i].scene)) ? ms[i].scene : '',
  }));
  return out;
}
const loreEmpty = l => !l || (!l.title && !l.world && !l.call && !l.cover && l.missions.every(m => !m.title && !m.text && !m.scene));
const MAX_PLAYERS = 10;

/* ---------- Ferramentas ---------- */
function rnd(n, abc){ let s=''; const r=crypto.getRandomValues(new Uint8Array(n)); for(const x of r) s += abc[x % abc.length]; return s; }
const rid = (n=12) => rnd(n, 'abcdefghijkmnpqrstuvwxyz23456789');
const shuffle = arr => { const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

/* ---------- Validação (nada daqui confia no jogador) ---------- */
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const isIdx = (v, max) => Number.isInteger(v) && v >= 0 && v < max;
const isId  = v => typeof v === 'string' && /^[a-z0-9]{6,24}$/.test(v);
const isAv  = v => typeof v === 'string' && /^\d{1,2}(-\d{1,2}){8}$/.test(v);
const cleanName = v => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);

// Limite por conexão: no máximo 25 mensagens a cada 5 segundos
const RATE = { win: 5000, max: 25 };
const rate = {};
function tooFast(key){
  const now = Date.now();
  const r = rate[key] || (rate[key] = {t: now, n: 0});
  if(now - r.t > RATE.win){ r.t = now; r.n = 0; }
  return ++r.n > RATE.max;
}

/* ---------- Estado ---------- */
let S = null;                 // estado do jogo (só existe no mestre)
let SEND = () => {};          // entrega uma mensagem a uma conexão
let CHANGED = () => {};       // avisa a tela que algo mudou
const keyOf = {};             // cid  -> chave da conexão
const cidOf = {};             // chave -> cid
const lastChat = {};          // cid  -> instante da última fala

const byCid = cid => S.players.find(p => p.cid === cid) || null;
const byPid = pid => S.players.find(p => p.pid === pid) || null;
const online = cid => !!keyOf[cid];
const nameOf = cid => (byCid(cid) || {}).name || '?';
const allyOf = cid => { const a = S.alliances.find(x => x.includes(cid)); return a ? (a[0]===cid ? a[1] : a[0]) : null; };
const pidOf = cid => (byCid(cid) || {}).pid || '';

function blank(code){
  return { code, phase:'lobby', players:[], voteOn:true, lore:blankLore(), roles:{}, missions:[], round:0, rejects:0,
    team:[], votes:{}, voteReveal:null, mission:{}, missionReveal:null, chat:[], alliances:[], allyReqs:[],
    winner:null, winReason:'', history:[], seq:0 };
}
function addChat(c){ c.id = ++S.seq; S.chat.push(c); if(S.chat.length > 80) S.chat.splice(0, S.chat.length - 80); }
const sys = text => addChat({kind:'sys', text});

/* ---------- Visões (o que sai daqui) ---------- */
// Parte pública: igual para todo mundo, sem nenhum segredo.
function pub(){
  const revealed = S.phase === 'end';
  return {
    code:S.code, phase:S.phase, voteOn:S.voteOn,
    players: S.players.map(p => ({pid:p.pid, name:p.name, av:p.av || '', on:online(p.cid)})),
    missions: S.missions.map(m => ({size:m.size, two:m.two, result:m.result, fails:m.fails})),
    round:S.round, rejects:S.rejects,
    team: S.team.map(pidOf),
    voted: S.phase === 'vote' ? Object.keys(S.votes).map(pidOf) : [],
    voteReveal: S.voteReveal ? {
      approved:S.voteReveal.approved, yes:S.voteReveal.yes, no:S.voteReveal.no,
      votes: mapKeys(S.voteReveal.votes),
      broken: S.voteReveal.broken.map(([a,b]) => [pidOf(a), pidOf(b)]),
      followed: S.voteReveal.followed.map(pidOf),
    } : null,
    acted: (S.phase === 'mission' || S.phase === 'missionDone') ? Object.keys(S.mission).length : 0,
    missionReveal: S.missionReveal,       // cartas já embaralhadas, sem dono
    chat: S.chat.slice(-50).map(c => ({id:c.id, kind:c.kind, from:c.from ? pidOf(c.from) : null, text:c.text})),
    alliances: S.alliances.map(([a,b]) => [pidOf(a), pidOf(b)]),
    winner:S.winner, winReason:S.winReason,
    spyCount: S.phase === 'lobby'
      ? (TABLE[S.players.length] ? TABLE[S.players.length].spies : 0)
      : Object.values(S.roles).filter(r => r === 'S').length,
    // papéis SÓ no fim da partida
    roles: revealed ? mapKeys(S.roles) : null,
    // história: o mundo e o chamado desde o lobby; a introdução de cada
    // missão só quando aquela missão chega. As próximas ficam escondidas.
    lore: {
      title:S.lore.title, world:S.lore.world, call:S.lore.call, cover:S.lore.cover,
      missions: S.lore.missions.map((m, i) => (S.phase !== 'lobby' && (i <= S.round || revealed)) ? m : null),
      win: revealed ? (S.winner === 'R' ? S.lore.winR : S.lore.winS) : '',
      has: !loreEmpty(S.lore),
    },
  };
}
function mapKeys(obj){ const out = {}; for(const cid in obj) out[pidOf(cid)] = obj[cid]; return out; }

// Visão de um jogador: o público + só o que é dele.
function viewFor(cid){
  const p = byCid(cid); if(!p) return null;
  const v = pub();
  const role = S.roles[cid] || null;
  v.me = {
    pid:p.pid, name:p.name, av:p.av || '', role,
    // o espião conhece os parceiros; a resistência não recebe nada disso
    spies: role === 'S' ? S.players.filter(q => S.roles[q.cid] === 'S' && q.cid !== cid).map(q => q.name) : [],
    ally: allyOf(cid) ? pidOf(allyOf(cid)) : null,
    incoming: S.allyReqs.filter(r => r.to === cid).map(r => pidOf(r.from)),
    outgoing: S.allyReqs.filter(r => r.from === cid).map(r => pidOf(r.to)),
    voted: cid in S.votes,
    myVote: S.votes[cid] || null,
    acted: cid in S.mission,
    onTeam: S.team.includes(cid),
  };
  return v;
}
// Visão do mestre: o público + papéis quando ele pede para ver.
function hostView(showRoles){
  const v = pub();
  v.isHost = true;
  v.roles = showRoles || S.phase === 'end' ? mapKeys(S.roles) : null;
  v.allies = {};
  for(const p of S.players){ const a = allyOf(p.cid); if(a) v.allies[p.pid] = pidOf(a); }
  return v;
}

/* ---------- Envio ---------- */
function sync(){
  save();
  for(const cid in keyOf) SEND(keyOf[cid], {t:'state', s:viewFor(cid)});
  CHANGED();
}
function save(){ try{ localStorage.setItem('rivalis-host', JSON.stringify(S)); }catch(e){} }

/* ---------- Entrada dos jogadores (não confiável) ---------- */
function hello(key, m){
  const name = cleanName(m.name);
  if(!name) return SEND(key, {t:'error', msg:'Digite um nome.'});
  const av = isAv(m.av) ? m.av : '';

  // O cid é a senha do jogador: quem tem, é dono da vaga. Nunca é publicado.
  let p = isId(m.cid) ? byCid(m.cid) : null;

  if(!p && S.phase !== 'lobby'){
    // perdeu o cid (trocou de aparelho, limpou o navegador): só volta se
    // aquele jogador estiver desconectado
    p = S.players.find(q => q.name.toLowerCase() === name.toLowerCase() && !online(q.cid)) || null;
    if(!p) return SEND(key, {t:'error', msg:'A partida já começou. Aguarde a próxima.'});
  }
  if(!p){
    if(S.players.length >= MAX_PLAYERS) return SEND(key, {t:'error', msg:'Sala cheia (máximo 10 jogadores).'});
    let nm = name, i = 2;
    while(S.players.some(q => q.name.toLowerCase() === nm.toLowerCase())) nm = name + ' ' + (i++);
    p = {cid: rid(16), pid: rid(8), name: nm, av};   // o cid é criado AQUI, não vem do jogador
    S.players.push(p);
    sys(`👋 ${nm} entrou na sala.`);
  } else if(S.phase === 'lobby'){
    if(p.name !== name && !S.players.some(q => q !== p && q.name.toLowerCase() === name.toLowerCase())) p.name = name;
    if(av) p.av = av;
  }
  if(!p.av) p.av = av;

  const old = keyOf[p.cid];
  if(old && old !== key){ delete cidOf[old]; SEND(old, {t:'replaced'}); }
  keyOf[p.cid] = key; cidOf[key] = p.cid;
  SEND(key, {t:'welcome', cid:p.cid, pid:p.pid});   // o cid volta só para o dono
  sync();
}

function input(key, m){
  if(!S || !isObj(m) || typeof m.t !== 'string') return;
  if(tooFast(key)) return;                       // enxurrada: ignora
  if(m.t === 'hello') return hello(key, m);

  const cid = cidOf[key];
  if(!cid || !byCid(cid)) return;                // conexão sem dono: ignora

  switch(m.t){
    case 'vote': {
      if(S.phase !== 'vote' || (cid in S.votes)) return;
      if(m.v !== 'A' && m.v !== 'R' && m.v !== 'F') return;
      if(m.v === 'F' && !allyOf(cid)) return;
      S.votes[cid] = m.v;
      if(Object.keys(S.votes).length >= S.players.length) resolveVote();
      return sync();
    }
    case 'mission': {
      if(S.phase !== 'mission' || !S.team.includes(cid) || (cid in S.mission)) return;
      if(m.v !== 'S' && m.v !== 'F') return;
      // a resistência não consegue sabotar nem mexendo no próprio código
      S.mission[cid] = S.roles[cid] === 'S' ? m.v : 'S';
      if(Object.keys(S.mission).length >= S.team.length) S.phase = 'missionDone';
      return sync();
    }
    case 'chat': {
      const list = TPL[m.kind];
      if(!list || !isIdx(m.i, list.length)) return;      // só frases da lista
      const tpl = list[m.i];
      let target = null, text = tpl;
      if(tpl.includes('{X}')){
        if(!isId(m.target)) return;
        const t = byPid(m.target);
        if(!t || t.cid === cid) return;
        target = t.cid; text = tpl.replace('{X}', t.name);
      }
      if(Date.now() - (lastChat[cid] || 0) < 1200) return;  // 1 fala por 1,2s
      lastChat[cid] = Date.now();
      addChat({kind:m.kind, from:cid, target, text});
      return sync();
    }
    case 'avatar': {
      if(S.phase !== 'lobby' || !isAv(m.av)) return;
      byCid(cid).av = m.av;
      return sync();
    }
    case 'ally_req': {
      if(!isId(m.target)) return;
      const t = byPid(m.target);
      if(!t || t.cid === cid || allyOf(cid) || allyOf(t.cid)) return;
      if(S.allyReqs.some(r => r.from === t.cid && r.to === cid)) formAlliance(t.cid, cid);
      else {
        S.allyReqs = S.allyReqs.filter(r => r.from !== cid);
        S.allyReqs.push({from:cid, to:t.cid});
        sys(`🤝 ${nameOf(cid)} propôs aliança a ${t.name}.`);
      }
      return sync();
    }
    case 'ally_resp': {
      if(!isId(m.from)) return;
      const f = byPid(m.from); if(!f) return;
      const r = S.allyReqs.find(r => r.from === f.cid && r.to === cid); if(!r) return;
      if(m.accept === true && !allyOf(cid) && !allyOf(f.cid)) formAlliance(f.cid, cid);
      else { S.allyReqs = S.allyReqs.filter(x => x !== r); sys(`✋ ${nameOf(cid)} recusou a aliança com ${f.name}.`); }
      return sync();
    }
    case 'ally_cancel':
      S.allyReqs = S.allyReqs.filter(r => r.from !== cid);
      return sync();
    case 'ally_break': {
      const a = allyOf(cid); if(!a) return;
      S.alliances = S.alliances.filter(x => !x.includes(cid));
      sys(`💔 ${nameOf(cid)} rompeu a aliança com ${nameOf(a)}.`);
      return sync();
    }
    default: return;                              // tipo desconhecido: ignora
  }
}
function dropConn(key){
  const cid = cidOf[key]; if(!cid) return;
  delete cidOf[key]; if(keyOf[cid] === key) delete keyOf[cid];
  delete rate[key];
  sync();
}
function formAlliance(a, b){
  S.allyReqs = S.allyReqs.filter(r => ![a,b].includes(r.from) && ![a,b].includes(r.to));
  S.alliances.push([a, b]);
  sys(`🤝 ${nameOf(a)} e ${nameOf(b)} agora são aliados.`);
}

/* ---------- Regras ---------- */
function resolveVote(){
  const res = {};
  for(const p of S.players){
    let v = S.votes[p.cid];
    if(v === 'F'){ const a = allyOf(p.cid); const av = a ? S.votes[a] : null; v = (av === 'A' || av === 'R') ? av : 'R'; }
    res[p.cid] = v;
  }
  const yes = Object.values(res).filter(v => v === 'A').length;
  const approved = yes > S.players.length / 2;
  const broken = S.alliances.filter(([a,b]) => res[a] !== res[b]);
  const followed = Object.keys(S.votes).filter(c => S.votes[c] === 'F');
  S.voteReveal = {votes:res, approved, yes, no:S.players.length - yes, broken, followed};
  S.history.push({round:S.round, team:S.team.slice(), votes:res, approved});
  for(const [a,b] of broken) sys(`⚠️ ${nameOf(a)} e ${nameOf(b)} são aliados, mas votaram diferente!`);
  S.phase = 'voteResult';
}
function endGame(w, reason){
  S.winner = w; S.winReason = reason; S.phase = 'end'; S.team = [];
  sys(w === 'R' ? '🎉 A RESISTÊNCIA VENCEU!' : '🕵️ OS ESPIÕES VENCERAM!');
  sync();
}

/* ---------- Ações do mestre ---------- */
const act = {
  start(){
    const n = S.players.length, cfg = TABLE[n];
    if(!cfg || S.phase !== 'lobby') return;
    const spies = shuffle(S.players.map(p => p.cid)).slice(0, cfg.spies);
    S.roles = {};
    S.players.forEach(p => S.roles[p.cid] = spies.includes(p.cid) ? 'S' : 'R');
    S.missions = cfg.sizes.map((size,i) => ({size, two:needsTwo(n,i), result:null, fails:0}));
    Object.assign(S, {round:0, rejects:0, team:[], votes:{}, voteReveal:null, mission:{}, missionReveal:null,
      winner:null, winReason:'', history:[], alliances:[], allyReqs:[], phase:'team'});
    sys(`🎲 Partida iniciada com ${n} jogadores. Há ${cfg.spies} ${cfg.spies>1?'espiões infiltrados':'espião infiltrado'}.`);
    sync();
  },
  team(pid){
    if(S.phase !== 'team') return;
    const p = byPid(pid); if(!p) return;
    const size = S.missions[S.round].size;
    if(S.team.includes(p.cid)) S.team = S.team.filter(c => c !== p.cid);
    else if(S.team.length < size) S.team.push(p.cid);
    sync();
  },
  confirm(){
    if(S.phase !== 'team' || S.team.length !== S.missions[S.round].size) return;
    sys(`🧭 Equipe da missão ${S.round+1}: ${S.team.map(nameOf).join(', ')}.`);
    if(S.voteOn){ S.votes = {}; S.voteReveal = null; S.phase = 'vote'; }
    else { S.mission = {}; S.phase = 'mission'; }
    sync();
  },
  after(){
    if(S.phase !== 'voteResult') return;
    if(S.voteReveal.approved){ S.rejects = 0; S.mission = {}; S.phase = 'mission'; sys('✅ Equipe aprovada. A missão começou.'); }
    else {
      S.rejects++;
      if(S.rejects >= 5) return endGame('S', 'Cinco equipes rejeitadas seguidas. O caos favoreceu os espiões.');
      sys(`❌ Equipe rejeitada (${S.rejects}/5). O mestre vai escolher outra.`);
      S.team = []; S.phase = 'team';
    }
    sync();
  },
  reveal(){
    if(S.phase !== 'missionDone') return;
    const cards = shuffle(Object.values(S.mission));      // embaralha: ninguém sabe quem sabotou
    const fails = cards.filter(c => c === 'F').length;
    const m = S.missions[S.round];
    const failed = fails >= (m.two ? 2 : 1);
    m.result = failed ? 'F' : 'S'; m.fails = fails;
    S.missionReveal = {round:S.round, cards, fails, failed};
    S.phase = 'missionResult';
    sys(failed ? `💥 Missão ${S.round+1} SABOTADA (${sabs(fails)}).`
               : `🏆 Missão ${S.round+1} concluída com sucesso${fails ? ` (mesmo com ${sabs(fails)})` : ''}.`);
    const ok = S.missions.filter(x => x.result === 'S').length, bad = S.missions.filter(x => x.result === 'F').length;
    if(ok >= 3) return endGame('R', 'A resistência completou 3 missões.');
    if(bad >= 3) return endGame('S', 'Os espiões sabotaram 3 missões.');
    sync();
  },
  next(){
    if(S.phase !== 'missionResult') return;
    S.round++; S.team = []; S.mission = {}; S.missionReveal = null; S.voteReveal = null; S.phase = 'team';
    sync();
  },
  again(){
    Object.assign(S, {phase:'lobby', roles:{}, missions:[], team:[], winner:null, winReason:'',
      voteReveal:null, missionReveal:null, alliances:[], allyReqs:[], votes:{}, mission:{}, rejects:0, round:0});
    sys('🔁 Nova partida. Aguardando o mestre iniciar.');
    sync();
  },
  kick(pid){
    if(S.phase !== 'lobby') return;
    const p = byPid(pid); if(!p) return;
    S.players = S.players.filter(q => q.cid !== p.cid);
    const k = keyOf[p.cid];
    if(k){ SEND(k, {t:'kicked'}); delete cidOf[k]; delete keyOf[p.cid]; }
    sync();
  },
  votetoggle(){ S.voteOn = !S.voteOn; sync(); },
  // história: só pode ser escrita/alterada antes da partida começar
  setLore(l){ if(S.phase !== 'lobby') return; S.lore = cleanLore(l); sync(); },
  clearLore(){ if(S.phase !== 'lobby') return; S.lore = blankLore(); sync(); },
};

/* ---------- API ---------- */
root.Game = {
  TABLE, TPL, KIND_LABEL, MAX_PLAYERS, LORE_PRESETS, LORE_MAX, blankLore, cleanLore,
  init(o){ SEND = o.send || SEND; CHANGED = o.onChange || CHANGED; },
  create(code){ S = blank(code); save(); return S; },
  load(saved){
    if(!isObj(saved) || typeof saved.code !== 'string') return null;
    S = Object.assign(blank(saved.code), saved);
    // partidas salvas antes dos identificadores públicos ganham um pid agora
    S.players.forEach(p => { if(!p.pid) p.pid = rid(8); });
    S.lore = cleanLore(S.lore);
    return S;
  },
  loadSaved(){ try{ return JSON.parse(localStorage.getItem('rivalis-host') || 'null'); }catch(e){ return null; } },
  discard(){ try{ localStorage.removeItem('rivalis-host'); }catch(e){} S = null; },
  input, dropConn, act, hostView, sync, save,
  get code(){ return S ? S.code : ''; },
  get phase(){ return S ? S.phase : ''; },
  get started(){ return !!S; },
  get playerCount(){ return S ? S.players.length : 0; },
  get teamSize(){ return S && S.missions[S.round] ? S.missions[S.round].size : 0; },
  get teamPicked(){ return S ? S.team.length : 0; },
  get lore(){ return S ? S.lore : blankLore(); },
  // usado só pelos testes automatizados
  _debug(){ return S; },
};

})(typeof window !== 'undefined' ? window : globalThis);
