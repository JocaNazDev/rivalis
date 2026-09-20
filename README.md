# Rivalis

**Confie. Acuse. Traia.**

Rivalis é um jogo de dedução social para jogar pelo celular, reunido com os amigos. A maioria é da **Resistência** e precisa cumprir missões. Entre eles estão **espiões infiltrados**, que tentam sabotar tudo sem serem descobertos. Ninguém sabe em quem confiar. Na conversa com frases prontas, os jogadores acusam, defendem e fazem alianças que podem ser quebradas na hora da votação.

Inspirado em *The Resistance*, jogado no navegador. Um aparelho é o **mestre** e cada jogador entra pelo **próprio celular**. As escolhas vão para o mestre, e o resultado volta para todos em tempo real.

Não tem servidor próprio, instalação ou build. São três arquivos:

| Arquivo | O que é |
|---|---|
| `index.html` | Só a casca: carrega os outros arquivos |
| `estilo.css` | Visual |
| `ui.js` | Desenha as telas e envia as ações. Nenhuma regra e nenhum segredo |
| `rivalis-core.js` | **As regras e os segredos.** Roda só no aparelho do mestre |
| `rivalis-net.js` | Transporte (conexão entre aparelhos) |
| `avatar.js` | Gerador dos rostos em SVG |
| `cena.js` | Gerador das cenas das missões em SVG |
| `vendor.js` | PeerJS e qrcode-generator embutidos |
| `avatar.html` | Editor de personagem avulso, para testar as peças |
| `cena.html` | Banco de cenas avulso, para testar os cenários |

Todos precisam estar **na mesma pasta**.

---

## Como jogar

- Cada jogador recebe um **papel secreto**:
  - **Resistência** é a maioria e quer que as missões deem certo.
  - **Espião** é a minoria. Os espiões sabem quem são os outros espiões.
- A partida tem até **5 missões**. Em cada uma:
  1. O **mestre escolhe a equipe** da missão.
  2. Todos **votam** para aprovar ou rejeitar a equipe. Se forem **5 rejeições seguidas**, os espiões vencem.
  3. Quem está na equipe joga em segredo **Sucesso** ou **Sabotar**. Só espiões podem sabotar.
  4. O mestre **revela** as cartas embaralhadas. Uma sabotagem basta para a missão falhar. Com 7 ou mais jogadores, a 4ª missão só falha com 2 sabotagens.
- Vence quem chegar primeiro a **3 missões**.

### História da sala (lore)

Cada sala pode ter a sua própria aventura, escrita pelo mestre antes da partida começar, em **📖 História**:

| Campo | Quando os jogadores veem |
|---|---|
| Título e **a história** (o mundo, quem são vocês, que há um infiltrado) | assim que entram na sala |
| **O chamado** (o objetivo geral) | assim que entram na sala |
| **Introdução de cada uma das 5 missões** | só quando aquela missão começa |
| Final de vitória e final de derrota | na revelação, conforme quem ganhou |

Cada missão pode ter também uma **cena ilustrada**, e a história pode ter uma **cena de abertura**. Tudo é desenhado em SVG pelo `cena.js`, sem imagens e sem internet:

- **8 cenários:** gruta, cela, taverna, salão do trono, floresta, nave/estação, dentro do carro e beco da cidade
- **4 horas:** dia, entardecer, noite, penumbra
- **4 climas:** limpo, chuva, neve, névoa
- **6 elementos:** fogueira, tochas, silhuetas, barris, caixotes, luz de alerta

No editor, cada missão tem o botão **🎬 Escolher cena**, com um **Sugerir pelo texto** que lê a introdução que você escreveu e adivinha o cenário pelas palavras ("gruta", "à noite", "com tochas"). Se não reconhecer nada, ele avisa em vez de chutar calado. **Outra variação** muda a posição das pedras, das janelas acesas e da chuva sem trocar o cenário. A cena vira um código curto (`gruta.noite.limpo.tochas~4812`), que é o que trafega entre os aparelhos.

As introduções das missões seguintes **não são enviadas** para o celular de ninguém antes da hora, então não dá para espiar o que vem pela frente. A história só pode ser escrita ou alterada no lobby; depois que a partida começa, fica travada, e jogador nenhum consegue mexer nela.

Há três aventuras prontas para usar em um toque (**A Gruta dos Goblins**, **Estação Kessler** e **A Corte de Inverno**), que servem também de modelo para escrever a sua. Deixar tudo em branco também funciona: o jogo roda sem história nenhuma.

### Personagem

Antes de entrar na sala, cada jogador monta o próprio personagem: **rosto, pele, cabelo, cor do cabelo, olhos, cor dos olhos, sobrancelhas, boca e cicatriz** (incluindo tapa-olho). Dá para sortear ou escolher peça por peça, e ainda dá para trocar no lobby, antes da partida começar.

O rosto aparece na lista do mestre, no lobby, na equipe da missão, na conversa e na revelação final. O personagem fica salvo no aparelho e vira um código curto de texto (`3-2-4-3-1-0-4-2-5`), que é o que trafega entre os aparelhos.

`avatar.html` é o mesmo editor em página separada, útil para criar peças novas sem abrir o jogo.

### Conversa com textos prontos

Na aba **Conversa**, cada jogador escolhe uma categoria e toca numa frase:

| Categoria | Para que serve |
|---|---|
| **Acusar** | Levantar suspeita sobre um jogador |
| **Defender** | Dizer que confia em alguém |
| **Aliança** | Propor aliança a outro jogador, que pode aceitar ou recusar |
| **Falar** | Frases gerais ("Rejeitem essa equipe!", "Confiem em mim." etc.) |

### Alianças

- Cada jogador pode ter **um aliado** por vez, e todos na mesa sabem quem é aliado de quem.
- Na votação, quem tem aliado pode escolher **"Seguir meu aliado"**, e o voto copia o do aliado.
- Se dois aliados votarem diferente, **todos veem o aviso** de aliança quebrada.
- Qualquer um dos dois pode **romper** a aliança a qualquer momento.

### Composição por número de jogadores

| Jogadores | Espiões | Tamanho das equipes (missões 1 a 5) |
|---|---|---|
| 3 *(teste)* | 1 | 1 · 2 · 2 · 2 · 2 |
| 4 *(teste)* | 1 | 2 · 2 · 2 · 3 · 3 |
| 5 | 2 | 2 · 3 · 2 · 3 · 3 |
| 6 | 2 | 2 · 3 · 4 · 3 · 4 |
| 7 | 3 | 2 · 3 · 3 · 4\* · 4 |
| 8 | 3 | 3 · 4 · 4 · 5\* · 5 |
| 9 | 3 | 3 · 4 · 4 · 5\* · 5 |
| 10 | 4 | 3 · 4 · 4 · 5\* · 5 |

\* A missão só falha com 2 sabotagens.

---

## Como rodar

### 1. Hospedar o arquivo

Para funcionar nos celulares, o `index.html` precisa estar num **link público** e ser aberto no **Safari ou no Chrome**. Qualquer hospedagem estática serve.

**Netlify Drop** (o jeito mais rápido):
1. Coloque todos os arquivos do jogo numa pasta.
2. Acesse <https://app.netlify.com/drop> e arraste a pasta para a página.
3. Com uma conta grátis, o link fica permanente.

**GitHub Pages:**
1. Crie um repositório e envie **todos os arquivos** (`index.html`, `estilo.css`, `ui.js`, `rivalis-core.js`, `rivalis-net.js`, `avatar.js`, `vendor.js`, `avatar.html`) na mesma pasta.
2. Vá em **Settings → Pages** e, em **Source**, escolha a branch `main` com a pasta `/ (root)`.
3. O jogo fica disponível em `https://<seu-usuario>.github.io/<repositorio>/`.

> ⚠️ Abrir o arquivo dentro de uma pré-visualização (o visualizador de arquivos do app do Claude, anexos de e-mail, apps de mensagem) **não funciona**, porque esses ambientes bloqueiam a conexão entre os aparelhos.

### 2. Começar uma partida

1. No aparelho do **mestre** (celular, tablet ou um PC ligado na TV), abra o link e toque em **Criar sala**.
2. Aparecem um **código de 4 letras** e um **QR code**.
3. Os **jogadores** escaneiam o QR code ou abrem o link, digitam o código e o nome.
4. Com todos na sala, o mestre toca em **Iniciar partida**.

No lobby, o mestre pode desligar a **Votação da equipe**. Nesse modo, a equipe escolhida vai direto para a missão.

### Testar sozinho no PC

Adicione `?local=1` ao final do endereço (por exemplo `http://localhost:8000/index.html?local=1`). Nesse modo:
- a primeira aba é o mestre;
- cada nova aba do **mesmo navegador** é um jogador;
- as abas se comunicam entre si, sem precisar de internet.

Para servir o arquivo localmente:

```bash
python3 -m http.server 8000
```

---

## Como funciona por dentro

- **Conexão:** usa [PeerJS](https://peerjs.com/) (WebRTC). Os celulares se conectam direto ao aparelho do mestre. O servidor público gratuito do PeerJS só é usado para os aparelhos se encontrarem, e os dados do jogo não passam por ele.
- **Autoridade:** o **mestre é o servidor** (`rivalis-core.js`). Ele guarda o estado, sorteia os papéis, valida as ações e monta a visão de cada jogador em `pub()` e `viewFor()` — é ali que se decide o que pode sair. Veja a seção **Segurança**.
- **Reconexão:** se um jogador cair, recarregar ou trocar de aparelho, volta para o mesmo lugar. Para isso ele entra com o mesmo nome. O mestre também pode recarregar a página, porque o estado fica salvo no `localStorage` dele.
- **Personagem:** `avatar.js` desenha tudo em SVG, sem imagens. `Avatar.svg(cfg)` devolve o rosto, `Avatar.code(cfg)` vira texto e `Avatar.fromString(nome)` dá um rosto fixo a partir do nome. Se o arquivo faltar, o jogo roda igual, só sem os rostos.
- **Bibliotecas embutidas:** PeerJS 1.5.4 e qrcode-generator 1.4.4 (ambas com licença MIT) estão dentro do HTML, então o jogo não depende de CDN.

### Onde mexer no código

| O que mudar | Onde |
|---|---|
| Frases prontas da conversa | `rivalis-core.js`: constante `TPL` (`accuse`, `defend`, `say`). Use `{X}` para o nome do jogador escolhido |
| Espiões e tamanho das equipes | `rivalis-core.js`: constante `TABLE` |
| Regra das 2 sabotagens | `rivalis-core.js`: função `needsTwo` |
| Regras de votação e missão | `rivalis-core.js`: `input`, `resolveVote` e `act` |
| Aventuras prontas | `rivalis-core.js`: constante `LORE_PRESETS` |
| Tamanho máximo dos textos da história | `rivalis-core.js`: constante `LORE_MAX` |
| Telas | `ui.js`: `renderStart`, `renderHost` e `renderPlayer` |
| Cores e visual | `estilo.css`: variáveis em `:root` |
| Cenários, horas, climas e elementos | `cena.js`: objeto `SCENES` (um cenário novo é um item novo, e já aparece no editor), mais `TIME`, `WEATHER` e `PROPS` |
| Palavras que o gerador de cenas reconhece | `cena.js`: `words` de cada cenário, e as listas `TIME_WORDS`, `WEATHER_WORDS` e `PROP_WORDS` |
| Peças do personagem | `avatar.js`: listas `FACE`, `HAIR`, `EYES`, `BROWS`, `MOUTH`, `SCAR` e as paletas `SKIN`, `HAIRC`, `EYEC`. Uma peça nova entra na lista e já aparece no editor |

## Segurança

Primeiro o que **não** protege: separar o código em arquivos. Tudo que o navegador baixa fica visível e editável no aparelho de quem está jogando. Não existe segredo escondido no código do cliente, em jogo nenhum feito assim.

O que protege de verdade é o desenho abaixo.

**1. O segredo nunca sai do mestre.** O papel de cada jogador, o voto antes da revelação e a carta que cada um jogou na missão ficam só no `rivalis-core.js`, no aparelho do mestre. O celular de um jogador recebe apenas a visão dele: os outros aparecem com `pid`, `name`, `av` e se estão online. Nem abrindo o console dá para ler o que não foi enviado.

**2. Dois identificadores por jogador.**

| | Quem conhece | Para que serve |
|---|---|---|
| `cid` | só o mestre e o dono | é a senha da vaga: prova quem é você ao reconectar |
| `pid` | todo mundo | é o que aparece nas telas e nas mensagens |

Antes disso o `cid` ia junto no estado público, e qualquer jogador podia se reconectar como outro e receber o papel secreto dele. Era uma falha real de sequestro de identidade, corrigida aqui.

**3. O mestre desconfia de tudo.** Toda mensagem recebida passa por conferência de tipo, formato, tamanho e faixa de valores; o que não bate é descartado em silêncio. Exemplos do que não adianta tentar:
- mandar `mission: F` sendo da resistência (o mestre grava sucesso do mesmo jeito);
- votar duas vezes, votar fora da fase de votação ou votar por outro jogador;
- escrever qualquer texto na conversa (só entram frases da lista, pelo número);
- inundar a sala com mensagens (limite de 25 a cada 5 segundos, e 1 fala por 1,2 segundo).

**4. O que continua possível, por natureza do jogo:** o **mestre** vê tudo, porque o aparelho dele é o servidor. Escolha alguém de fora da partida ou aceite que o mestre é de confiança. E qualquer jogador pode combinar coisas por fora do jogo, olhar a tela do vizinho ou mentir: isso é o jogo.

### Limitações conhecidas

- Redes muito restritas (Wi-Fi corporativo ou de escola) podem bloquear o WebRTC. Com os celulares nos dados móveis, o jogo costuma funcionar.
- Se o celular do **mestre** bloquear a tela ou fechar o navegador, os jogadores perdem a conexão até ele voltar. De preferência, o mestre deixa a tela ligada.
- Máximo de 10 jogadores por sala.
- A história é escrita à mão pelo mestre, antes da partida. Não existe geração automática de texto no jogo.
- As cenas são desenhadas à mão no `cena.js`: o gerador só monta o que já existe ali. Um texto que não bate com nenhum cenário não inventa um novo, apenas avisa.

---

## Ideias para próximas versões

- Papéis especiais (Comandante que conhece os espiões, Assassino, Espião oculto)
- Líder rotativo entre os jogadores, como no jogo original
- Histórico de votações por rodada
- Temas visuais alternativos (tripulação × impostores, vila × infiltrados)
