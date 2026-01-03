# Free Poker - Planning Poker P2P & Serverless 🃏

Uma aplicação de **Planning Poker** moderna, focada em privacidade e simplicidade. Construída com **Angular** e **PeerJS**, esta ferramenta opera em uma arquitetura **100% Serverless** e **Peer-to-Peer (P2P)**.

Isso significa que **não há servidor backend** e **nenhum banco de dados**. Toda a comunicação acontece diretamente entre os navegadores dos participantes, e o estado da sessão reside apenas na memória do dispositivo do "Host".

![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![PeerJS](https://img.shields.io/badge/PeerJS-WebRTC-blue?style=for-the-badge)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## 🚀 Funcionalidades

-   **100% Descentralizado:** Sem servidores intermediários armazenando seus dados.
-   **Criação de Salas Instantânea:** Gere um link e compartilhe.
-   **Sistemas de Votação Flexíveis:**
    -   Sequência de Fibonacci (0, 1, 2, 3, 5, 8...)
    -   Tamanhos de Camiseta (XS, S, M, L, XL)
    -   **Customizado:** Defina suas próprias opções de voto.
-   **Votação em Tempo Real:** Veja quem já votou instantaneamente.
-   **Controle do Host:** Apenas o criador da sala pode revelar as cartas e reiniciar a rodada.
-   **Design Responsivo:** Funciona bem em desktop e mobile.

## 🛠️ Tecnologias Utilizadas

-   **[Angular](https://angular.io/)** (v19+): Utilizando as práticas mais modernas como **Standalone Components** e **Signals** para gerenciamento de estado reativo.
-   **[PeerJS](https://peerjs.com/)**: Abstração sobre WebRTC para facilitar a conexão direta de dados entre navegadores.
-   **[Tailwind CSS](https://tailwindcss.com/)**: Para estilização rápida e moderna.

## ⚙️ Como Funciona a Arquitetura P2P

1.  **O Host:** Quando um usuário cria uma sessão, o navegador dele gera um `Peer ID` único e assume o papel de "Servidor" da sala.
2.  **Os Participantes:** Ao acessarem o link compartilhado (que contém o ID do Host), os navegadores dos participantes estabelecem uma conexão direta (`DataConnection`) com o navegador do Host.
3.  **Sincronização:** O Host mantém a "Verdade Única" (Single Source of Truth) do estado do jogo (votos, participantes, status) e transmite atualizações para todos os conectados sempre que algo muda.

## 📦 Como Rodar o Projeto

Pré-requisitos: Node.js instalado.

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/free-poker.git
    cd free-poker
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Inicie o servidor de desenvolvimento:**
    ```bash
    ng serve
    ```

4.  **Acesse:**
    Abra o navegador em `http://localhost:4200`.

## 📖 Guia de Uso

### Para o Host (Scrum Master)
1.  Na tela inicial, digite seu nome.
2.  Escolha o sistema de votação desejado (Fibonacci, T-Shirt ou Custom).
3.  Clique em "Criar Nova Sessão".
4.  Na sala, clique em "Copiar Link da Sala" e envie para seu time.
5.  Quando todos votarem, clique em "Revelar Cartas".
6.  Para começar uma nova história, clique em "Nova Rodada".

### Para os Participantes
1.  Abra o link enviado pelo Host.
2.  Digite seu nome e clique em "Entrar".
3.  Selecione a carta que representa seu voto.
4.  Aguarde o Host revelar os resultados.
---

Desenvolvido com ❤️ usando Angular.
