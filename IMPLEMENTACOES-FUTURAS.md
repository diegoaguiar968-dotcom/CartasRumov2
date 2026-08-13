# ARCA — Implementações Futuras (backlog)

Registro de ideias e pendências que ficaram **em stand-by**, com contexto
suficiente para retomar sem depender do histórico de conversas. Ao concluir um
item, mova-o para a seção "Concluídas" no fim do arquivo (com o commit).

> Convenção de status: 🟡 stand-by (decidido adiar) · 🔵 a decidir · 🟢 em andamento

---

## 1. 🟡 Anexos adicionais no item do SharePoint (ex.: recibo de protocolo)

**O que é:** permitir guardar mais de um anexo por carta no item do SharePoint —
além do `.docx` da carta, por exemplo o **recibo de protocolo em PDF** gerado
após protocolar no SEI.

**Situação:** possível — o item do SharePoint **aceita vários anexos
nativamente**. Ficou adiado por decisão do usuário (2026-07).

**Opções de implementação (escolher ao retomar):**
- **A) Manual no SharePoint (recomendada, custo zero):** como o recibo só existe
  *depois* de protocolar, abrir o item na lista e anexar o PDF ali. Convive bem
  com o anexo do `.docx` (Etapa E do fluxo). Nenhuma alteração no ARCA.
- **B) Upload pelo ARCA:** criar um botão "anexar arquivo" na carta do histórico
  que envia o PDF ao item. Exige: endpoint no backend para receber o arquivo +
  ação no fluxo (ou Graph) para anexar; depende do webhook 100% no ar.
- **C) Fluxo dedicado:** um Power Automate separado que pega PDFs de uma pasta/
  e-mail e anexa ao item correspondente pelo número da carta.

**Pontos de código / referência:**
- Anexo do `.docx` já implementado no payload: `backend/controllers/sharepointController.js`
  (campos `docxBase64` / `docxNome`).
- Etapa E ("Adicionar anexo") documentada em `backend/data/GUIA-SHAREPOINT.md`.

**Próximo passo ao retomar:** decidir entre A/B/C. Se B, definir limite de
tamanho e tipos aceitos (PDF) e como o backend repassa ao fluxo.

---

## 2. 🟡 .docx no Word Online — cabeçalho/rodapé flutuantes (pendência restante)

> As melhorias de **conteúdo/formatação** (saudação, títulos, negrito da empresa,
> assinatura uma malha por linha, endereço) já foram feitas (commit `c47e62d`).
> **O que ainda falta é só o cabeçalho/rodapé** para o Word Online.

**O que é:** a carta gerada abre **perfeita no Word desktop**, mas no **Word
Online** o **logo do cabeçalho some** (aparece um círculo apagado) e a **faixa do
rodapé desaparece**.

**Causa raiz (já investigada, 2026-07):** no template `3-modelo-anexos.docx`, o
cabeçalho e o rodapé usam **elementos flutuantes (âncora)**, que o Word Online
renderiza mal:
- `word/header1.xml`: logo como **imagem flutuante** (`wp:anchor`) + fallback VML
  (`w:pict`) — **0 imagens inline**.
- `word/footer1.xml`: a faixa do rodapé é uma **forma flutuante** (shape via
  `wp:anchor` + `w:pict`, sem imagem embutida).

Não é fonte (só usa Times New Roman / Segoe UI / Georgia, todas no Online) nem o
conteúdo injetado pelo docxtemplater (que só mexe em `word/document.xml`). É o
**posicionamento flutuante** em header/footer.

**Correção proposta (ao retomar):**
- **Logo do cabeçalho:** trocar de flutuante para **"Alinhado com o texto"
  (inline)**, num parágrafo alinhado à direita.
- **Faixa do rodapé:** trocar a forma por uma **tabela de 1 célula com
  preenchimento de cor** (o Word Online renderiza sombreamento de tabela bem),
  com o texto do endereço dentro.

**Dois caminhos:**
- **A) Refazer no Word (mais confiável):** equipe reabre o template no Word
  desktop, aplica as trocas acima, salva e substitui `backend/templates/3-modelo-anexos.docx`.
- **B) Editar o XML do .docx:** converter `header1.xml`/`footer1.xml` para inline
  + tabela sombreada e reempacotar. Requer validação no Word Online (1-2 rodadas).

**Pontos de código / referência:**
- Template: `backend/templates/3-modelo-anexos.docx` (arquivos internos
  `word/header1.xml`, `word/footer1.xml`).
- Geração: `backend/controllers/exportController.js` (docxtemplater, só toca
  `word/document.xml` — o header/footer vem do template intacto).

**Workaround atual:** abrir no **Word desktop** (renderiza correto). No Online,
usar **"Editar no navegador"** em vez da pré-visualização ajuda em alguns casos,
mas não resolve o header/footer flutuante.

---

## 3. 🔵 Login real via conta Microsoft do Grupo Rumo (Entra ID / SSO)

**O que é:** substituir a tela de identificação atual (que só coleta nome/e-mail/
área, sem senha) por um **login de verdade** com a conta Microsoft corporativa
(Entra ID, ex-Azure AD). O usuário clica em "Entrar com Microsoft", autentica no
tenant do Grupo Rumo e o ARCA passa a confiar nesses dados.

**Ganhos:**
- Nome e e-mail vêm **automáticos** do login (sem digitar, sem erro de digitação).
- Acesso **restrito** a contas @rumolog (ou a um grupo de segurança específico) —
  hoje qualquer pessoa com o link acessa preenchendo os campos.
- Base para, no futuro, ter permissões por perfil.

**Pré-requisito (bloqueador, não é código) — depende do TI/Azure de vocês:**
- **Registro de aplicativo no Entra ID** do tenant do Grupo Rumo, que gera
  `Client ID` e `Tenant ID` e define as **Redirect URIs** (a URL do frontend no
  Render). Sem isso, nada do resto funciona. Quem tem admin do Entra precisa
  criar (ou autorizar a criação) desse app registration.

**Como implementar (quando o app registration existir):**
- **Frontend:** biblioteca **MSAL.js** (`@azure/msal-browser`) — login por
  popup/redirect; ao autenticar, recebe o token com `name`/`email` (claims).
  A `LoginGate` atual vira o botão "Entrar com Microsoft"; o widget do canto
  continua mostrando o nome.
- **Backend:** validar o **JWT** em cada `/api/*` (assinatura via JWKS do tenant,
  `audience`, `issuer`, `tenant`), extraindo identidade dos claims. Hoje a
  identidade vem de headers/localStorage; passaria a vir do token verificado.
- **Restrição de acesso:** limitar ao tenant do Grupo Rumo e, se quiserem, a um
  **grupo de segurança** específico.

**Decisões a tomar ao retomar:**
1. Restringir ao **tenant inteiro** (qualquer conta Rumo) ou a um **grupo**?
2. **Área:** manter a seleção manual (as opções do SharePoint) ou tentar puxar do
   claim `department` do Entra? (Recomendo manual — o department raramente casa
   com a lista de áreas do SharePoint.)
3. Como conviver com o modo atual: manter o login simples como *fallback* (ex.:
   ambiente sem SSO) ou exigir Microsoft sempre?

**Esforço estimado:** ~1–2 dias de desenvolvimento **após** o app registration
existir. O caminho crítico é o registro no Entra (coordenação com o TI).

**Pontos de código / referência:**
- Tela atual: `frontend/source/client/src/components/LoginGate.tsx` (vira o botão
  Microsoft) e `identify-widget.tsx` (armazenamento da identidade).
- Proteção da API: `backend/middleware/` (hoje `apiKeyMiddleware`; entraria a
  validação de JWT do Entra).

---

## Concluídas (referência rápida)

- ✅ Formatação do .docx: vírgula na saudação, títulos sem recuo + negrito, nome
  da empresa em negrito, assinatura uma malha por linha, endereço CEP+cidade na
  mesma linha (`c47e62d`).

- ✅ Histórico como etapa 5 e "Como usar" como etapa 6 (`49f31a6`).
- ✅ Filtros e ordenação do histórico (Órgão, Assunto, Forma, status SharePoint;
  ordenar por data/número/responsável/malha/assunto/tema; asc/desc) (`49f31a6`).
- ✅ Edição inline de todos os campos do histórico, salvando automático (`33139ab`).
- ✅ Registro no SharePoint via webhook (Power Automate) — item, Responsável
  (Pessoa), Malha múltipla, Data de Envio automática; guia completo em
  `backend/data/GUIA-SHAREPOINT.md`.
- ✅ Alternância Forms/Webhook por `SHAREPOINT_MODE` (`86cb186`).
- ✅ Upsert no fluxo (atualizar item existente em vez de duplicar) — documentado
  no guia, seção 6.1 (`ea8b939`).
- ✅ Assunto de resposta alinhado a "Resposta Ofício" (`6d87ff6`).
