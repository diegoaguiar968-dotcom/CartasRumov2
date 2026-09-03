# Guia — Anexos múltiplos e criação de pasta no SharePoint

Este guia cobre **duas funcionalidades** adicionadas ao ARCA:

1. **Anexos múltiplos no registro** — ao clicar em *Registrar no SharePoint*, além
   do `.docx` da carta vão também os arquivos que você adicionou na tela.
2. **Criar pasta no SharePoint** — um botão que cria a pasta da carta na
   biblioteca de documentos (onde a equipe já salva manualmente) e sobe o
   `.docx` mais todos os anexos.

> A parte do ARCA já está pronta. O que falta é configurar o **Power Automate**,
> descrito abaixo. A funcionalidade 1 exige um ajuste no fluxo que já existe; a
> funcionalidade 2 exige um **fluxo novo** (para não arriscar o que já funciona).

---

## Parte 1 — Anexos múltiplos no fluxo de registro (fluxo existente)

O ARCA agora envia um campo novo no payload: **`anexos`**, uma lista de arquivos.
O restante do payload continua igual (nada quebra se você não mexer no fluxo —
os anexos apenas serão ignorados).

### Payload (campos novos em destaque)

```json
{
  "titulo": "0706/GREG/2026",
  "tema": "Envio de Documentos - RMP",
  "orgao": "ANTT",
  "malha": "RMP",
  "oficio": "OFÍCIO SEI Nº 12809/2026",
  "processo": "50505.044534/2025-00",
  "formaEnvio": "SEI",
  "assuntos": "Patrimônio;Ativos",
  "responsavel": "Diego Aguiar",
  "responsavelEmail": "diego@rumolog.com",
  "area": "Ativos - Regulatório",
  "docxNome": "0706 - GREG - 2026 - Envio de Documentos - RMP.docx",
  "docxBase64": "UEsDBBQABgAI...",
  "anexos": [                                   // ← NOVO
    { "nome": "Anexo 1 - Planilha.xlsx", "conteudoBase64": "UEsDBBQ...", "tamanho": 20481 },
    { "nome": "Recibo de protocolo.pdf",  "conteudoBase64": "JVBERi0x...", "tamanho": 88213 }
  ],
  "sharedSecret": "..."
}
```

### Ajuste no fluxo (Power Automate)

1. Abra o fluxo de registro existente.
2. No **gatilho** (*Quando uma solicitação HTTP é recebida*), acrescente `anexos` ao
   **Esquema JSON** — o jeito mais simples é clicar em **"Usar payload de exemplo
   para gerar esquema"** e colar o JSON acima.
3. Depois da ação que **cria o item** (e da que anexa o `.docx`), adicione:
   - **Aplicar a cada** → escolha o campo `anexos`.
   - Dentro dele: **SharePoint → Adicionar anexo**
     - *Endereço do site* e *Nome da lista*: os mesmos já usados.
     - *Id*: o **ID** do item criado.
     - *Nome do arquivo*: `nome` (item atual).
     - *Conteúdo do arquivo*: a expressão
       ```
       base64ToBinary(items('Aplicar_a_cada')?['conteudoBase64'])
       ```
       > Se você renomeou a ação "Aplicar a cada", troque o nome dentro de
       > `items(...)` pelo nome real, com espaços virando `_`.
4. Salve e teste.

---

## Parte 2 — Fluxo novo: criar pasta com os arquivos

Cria a pasta na biblioteca de documentos, no padrão que a equipe já usa:

```
0536 - ANTT - RMO - Informação sobre realização de reunião do Conselho
└── (número) - (órgão) - (malha) - (assunto)
```

**Destino padrão** (configurável por variável de ambiente):

| Item | Valor padrão | Variável |
|---|---|---|
| Biblioteca | `Pasta Regulatorio` | `SHAREPOINT_BIBLIOTECA` |
| Caminho | `Cartas e Oficios/Cartas/Cartas 2026` | `SHAREPOINT_PASTA_CAMINHO` |

### Payload enviado

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
    { "nome": "0706 - GREG - 2026 - Envio de Documentos - RMP.docx", "conteudoBase64": "...", "tamanho": 66000 },
    { "nome": "Anexo 1 - Planilha.xlsx", "conteudoBase64": "...", "tamanho": 20481 }
  ],
  "sharedSecret": "..."
}
```

> O `.docx` da carta **sempre** vem como primeiro item de `arquivos`.

### Montagem do fluxo

1. **Criar** um fluxo novo: *Instantâneo* → gatilho **"Quando uma solicitação HTTP
   é recebida"**.
2. Em **Esquema JSON**, use *"Usar payload de exemplo para gerar esquema"* e cole
   o JSON acima.
3. **(Recomendado) Validar o segredo:** adicione uma **Condição** logo no início —
   se `sharedSecret` for diferente do valor esperado, **Responder** com 401 e
   encerrar. Use o mesmo valor de `SHAREPOINT_WEBHOOK_SECRET`.
4. **Ação: SharePoint → Criar novo item de pasta**
   - *Endereço do site*: `https://rumolog.sharepoint.com/sites/concessao.regulatorio`
   - *Nome da lista/biblioteca*: `Pasta Regulatorio`
   - *Caminho da pasta*: expressão que junta o caminho e o nome —
     ```
     concat(triggerBody()?['caminho'], '/', triggerBody()?['pastaNome'])
     ```
5. **Ação: Aplicar a cada** → campo `arquivos`. Dentro dele:
   - **SharePoint → Criar arquivo**
     - *Caminho da pasta*: a mesma expressão do passo 4.
     - *Nome do arquivo*: `nome` (item atual).
     - *Conteúdo do arquivo*:
       ```
       base64ToBinary(items('Aplicar_a_cada')?['conteudoBase64'])
       ```
6. **Ação: Responder** (Request → *Responder*) com status **200** e corpo:
   ```json
   { "pastaUrl": "@{outputs('Criar_novo_item_de_pasta')?['body/{Link}']}" }
   ```
   > Devolver a `pastaUrl` faz o ARCA **abrir a pasta numa aba nova** logo após
   > criar. Sem isso, funciona igual, mas sem abrir a aba.
7. **Salve** e copie a **URL HTTP POST** gerada no gatilho.

### Configurar no Render

No serviço do **backend**, em *Environment*, adicione:

| Variável | Valor |
|---|---|
| `SHAREPOINT_PASTA_WEBHOOK_URL` | a URL HTTP POST do fluxo novo |
| `SHAREPOINT_BIBLIOTECA` | `Pasta Regulatorio` *(opcional — é o padrão)* |
| `SHAREPOINT_PASTA_CAMINHO` | `Cartas e Oficios/Cartas/Cartas 2026` *(opcional — é o padrão)* |

O botão **"Criar pasta no SharePoint"** só aparece na tela depois que
`SHAREPOINT_PASTA_WEBHOOK_URL` estiver configurada.

---

## Limites e cuidados

- **Tamanho:** cada arquivo pode ter até **25 MB**, com no máximo **20 arquivos**
  por envio. O conteúdo trafega em base64 (fica ~33% maior), então evite mandar
  centenas de MB de uma vez — o Power Automate pode expirar. Para lotes grandes,
  crie a pasta e suba os arquivos maiores direto no SharePoint.
- **Nomes:** o ARCA remove automaticamente os caracteres que o SharePoint não
  aceita (`\ / : * ? " < > | # % { } ~ &`) e corta o nome da pasta em 180
  caracteres, para não estourar o limite de caminho.
- **Pasta repetida:** se a pasta já existir, a ação *Criar novo item de pasta*
  pode falhar. Se isso incomodar, coloque a ação dentro de um **Escopo** com
  *"Configurar execução após"* → marcar também **"falhou"**, para o fluxo seguir
  e apenas criar os arquivos.
- **Os arquivos não ficam no ARCA:** eles são lidos do seu computador no momento
  do envio e descartados do servidor logo depois. Se atualizar a página antes de
  enviar, é preciso selecioná-los de novo.
