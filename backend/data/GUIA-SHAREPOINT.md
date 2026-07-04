# Integração ARCA → SharePoint (Power Automate)

Este guia liga o botão **"Registrar no SharePoint"** do histórico do ARCA à sua
lista **Regulatório – Cartas e Ofícios**, criando o item automaticamente.

## Como funciona

```
ARCA (histórico) ──POST──▶ Backend ARCA ──POST(JSON)──▶ Webhook do Power Automate ──▶ Cria item na lista
```

O segredo do webhook fica **no servidor** (variável de ambiente no Render), nunca
no navegador.

---

## Passo 1 — Criar o fluxo no Power Automate

1. Em **make.powerautomate.com** → **Criar** → **Fluxo de nuvem instantâneo**.
2. Gatilho: **"Quando uma solicitação HTTP é recebida"** (conector premium).
3. No gatilho, cole este **Esquema JSON do corpo da solicitação**:

```json
{
  "type": "object",
  "properties": {
    "titulo": { "type": "string" },
    "tema": { "type": "string" },
    "orgao": { "type": "string" },
    "malha": { "type": "string" },
    "oficio": { "type": "string" },
    "processo": { "type": "string" },
    "formaEnvio": { "type": "string" },
    "assuntos": { "type": "string" },
    "responsavel": { "type": "string" },
    "responsavelEmail": { "type": "string" },
    "area": { "type": "string" },
    "docxNome": { "type": "string" },
    "docxBase64": { "type": "string" },
    "sharedSecret": { "type": "string" }
  }
}
```

## Passo 2 — (Recomendado) Validar o segredo

Adicione uma ação **Condição**: `sharedSecret` (do gatilho) **é igual a** o valor
que você definirá em `SHAREPOINT_WEBHOOK_SECRET`. Se falhar, use **Resposta** com
status 401 e encerre. Isso impede que qualquer um que descubra a URL crie itens.

## Passo 3 — Resolver o "Responsável" (campo Pessoa)

Antes de criar o item, adicione **Office 365 Users → Obter perfil do usuário (V2)**,
com **UPN/E-mail** = `responsavelEmail`. Guarde o resultado para o campo Pessoa.
(Se `responsavelEmail` vier vazio — cartas antigas — pule esta etapa e deixe o
campo Responsável em branco para preencher à mão.)

## Passo 4 — Criar o item

Ação **SharePoint → Criar item**:

| Coluna da lista | Valor (do gatilho) |
|---|---|
| Título | `titulo` |
| Responsável (Claims) | e-mail do perfil obtido no Passo 3 (`responsavelEmail`) |
| Área do Responsável | `area` |
| Tema | `tema` |
| Orgão | `orgao` |
| Malha | `malha` *(ver nota)* |
| Ofício | `oficio` |
| Forma de Envio | `formaEnvio` (SEI) |
| Número do Processo | `processo` |
| Assuntos | `assuntos` |

Deixe **em branco** (preenchidos após protocolar no SEI): Conferida?, Data de
Envio, Dilação?, Prazo com Dilação, Protocolo.

> **Nota Malha:** se a coluna Malha for de **escolha múltipla**, o valor precisa
> ser enviado como coleção. O ARCA manda a(s) sigla(s) em texto (ex.: `RMP` ou
> `RMP, RMS`). Use **Selecionar/Dividir** por vírgula para montar o array de
> escolhas, ou mapeie via **Switch** para os valores exatos da sua coluna.

## Passo 5 — (Opcional) Anexar o .docx

Se quiser o arquivo no item, após criar o item adicione **SharePoint → Adicionar
anexo**:
- **Id** = ID do item criado
- **Nome do arquivo** = `docxNome`
- **Conteúdo do arquivo** = `base64ToBinary(triggerBody()?['docxBase64'])`

## Passo 6 — Responder com a URL do item (opcional)

Ação **Resposta**: status **200**, corpo `{ "itemUrl": "<link do item>" }`. O ARCA
mostra essa URL na confirmação.

---

## Passo 7 — Conectar no ARCA (Render)

Copie a **URL HTTP POST** que o Power Automate gerou no gatilho e defina no Render
(serviço do backend → Environment):

| Variável | Valor |
|---|---|
| `SHAREPOINT_WEBHOOK_URL` | a URL do gatilho do fluxo |
| `SHAREPOINT_WEBHOOK_SECRET` | um segredo qualquer (o mesmo do Passo 2) |

Pronto. Enquanto `SHAREPOINT_WEBHOOK_URL` não estiver definida, o botão apenas
avisa que a integração não está configurada — nada quebra.

---

## Payload enviado pelo ARCA (referência)

```json
{
  "titulo": "0021/GREG/2026",
  "tema": "Encaminhamento de Documentos",
  "orgao": "ANTT",
  "malha": "RMP",
  "oficio": "OFÍCIO SEI Nº 41045/2025",
  "processo": "50505.064442/2025-38",
  "formaEnvio": "SEI",
  "assuntos": "Resposta Ofício",
  "responsavel": "Diego Bruno de Pinho",
  "responsavelEmail": "diego.pinho@rumo.com.br",
  "area": "Projetos - Regulatório",
  "docxNome": "0021 - GREG - 2026 - Encaminhamento de Documentos - RMP.docx",
  "docxBase64": "UEsDBBQABgAI...",
  "sharedSecret": "•••"
}
```
