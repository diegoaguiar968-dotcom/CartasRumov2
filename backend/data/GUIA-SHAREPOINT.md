# Guia: registrar cartas no SharePoint automaticamente (Power Automate / Webhook)

Este é o caminho **100% automático**: você clica em **"Registrar no SharePoint"**
no histórico do ARCA e o item é criado sozinho na lista — sem abrir formulário,
com opção de anexar o `.docx`.

> ✅ **Use este guia se o gatilho "Quando uma solicitação HTTP é recebida"
> estiver disponível para você** no Power Automate. Ele já foi considerado
> "premium"; se na sua conta ele funciona, siga por aqui. Se **não** estiver
> disponível, use o outro caminho: **`GUIA-SHAREPOINT-FORMS.md`** (via Microsoft
> Forms, gratuito).

---

## 1. Como funciona (a ideia)

```
   ┌─────────┐   1 clique    ┌──────────────┐   POST (JSON)   ┌───────────────────┐
   │  ARCA   │ ────────────▶ │ Backend ARCA │ ──────────────▶ │ Fluxo Power       │
   │(histórico)│             │  (Render)    │  com um segredo │ Automate (webhook)│
   └─────────┘               └──────────────┘                 └─────────┬─────────┘
                                                                        │ cria o item
                                                                        ▼
                                                              ┌───────────────────┐
                                                              │ Lista SharePoint  │
                                                              └───────────────────┘
```

Diferença para o caminho via Forms: **não há etapa manual**. O ARCA envia os
dados direto para um "endereço secreto" (o **webhook**) que o Power Automate
gera. Por isso é importante **proteger esse endereço com um segredo** (é a sua
Pergunta 1, respondida na Etapa B).

O segredo do webhook fica **no servidor** (variável de ambiente no Render), nunca
no navegador do usuário.

---

## 2. Visão geral das etapas (uma vez só)

| Etapa | Onde | O que faz |
|---|---|---|
| A | Power Automate | Criar o fluxo + gatilho HTTP + colar o esquema JSON |
| B | Power Automate | **Validar o segredo** (proteção do endereço) |
| C | Power Automate | Resolver o **Responsável** (se a coluna for do tipo Pessoa) |
| D | Power Automate | **Criar item** na lista (mapear as colunas) |
| E | Power Automate | *(opcional)* Anexar o `.docx` |
| F | Power Automate | *(opcional)* Devolver o link do item criado |
| G | Render (ARCA) | Colar a URL do webhook e o segredo nas variáveis |

---

## 3. Etapa A — Criar o fluxo e o gatilho

1. Em **make.powerautomate.com** → **Criar** → **Fluxo de nuvem instantâneo**.
2. Em "Escolher como disparar", selecione **"Quando uma solicitação HTTP é
   recebida"** e clique em **Criar**.
3. No gatilho, no campo **"Esquema JSON do corpo da solicitação"**, cole
   exatamente este esquema (ele descreve os campos que o ARCA envia):

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

> A **URL do webhook** (um endereço longo com um `sig=...` no final) só aparece
> **depois que você salva o fluxo pela primeira vez**. Guarde-a para a Etapa G.

> ⚠️ **Deu erro 401 `DirectApiAuthorizationRequired` / "The OAuth authorization
> scheme is required"?** O gatilho está exigindo **login OAuth** para ser
> disparado, mas o ARCA chama pela **chave SAS** que já vem na URL (`sig=...`).
> Corrija no gatilho:
> 1. Abra o gatilho **"Quando uma solicitação HTTP é recebida"**.
> 2. Clique em **"+ Adicionar novo parâmetro"**.
> 3. Marque **"Quem pode disparar o gatilho?"** (*Who can trigger the flow?*).
> 4. Selecione **"Qualquer pessoa"** (*Anyone*) e **salve**.
>
> Ao salvar, a **URL pode mudar** — copie a nova e atualize `SHAREPOINT_WEBHOOK_URL`
> no Render. Se "Qualquer pessoa" estiver **bloqueado**, o tenant obriga OAuth por
> política de administrador: nesse caso o webhook direto não funciona sem um app
> registrado no Entra ID — use o caminho do **Microsoft Forms**
> (`GUIA-SHAREPOINT-FORMS.md`).

---

## 4. Etapa B — O segredo (respondendo: "onde eu defino o segredo?")

**Conceito:** o segredo (`sharedSecret`) é uma **senha combinada** entre o ARCA e
o fluxo. O ARCA manda essa senha dentro de cada requisição; o fluxo confere se a
senha bate. Se não bater, ele recusa. Assim, mesmo que alguém descubra a URL, não
consegue criar itens sem saber o segredo.

**Você define esse segredo em DOIS lugares — e eles têm que ser IDÊNTICOS:**

| Lugar | O que fazer |
|---|---|
| 1. **Render** (ARCA) | Variável `SHAREPOINT_WEBHOOK_SECRET` = um texto que você inventa (ex.: uma senha longa aleatória `arca-7fК9x...`). Ver Etapa G. |
| 2. **Fluxo** (Power Automate) | Na Condição abaixo, você digita **esse mesmo texto** para comparar. |

> Você **inventa** o valor (qualquer texto difícil de adivinhar). O ARCA já envia
> automaticamente o que estiver em `SHAREPOINT_WEBHOOK_SECRET` no campo
> `sharedSecret` de cada requisição — você não precisa mexer em código.

**Como montar a Condição no fluxo:**

1. Depois do gatilho, clique em **+ Nova etapa** → **Controle** → **Condição**.
2. A Condição tem três caixas. Preencha assim:
   - **Caixa da esquerda:** clique nela → **Conteúdo dinâmico** → escolha
     `sharedSecret` (veio do gatilho).
   - **Caixa do meio:** selecione **é igual a**.
   - **Caixa da direita:** **digite o segredo literal** (o mesmíssimo texto que
     você pôs em `SHAREPOINT_WEBHOOK_SECRET`).
3. A Condição cria dois caminhos:
   - **"Se não" (If no)** → aqui a senha está errada. Adicione:
     - **Resposta** (*Response*) com **Status = 401**;
     - depois **Controle → Encerrar** (*Terminate*) com status "Com falha".
   - **"Se sim" (If yes)** → aqui a senha confere. **Todo o resto do fluxo
     (Etapas C, D, E, F) vai DENTRO deste ramo.**

> Essa etapa é **recomendada**, mas opcional. A própria URL do gatilho já tem uma
> assinatura difícil de adivinhar (`sig=...`); o segredo é uma **segunda camada**
> de proteção. Se quiser simplificar no primeiro teste, pode pular — mas coloque
> antes de usar pra valer.

---

## 5. Etapa C — Resolver o "Responsável" (respondendo: "onde é o botão de usuários?")

**Primeiro, um esclarecimento:** não existe um "botão de adicionar usuários". O
que o guia pedia é **adicionar uma AÇÃO** chamada *"Obter perfil do usuário
(V2)"*, do conector **"Usuários do Office 365"**. Ela serve para transformar um
**e-mail** em um **usuário de verdade**.

**Existem dois jeitos.** Para a coluna Responsável do tipo **Pessoa**, o mais
simples é o **Jeito 1**:

### Jeito 1 (recomendado) — sem ação extra, e-mail direto no Claims

O SharePoint geralmente resolve o usuário **direto pelo e-mail**. Então você
**não precisa** da ação "Obter perfil do usuário (V2)":

1. **Não** adicione (ou exclua) a ação "Obter perfil do usuário (V2)".
2. Vá direto ao **"Criar item"** (Etapa D) e, no campo **Responsável → Claims**,
   coloque o e-mail com a expressão `triggerBody()?['responsavelEmail']`.

Vantagem: evita a conexão do Office 365 (veja o aviso abaixo). Limitação: se o
e-mail não existir no diretório, a coluna fica vazia (não dá erro).

### Jeito 2 — com a ação "Obter perfil do usuário (V2)" (e-mail validado)

Use se quiser **validar** o usuário no diretório antes de gravar:

1. Dentro do ramo **"Verdadeiro"**, clique em **+ Nova etapa**.
2. Na busca, digite **"Office 365 Users"** (ou "Usuários do Office 365").
3. Escolha a ação **"Obter perfil do usuário (V2)"**.
4. No campo **"Usuário (UPN)"**, informe o e-mail do responsável. Tente pelo
   **Conteúdo dinâmico** → `responsavelEmail`.

> 🔌 **A ação aparece com "Parâmetros inválidos" e nenhum campo?** Isso é
> **conexão**, não o campo. Se o conector **"Usuários do Office 365"** estiver
> com um **✗ vermelho** (conexão inválida), a ação não carrega os parâmetros —
> por isso o campo "Usuário (UPN)" nem aparece. **Solução:** no painel
> **"Alterar conexão"**, clique em **"Adicionar novo(a)"** e faça **login com sua
> conta corporativa Microsoft**. Quando a conexão ficar válida, a ação recarrega
> e o campo "Usuário (UPN)" aparece. (Se preferir não lidar com isso, use o
> **Jeito 1**.)

> ⚠️ **`responsavelEmail` não aparece no Conteúdo dinâmico?** Isso acontece
> quando o **Esquema JSON do gatilho** (Etapa A) não foi reconhecido — sem ele,
> o Power Automate não sabe quais campos o corpo tem. Duas saídas:
>
> - **Solução garantida (recomendada):** no campo "Usuário (UPN)", abra a aba
>   **Expressão (fx)** e cole:
>   ```
>   triggerBody()?['responsavelEmail']
>   ```
>   Isso pega o e-mail direto do corpo, independente do painel de conteúdo
>   dinâmico. (Vale para qualquer campo: `triggerBody()?['area']`,
>   `triggerBody()?['tema']`, etc.)
> - **Corrigir a causa:** volte ao gatilho, confirme que o **Esquema JSON** está
>   colado corretamente e **salve o fluxo**. Depois de salvar, os campos
>   (`responsavelEmail`, `titulo`, ...) passam a aparecer no Conteúdo dinâmico.

Depois, na Etapa D, o campo Responsável (Claims) vai apontar para o **e-mail**
retornado por esta ação.

> Se `responsavelEmail` vier **vazio** (cartas antigas, geradas antes do campo de
> e-mail existir), esta ação falha. Nesse caso, deixe o Responsável em branco e
> preencha à mão no item — ou proteja a ação com uma condição de "e-mail não
> vazio".

---

## 6. Etapa D — Criar o item na lista

1. Ainda no ramo **"Se sim"**, **+ Nova etapa** → **SharePoint** →
   **"Criar item"**.
2. Escolha o **Endereço do site** e o **Nome da lista** (ex.: Cartas 2026).
3. Mapeie cada coluna com o conteúdo dinâmico do gatilho:

| Coluna da lista | Valor (conteúdo dinâmico do gatilho) |
|---|---|
| Título / Número da Carta | `titulo` |
| **Responsável** (coluna Pessoa → campo "Claims") | ver **"Coluna Responsável (Pessoa)"** abaixo |
| E-mail do Responsável | `responsavelEmail` |
| Área do Responsável | `area` |
| **Data de Envio** | **ver "Data de Envio (hoje automático)" abaixo** |
| Tema | `tema` |
| Orgão | `orgao` |
| **Malha** | **ver seção "Malha" abaixo** |
| Ofício | `oficio` |
| Forma de Envio | `formaEnvio` |
| Número do Processo | `processo` |
| Assuntos | `assuntos` |

Deixe **em branco** (preenchidos depois de protocolar no SEI): **Conferida?,
Dilação?, Prazo com Dilação, Protocolo.**

### Data de Envio (hoje automático)

A Data de Envio é preenchida **automaticamente com a data de hoje** no momento em
que o item é criado. Se a carta for enviada em outro dia, a pessoa **edita esse
campo direto na lista** do SharePoint depois.

No campo **Data de Envio** do "Criar item", aba **Expressão (fx)**, cole:

```
convertFromUtc(utcNow(), 'E. South America Standard Time', 'yyyy-MM-dd')
```

- `utcNow()` = agora (horário universal); `convertFromUtc(... 'E. South America
  Standard Time' ...)` ajusta para o **fuso de Brasília**, evitando que perto da
  meia-noite grave o dia errado.
- `'yyyy-MM-dd'` devolve **só a data** (ex.: `2026-07-10`), ideal para uma coluna
  do tipo Data. Se a sua coluna for **Data e Hora**, pode usar `utcNow()` direto
  ou o formato `'yyyy-MM-ddTHH:mm:ss'`.

> Isso não trava a data: é só o **valor inicial**. Qualquer pessoa com acesso à
> lista pode abrir o item e mudar a Data de Envio quando o envio real for em outra
> data.

### Coluna Responsável (Pessoa) — como preencher o "Claims"

Como a coluna é do tipo **Pessoa**, o campo Responsável no "Criar item" aparece
com um subcampo **"Claims"** (ele identifica o usuário). Preencha conforme o jeito
que você escolheu na Etapa C:

- **Jeito 1 (recomendado):** no subcampo **Claims**, aba **Expressão (fx)**, cole
  o e-mail direto:
  ```
  triggerBody()?['responsavelEmail']
  ```
  O SharePoint resolve o usuário pelo e-mail. Sem ação extra, sem conexão do
  Office 365.
- **Jeito 2 (e-mail validado):** se você usou a ação "Obter perfil do usuário
  (V2)", no **Claims** use o **"Email"** dela (Conteúdo dinâmico) ou a expressão:
  ```
  outputs('Obter_o_perfil_do_usuário_(V2)')?['body/mail']
  ```
  (troque o nome entre aspas pelo nome exato da sua ação, se você a renomeou).

> Se o e-mail não existir no diretório: no Jeito 1 a coluna fica **vazia**; no
> Jeito 2 o fluxo **falha** nessa etapa. Para e-mails @rumo válidos, os dois
> funcionam — o Jeito 1 é o mais simples.

### Malha — coluna de escolha múltipla

A coluna Malha aceita **várias malhas**, mas o ARCA envia um **texto**
(`RMN, RMP`). Transforme em lista com `split`:

1. No campo **Malha** do "Criar item", clique no ícone **⇆ "Alternar para inserir
   toda a matriz"** (*Switch to input entire array*).
2. Na caixa que abrir, aba **Expressão (fx)**, cole:

   ```
   split(triggerBody()?['malha'], ', ')
   ```

Isso corta o texto a cada `, ` (vírgula + espaço). Assim `RMN, RMP` vira
`["RMN", "RMP"]` (marca as duas) e `RMS` vira `["RMS"]` (marca uma). As siglas
que o ARCA envia — `RMP, RMC, RMN, RMS, RMO, RSA, Todas as malhas` — batem
exatamente com as opções da coluna.

---

## 7. Etapa E — Anexar o `.docx` (opcional)

Se quiser o arquivo dentro do item, depois do "Criar item" adicione
**SharePoint → "Adicionar anexo"**:

- **Id** = ID do item criado (conteúdo dinâmico do "Criar item").
- **Nome do arquivo** = `docxNome`.
- **Conteúdo do arquivo** = na aba Expressão, cole:
  `base64ToBinary(triggerBody()?['docxBase64'])`.

---

## 8. Etapa F — Devolver o link do item (opcional)

Se você quiser que o ARCA mostre o link do item criado, adicione ao final
**Resposta** (*Response*): **Status 200**, corpo:

```json
{ "itemUrl": "<link do item>" }
```

(coloque o link do item usando o conteúdo dinâmico "Link para o item").

---

## 9. Etapa G — Conectar no ARCA (Render)

1. **Salve o fluxo** e copie a **URL HTTP POST** do gatilho (Etapa A).
2. No **Render** → serviço do **backend do ARCA** → **Environment**, defina:

| Variável | Valor |
|---|---|
| `SHAREPOINT_WEBHOOK_URL` | a URL do gatilho do fluxo (copiada acima) |
| `SHAREPOINT_WEBHOOK_SECRET` | o segredo que você inventou (o **mesmo** da Etapa B) |
| `SHAREPOINT_MODE` | *(opcional)* `webhook` para forçar este modo |

> **Importante:** basta definir `SHAREPOINT_WEBHOOK_URL` que o ARCA **já troca**
> para o modo automático (o botão vira **"Registrar no SharePoint"**), mesmo com
> o template de Forms embutido. Use `SHAREPOINT_MODE=webhook` só se quiser
> travar explicitamente. Sem `SHAREPOINT_WEBHOOK_URL`, o botão continua no modo
> Forms (ou some, se você também remover o Forms).

---

## 10. Testar

1. No histórico do ARCA, abra uma carta e clique em **"Registrar no SharePoint"**.
2. No Power Automate, veja o **Histórico de execuções** do fluxo: deve aparecer
   uma execução verde.
3. Confira o item novo na lista. Se o Responsável ficou vazio, reveja a Etapa C
   (tipo da coluna). Se a Malha ficou vazia, reveja o `split` (Etapa D).
4. Se der **401**, o segredo não bateu — confira se `SHAREPOINT_WEBHOOK_SECRET`
   (Render) é idêntico ao texto digitado na Condição (Etapa B).

---

## 11. Payload que o ARCA envia (referência)

```json
{
  "titulo": "0021/GREG/2026",
  "tema": "Encaminhamento de Documentos",
  "orgao": "ANTT",
  "malha": "RMP, RMS",
  "oficio": "OFÍCIO SEI Nº 41045/2025",
  "processo": "50505.064442/2025-38",
  "formaEnvio": "SEI",
  "assuntos": "resposta a ofício",
  "responsavel": "Diego Bruno de Pinho",
  "responsavelEmail": "diego.pinho@rumo.com.br",
  "area": "Projetos - Regulatório",
  "docxNome": "0021 - GREG - 2026 - Encaminhamento de Documentos - RMP.docx",
  "docxBase64": "UEsDBBQABgAI...",
  "sharedSecret": "•••"
}
```

> Em carta espontânea, `oficio` e `assuntos` podem vir vazios (o ofício só existe
> em carta-resposta; o assunto é escolhido no histórico).
