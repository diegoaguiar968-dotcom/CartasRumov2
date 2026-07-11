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

## 2. 🟡 .docx "bagunçado" no Word Online (cabeçalho/rodapé)

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

## Concluídas (referência rápida)

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
