# Guia — Anexos múltiplos e criação de pasta no SharePoint

Este guia configura **duas coisas novas** no Power Automate:

| | O que faz | Trabalho |
|---|---|---|
| **Parte 1** | Ao *Registrar no SharePoint*, os arquivos que você anexou vão junto com o `.docx` para o **item da lista** | Ajustar o fluxo que **já existe** (~10 min) |
| **Parte 2** | Botão *Criar pasta no SharePoint*: cria a pasta da carta na **biblioteca de documentos** e sobe todos os arquivos | Criar um fluxo **novo** (~25 min) |

> **O lado do ARCA já está pronto.** Falta só o que está descrito aqui.
>
> As duas partes são **independentes** — dá para fazer só uma. E enquanto você
> não fizer nada, **tudo continua funcionando como hoje**: a Parte 1 não quebra o
> fluxo atual, e o botão da Parte 2 só aparece depois de configurado.

---

# PARTE 1 — Fazer os anexos irem junto no registro

## O que muda

O ARCA agora manda um campo novo chamado **`anexos`** — uma *lista* de arquivos.
Cada item da lista tem três informações:

| Campo | O que é |
|---|---|
| `nome` | O nome do arquivo (ex.: `Anexo 1 - Planilha.xlsx`) |
| `conteudoBase64` | O arquivo em si, convertido em texto |
| `tamanho` | O tamanho em bytes |

Precisamos ensinar o fluxo a percorrer essa lista e anexar cada arquivo.

---

## Etapa 1.1 — Atualizar o "molde" do gatilho

O gatilho precisa conhecer o campo novo, senão ele não aparece para você usar.

1. Abra o **fluxo de registro que já existe** → **Editar**.
2. Clique na primeira ação, **"Quando uma solicitação HTTP é recebida"**.
3. Procure o botão **"Usar payload de exemplo para gerar esquema"**
   (fica logo abaixo da caixa do Esquema JSON).
4. Cole **exatamente** o texto abaixo e clique em **Concluído**:

```json
{
  "titulo": "0706/GREG/2026",
  "tema": "Envio de Documentos - RMP",
  "orgao": "ANTT",
  "malha": "RMP",
  "oficio": "OFÍCIO SEI Nº 12809/2026",
  "processo": "50505.044534/2025-00",
  "formaEnvio": "SEI",
  "assuntos": "Patrimônio",
  "responsavel": "Diego Aguiar",
  "responsavelEmail": "diego@rumolog.com",
  "area": "Ativos - Regulatório",
  "docxNome": "0706 - GREG - 2026 - Envio de Documentos - RMP.docx",
  "docxBase64": "UEsDBBQABgAI",
  "anexos": [
    { "nome": "Anexo 1 - Planilha.xlsx", "conteudoBase64": "UEsDBBQ", "tamanho": 20481 }
  ],
  "sharedSecret": "seu-segredo"
}
```

> ⚠️ **Confira depois de colar:** as ações seguintes do fluxo continuam com os
> campos preenchidos? O esquema novo tem os mesmos nomes de antes, então nada
> deveria se perder. Se algum campo ficou vazio, é só selecioná-lo de novo no
> Conteúdo dinâmico.

---

## Etapa 1.2 — Percorrer a lista de anexos

1. Vá até **depois** da ação que anexa o `.docx` (aquela chamada
   *"Adicionar anexo"*, da Etapa E do guia principal).
2. **+ Nova etapa** → procure **"Aplicar a cada"** (*Apply to each*, do grupo
   **Controle**).
3. No campo **"Selecionar uma saída das etapas anteriores"**, escolha no
   Conteúdo dinâmico o campo **`anexos`**.

> 💡 Se `anexos` não aparecer na lista, o esquema da Etapa 1.1 não foi salvo.
> Volte e refaça.

---

## Etapa 1.3 — Anexar cada arquivo

**Dentro** do "Aplicar a cada" (use o botão *Adicionar uma ação* que fica no
quadro do loop, não fora dele):

1. **SharePoint** → **"Adicionar anexo"**.
2. Preencha:

| Campo | O que colocar |
|---|---|
| **Endereço do site** | O mesmo do "Criar item" |
| **Nome da lista** | O mesmo do "Criar item" |
| **Id** | O **ID** do item criado (Conteúdo dinâmico, saída do "Criar item") |
| **Nome do arquivo** | O dinâmico **`nome`** — dentro do loop ele representa o arquivo da vez |
| **Conteúdo do arquivo** | Aba **Expressão (fx)**, cole: `base64ToBinary(items('Aplicar_a_cada')?['conteudoBase64'])` |

> 🔎 **Sobre o nome no `items(...)`:** ele precisa ser o nome **da sua ação**
> "Aplicar a cada", com os **espaços trocados por sublinhado**. Se a sua ação se
> chama *"Aplicar a cada 2"*, a expressão vira
> `items('Aplicar_a_cada_2')?['conteudoBase64']`. Para conferir o nome exato:
> clique nos três pontinhos (**…**) da ação → **Renomear** — o nome que aparece
> ali é o que você deve usar.

3. **Salve** o fluxo.

✅ **Parte 1 concluída.** Cartas registradas agora levam o `.docx` **e** os anexos.

---

# PARTE 2 — Fluxo novo: criar a pasta com os arquivos

## O que ele vai fazer

Criar, dentro da biblioteca onde vocês já guardam as cartas, uma pasta assim:

```
Pasta Regulatorio
└── Cartas e Oficios
    └── Cartas
        └── Cartas 2026
            └── 0706 - ANTT - RMP - Envio de Documentos     ← criada pelo fluxo
                ├── 0706 - GREG - 2026 - Envio de Documentos - RMP.docx
                ├── Anexo 1 - Planilha.xlsx
                └── Recibo de protocolo.pdf
```

O ARCA monta o nome da pasta no padrão **`NNNN - ÓRGÃO - MALHA - Assunto`** e já
remove os caracteres que o SharePoint não aceita. Você não precisa fazer nada
quanto a isso.

---

## Etapa 2.1 — Criar o fluxo e o gatilho

1. Acesse **make.powerautomate.com** → **Criar** → **Fluxo de nuvem instantâneo**.
2. **Nome:** `ARCA — Criar pasta da carta`.
3. Em *Escolha como disparar*, selecione **"Quando uma solicitação HTTP é
   recebida"** → **Criar**.
4. Clique na ação criada e depois em **"Usar payload de exemplo para gerar
   esquema"**. Cole este JSON e confirme:

```json
{
  "acao": "criarPasta",
  "pastaNome": "0706 - ANTT - RMP - Envio de Documentos",
  "biblioteca": "Pasta Regulatorio",
  "caminho": "Cartas e Oficios/Cartas/Cartas 2026",
  "titulo": "0706/GREG/2026",
  "tema": "Envio de Documentos - RMP",
  "orgao": "ANTT",
  "malha": "RMP",
  "responsavel": "Diego Aguiar",
  "responsavelEmail": "diego@rumolog.com",
  "arquivos": [
    { "nome": "0706 - GREG - 2026 - Carta.docx", "conteudoBase64": "UEsDBBQ", "tamanho": 66000 }
  ],
  "sharedSecret": "seu-segredo"
}
```

> A **URL do fluxo** aparece nessa mesma ação **depois de salvar** — vamos
> precisar dela na Etapa 2.6.

---

## Etapa 2.2 — (Recomendado) Conferir o segredo

Isso impede que alguém que descubra a URL crie pastas na sua biblioteca.

1. **+ Nova etapa** → **Controle** → **Condição**.
2. À esquerda, insira o dinâmico **`sharedSecret`**; operador **é igual a**;
   à direita, digite o **mesmo valor** que está na variável
   `SHAREPOINT_WEBHOOK_SECRET` do Render.
3. No ramo **"Se não"**: **+ Adicionar uma ação** → **Solicitação** →
   **"Resposta"** → *Código de status* **401** → depois **Controle** →
   **"Terminar"** com status *Falha*.
4. **Todo o restante do fluxo vai no ramo "Se sim".**

---

## Etapa 2.3 — Criar a pasta

No ramo **"Se sim"**:

1. **+ Adicionar uma ação** → busque por **pasta** → escolha
   **SharePoint → "Criar nova pasta"**.
   *(Em algumas versões aparece como "Criar novo item de pasta".)*
2. Preencha:

| Campo | O que colocar |
|---|---|
| **Endereço do site** | `https://rumolog.sharepoint.com/sites/concessao.regulatorio` |
| **Lista ou biblioteca** | `Pasta Regulatorio` |
| **Caminho da pasta** | Aba **Expressão (fx)**: `concat(triggerBody()?['caminho'], '/', triggerBody()?['pastaNome'])` |

Isso resulta em `Cartas e Oficios/Cartas/Cartas 2026/0706 - ANTT - RMP - ...`.

> ⚠️ **Se a pasta já existir**, esta ação **falha** e o fluxo para. Para evitar
> isso: clique nos **…** da ação → **"Configurar execução após"** → deixe
> marcado **"tem êxito"** *e também* **"falhou"** na **próxima** ação. Assim o
> fluxo segue e apenas grava os arquivos na pasta existente.

---

## Etapa 2.4 — Subir os arquivos

1. **+ Nova etapa** → **Controle** → **"Aplicar a cada"**.
2. Em *Selecionar uma saída*, escolha o dinâmico **`arquivos`**.
3. **Dentro** do loop: **Adicionar uma ação** → **SharePoint** →
   **"Criar arquivo"**.
4. Preencha:

| Campo | O que colocar |
|---|---|
| **Endereço do site** | `https://rumolog.sharepoint.com/sites/concessao.regulatorio` |
| **Caminho da pasta** | Aba **Expressão (fx)**: `concat('/', triggerBody()?['biblioteca'], '/', triggerBody()?['caminho'], '/', triggerBody()?['pastaNome'])` |
| **Nome do arquivo** | O dinâmico **`nome`** |
| **Conteúdo do arquivo** | Aba **Expressão (fx)**: `base64ToBinary(items('Aplicar_a_cada')?['conteudoBase64'])` |

> 🚨 **Atenção à diferença** (é o erro mais comum aqui):
> - Em **"Criar nova pasta"**, a biblioteca é um **campo separado** → o caminho
>   **não** inclui `Pasta Regulatorio`.
> - Em **"Criar arquivo"**, o caminho é **completo** → **precisa** começar com
>   `/Pasta Regulatorio/`.
>
> Por isso as duas expressões acima são diferentes. Copie cada uma no seu lugar.

---

## Etapa 2.5 — Devolver o link da pasta

Assim o ARCA **abre a pasta numa aba nova** logo depois de criar.

1. **Depois** do "Aplicar a cada" (fora dele), **+ Nova etapa** →
   **Solicitação** → **"Resposta"**.
2. **Código de status:** `200`.
3. **Corpo:** digite `{ "pastaUrl": "` → insira o **Conteúdo dinâmico "Link para
   o item"** (saída do *Criar nova pasta*) → feche com `" }`. Deve ficar assim:

```json
{ "pastaUrl": "<Link para o item>" }
```

> Se esse dinâmico não existir na sua versão, use a aba **Expressão (fx)** com:
> ```
> concat('https://rumolog.sharepoint.com/sites/concessao.regulatorio/', triggerBody()?['biblioteca'], '/', triggerBody()?['caminho'], '/', triggerBody()?['pastaNome'])
> ```
> (o navegador cuida dos espaços sozinho)

4. **Salve o fluxo.**

> Sem esta etapa **funciona igual** — o ARCA só avisa "Pasta criada" sem abrir a
> aba.

---

## Etapa 2.6 — Conectar no ARCA (Render)

1. Volte à ação **"Quando uma solicitação HTTP é recebida"** e **copie a URL
   HTTP POST** (ela só aparece depois de salvar).
2. No **Render** → serviço do **backend do ARCA** → **Environment** → adicione:

| Variável | Valor |
|---|---|
| `SHAREPOINT_PASTA_WEBHOOK_URL` | *(cole a URL copiada)* |
| `SHAREPOINT_BIBLIOTECA` | `Pasta Regulatorio` — opcional, já é o padrão |
| `SHAREPOINT_PASTA_CAMINHO` | `Cartas e Oficios/Cartas/Cartas 2026` — opcional, já é o padrão |

3. **Salve** — o Render reinicia sozinho (~1 min).

> O botão **"Criar pasta no SharePoint"** só aparece na tela **depois** que a
> variável `SHAREPOINT_PASTA_WEBHOOK_URL` estiver configurada.

---

# Testar

1. Abra o ARCA → **Histórico** → clique numa carta.
2. Em **"Arquivos desta carta"**, clique em **Adicionar arquivos** e escolha
   1 ou 2 arquivos pequenos.
3. Clique em **Criar pasta no SharePoint**.
4. Esperado: mensagem de sucesso, uma **aba nova** abrindo a pasta, e dentro
   dela o `.docx` mais os arquivos que você escolheu.
5. Depois teste o **Registrar no SharePoint** e confira se o item da lista
   ficou com **todos** os anexos.

> 💡 No Power Automate, **Histórico de execuções** mostra cada passo com o que
> entrou e o que saiu — é o melhor lugar para entender qualquer falha.

---

# Se algo der errado

| Sintoma | Causa provável | Solução |
|---|---|---|
| Botão "Criar pasta" não aparece | `SHAREPOINT_PASTA_WEBHOOK_URL` não configurada | Etapa 2.6 |
| `anexos` / `arquivos` não aparece no Conteúdo dinâmico | Esquema do gatilho desatualizado | Refaça a Etapa 1.1 / 2.1 |
| Erro na expressão `items(...)` | Nome da ação diferente | Use o nome real com `_` no lugar dos espaços (veja a dica da Etapa 1.3) |
| Arquivo criado, mas corrompido / 0 KB | Faltou o `base64ToBinary` | O conteúdo **precisa** estar dentro de `base64ToBinary(...)` |
| "Erro ao criar pasta: já existe" | Pasta repetida | Ajuste o "Configurar execução após" (aviso da Etapa 2.3) |
| Arquivo vai para o lugar errado | Caminho do "Criar arquivo" sem a biblioteca | Ele **precisa** começar com `/Pasta Regulatorio/` (aviso da Etapa 2.4) |
| Fluxo expira / demora demais | Arquivos muito grandes | Veja os limites abaixo |

---

# Limites e observações

- **Tamanho:** até **25 MB por arquivo** e **20 arquivos** por envio. O conteúdo
  trafega como texto (fica ~33% maior), então lotes de centenas de MB podem
  fazer o Power Automate expirar. Para arquivos muito grandes, crie a pasta pelo
  ARCA e suba esses arquivos direto no SharePoint.
- **Nomes:** o ARCA remove sozinho os caracteres proibidos
  (`\ / : * ? " < > | # % { } ~ &`) e limita o nome da pasta a 180 caracteres.
- **A pasta do ano é fixa** (`Cartas 2026`). Na virada do ano, basta atualizar a
  variável `SHAREPOINT_PASTA_CAMINHO` no Render — **não precisa mexer no fluxo**.
- **Os arquivos não ficam guardados no ARCA:** eles são lidos do seu computador
  na hora do envio e descartados do servidor em seguida. Se atualizar a página
  antes de enviar, será preciso selecioná-los de novo.

---

# Referência rápida das expressões

Para copiar e colar:

```
# Caminho na ação "Criar nova pasta" (SEM a biblioteca)
concat(triggerBody()?['caminho'], '/', triggerBody()?['pastaNome'])

# Caminho na ação "Criar arquivo" (COM a biblioteca, começando com /)
concat('/', triggerBody()?['biblioteca'], '/', triggerBody()?['caminho'], '/', triggerBody()?['pastaNome'])

# Conteúdo do arquivo, dentro do "Aplicar a cada"
base64ToBinary(items('Aplicar_a_cada')?['conteudoBase64'])

# Conteúdo do .docx da carta (fora de loop, na Parte 1)
base64ToBinary(triggerBody()?['docxBase64'])
```
