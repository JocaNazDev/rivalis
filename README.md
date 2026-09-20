# Resistência

Jogo de dedução social no estilo *The Resistance*, jogado no navegador. Um aparelho é o **mestre** e cada jogador entra pelo **próprio celular**. As escolhas vão para o mestre, e o resultado volta para todos em tempo real.

Tudo fica em um único arquivo, o `index.html`. Não tem servidor próprio, instalação ou build.

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
1. Coloque o `index.html` numa pasta.
2. Acesse <https://app.netlify.com/drop> e arraste a pasta para a página.
3. Com uma conta grátis, o link fica permanente.

**GitHub Pages:**
1. Crie um repositório e envie o `index.html` e este `README.md`.
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
- **Autoridade:** o **mestre é o servidor**. Ele guarda o estado, sorteia os papéis, valida as ações e manda a cada jogador só o que ele pode ver. Os papéis dos outros, por exemplo, nunca chegam ao celular de ninguém antes do fim.
- **Reconexão:** se um jogador cair, recarregar ou trocar de aparelho, volta para o mesmo lugar. Para isso ele entra com o mesmo nome. O mestre também pode recarregar a página, porque o estado fica salvo no `localStorage` dele.
- **Bibliotecas embutidas:** PeerJS 1.5.4 e qrcode-generator 1.4.4 (ambas com licença MIT) estão dentro do HTML, então o jogo não depende de CDN.

### Onde mexer no código

Tudo fica no `<script>` principal do `index.html`:

| O que mudar | Onde |
|---|---|
| Frases prontas da conversa | constante `TPL` (`accuse`, `defend`, `say`). Use `{X}` para o nome do jogador escolhido |
| Espiões e tamanho das equipes | constante `TABLE` |
| Regra das 2 sabotagens | função `needsTwo` |
| Regras de votação e missão | `hostOnMsg`, `resolveVote` e `hostAct` |
| Telas | `renderStart`, `renderHost` e `renderPlayer` |
| Cores e visual | variáveis CSS em `:root` |

### Limitações conhecidas

- Redes muito restritas (Wi-Fi corporativo ou de escola) podem bloquear o WebRTC. Com os celulares nos dados móveis, o jogo costuma funcionar.
- Se o celular do **mestre** bloquear a tela ou fechar o navegador, os jogadores perdem a conexão até ele voltar. De preferência, o mestre deixa a tela ligada.
- Máximo de 10 jogadores por sala.

---

## Ideias para próximas versões

- Papéis especiais (Comandante que conhece os espiões, Assassino, Espião oculto)
- Líder rotativo entre os jogadores, como no jogo original
- Histórico de votações por rodada
- Temas visuais alternativos (tripulação × impostores, vila × infiltrados)
