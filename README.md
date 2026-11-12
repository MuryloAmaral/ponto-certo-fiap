# Ponto Certo

Global Solution 2026.2 - Application Development.

Murylo Silva Amaral - RM 568241  
Igor Mota Marran - RM 567823  
Dante Daher Garçon - RM 567727

## Objetivo

O Ponto Certo ajuda quem usa ônibus em São Paulo a consultar linhas, pontos e previsões de chegada. O usuário pode buscar por rua ou linha, abrir um ponto, filtrar veículos acessíveis e salvar os pontos que usa com frequência. A atualização automática acontece a cada 30 segundos enquanto a página está visível, há conexão e a opção está marcada.

Os dados vêm da API Olho Vivo da SPTrans. Nem todos os pontos da cidade estão disponíveis nos endpoints de paradas; uma busca sem resultado não significa que não há transporte no local. Os horários são estimativas da operação e podem mudar. Não são calculadas rotas, distâncias por GPS ou garantias de embarque.

## Tecnologias

- HTML, CSS e JavaScript no navegador, sem framework.
- Node.js no servidor e na função do Vercel.
- API Olho Vivo v2.1 por HTTPS.
- `localStorage` para favoritos e preferência de contraste.
- Testes com o executor nativo do Node.js, sem dependências de instalação.

As funções de arrays, formulários, validação, persistência, `fetch` e tratamento de erros seguem os conteúdos das aulas. A chamada à SPTrans fica no servidor para manter o token protegido e preservar o cookie de sessão entre as consultas. A interface recebe apenas os dados necessários para apresentar o resultado.

## Execução local

1. Instale Node.js 24 LTS.
2. Crie uma conta na área de desenvolvedores da SPTrans e cadastre um aplicativo: https://www.sptrans.com.br/desenvolvedores/.
3. Copie `.env.example` para `.env` e preencha `SPTRANS_TOKEN` com o token liberado para o aplicativo.
4. Abra um terminal nesta pasta e execute `npm start`.
5. Abra o endereço informado no terminal, normalmente http://localhost:3000.

Não é necessário executar `npm install`, pois o projeto não usa pacotes externos. Não abra `public/index.html` com duplo clique: as consultas dependem do servidor.

Sem token, a interface abre e informa que o serviço ainda não foi configurado. Ela não apresenta dados fictícios como previsões reais. O arquivo `.env` é ignorado pelo Git e não deve ser compartilhado.

## Publicação no Vercel

1. Envie o conteúdo desta pasta para um repositório no GitHub.
2. No Vercel, importe o repositório. Escolha o preset `Other`.
3. Mantenha a raiz do projeto nesta pasta. Se enviar os três trabalhos em um único repositório, configure `Root Directory` como `02_Application_Development` (ou o caminho correspondente dentro do repositório).
4. Use o diretório de saída `public`, já definido em `vercel.json`. Não é necessário comando de build.
5. Adicione a variável de ambiente `SPTRANS_TOKEN` com o token real, pelo menos no ambiente Production.
6. Publique. Se mudar a variável depois de publicar, faça um novo deploy para aplicá-la.
7. Abra o endereço gerado, faça uma busca e consulte um ponto. Confira pelo celular e em uma janela anônima.

O deploy usa uma função Node.js em `api/sptrans.js`. Hospedar apenas os arquivos estáticos no GitHub Pages não executa essa função.

## Organização

| Arquivo/pasta | Responsabilidade |
|---|---|
| `public/index.html` | Estrutura e conteúdo da interface |
| `public/style.css` | Layout responsivo e contraste |
| `public/app.js` | Eventos, busca, favoritos, filtro e atualização |
| `public/domain.js` | Cálculo de espera, ordenação e validação de favoritos |
| `api/sptrans.js` | Endpoint usado pelo navegador e validação dos parâmetros |
| `lib/sptrans-client.js` | Autenticação e consulta à SPTrans |
| `server.mjs` | Servidor de desenvolvimento local |
| `tests/` | Testes de lógica, contrato e servidor separado de teste visual |

## Endpoints utilizados

| Ação | Endpoint Olho Vivo |
|---|---|
| Autenticar | `POST /Login/Autenticar?token=...` |
| Buscar linhas | `GET /Linha/Buscar?termosBusca=...` |
| Buscar paradas | `GET /Parada/Buscar?termosBusca=...` |
| Pontos de uma linha | `GET /Parada/BuscarParadasPorLinha?codigoLinha=...` |
| Previsões de um ponto | `GET /Previsao/Parada?codigoParada=...` |

O servidor aceita apenas esses recursos. Não recebe URLs livres do navegador. Em caso de sessão expirada (401/403), autentica novamente e repete a consulta uma vez. Erros de rede, limite de consultas, respostas inválidas e token não configurado têm mensagens próprias. Cookies e token não são devolvidos ao navegador.

Os minutos de espera são a diferença entre o horário previsto e a referência `hr` da resposta. A conta trata a passagem de 23h para 0h. Horários anteriores ou formatos não reconhecidos são exibidos sem inventar uma contagem. O nome da linha e os campos recebidos são escapados antes de entrar no HTML.

## Testes

```sh
npm run check
npm test
```

O primeiro comando verifica a sintaxe. O segundo executa 12 casos de teste, incluindo autenticação, renovação de sessão, chamadas simultâneas, erros HTTP, parâmetros inválidos, horário na virada do dia, favoritos corrompidos e proteção de texto externo.

Para testar a interface separadamente da SPTrans:

```sh
node tests/browser-server.mjs --port 4173
```

Esse comando mostra um aviso de dados fictícios e usa exemplos de teste. Ele não é executado por `npm start` nem pelo Vercel. Use `Paulista` para um resultado, `vazio` para nenhum resultado e `erro` para falha simulada. O caminho `/responsive?width=360` permite conferir o layout em um quadro de 360 pixels. Também aceita 390, 768 e 1280. Não use esse servidor na publicação da GS.

O teste local com fixtures verifica a interface e o tratamento das respostas. Ele não comprova acesso real à SPTrans. A validação final precisa ser feita depois de configurar um token válido e publicar no Vercel.

## Checklist de validação após publicar

- Buscar um ponto coberto pela API e conferir as chegadas.
- Buscar uma linha e abrir os pontos disponíveis no sentido escolhido.
- Salvar e remover favoritos; recarregar e confirmar a persistência.
- Filtrar acessíveis e atualizar manualmente.
- Verificar a atualização automática com a página aberta.
- Abrir em celular, testar alto contraste e navegar por teclado.
- Abrir em janela anônima para confirmar que o professor consegue acessar.
- Entregar o link do GitHub e o link da publicação, junto ao arquivo `participantes.txt` no repositório.

## Referências

- Aulas de Application Development fornecidas pela disciplina, especialmente aulas 3, 7, 8, 10 e 11.
- SPTrans: https://www.sptrans.com.br/desenvolvedores/api-do-olho-vivo-guia-de-referencia/documentacao-api.
- Vercel, runtime Node.js: https://vercel.com/docs/functions/runtimes/node-js.
- Vercel, variáveis de ambiente: https://vercel.com/docs/environment-variables.
