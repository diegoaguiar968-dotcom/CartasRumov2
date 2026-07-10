# Guia: registrar cartas no SharePoint pelo Microsoft Forms

Este é o guia **oficial da equipe** para levar uma carta gerada no ARCA até a
lista do SharePoint **sem precisar digitar tudo de novo à mão** — e **sem** a
licença Power Automate Premium.

---

## 1. Entenda a ideia antes de configurar

Hoje, sem integração, o caminho é: gerar a carta no ARCA → abrir o SharePoint →
digitar número, tema, malha, ofício, processo... um por um. É repetitivo e dá
erro de digitação.

A ideia deste guia é encurtar isso com **três peças** que conversam entre si:

```
   ┌─────────┐   link já preenchido   ┌──────────────┐   você confere   ┌──────────────────┐
   │  ARCA   │ ─────────────────────▶ │ Microsoft    │ ───────────────▶ │ Fluxo (Power     │
   │(histórico)│  (1 clique no botão) │ Forms        │   e clica Enviar │ Automate gratuito)│
   └─────────┘                        └──────────────┘                  └────────┬─────────┘
                                                                                 │ cria o item
                                                                                 ▼
                                                                        ┌──────────────────┐
                                                                        │ Lista SharePoint │
                                                                        │  (Cartas 2026)   │
                                                                        └──────────────────┘
```

Traduzindo:

1. **ARCA** — você clica em **"Registrar via formulário"** no histórico da carta.
   O ARCA abre um **link do Microsoft Forms com todos os campos já preenchidos**.
2. **Microsoft Forms** — você só **confere** se está tudo certo e clica em
   **Enviar**. (É o "checkpoint humano" — nada é gravado sem alguém olhar.)
3. **Fluxo do Power Automate** — assim que a resposta é enviada, um fluxo
   **gratuito** pega os dados do formulário e **cria o item** na lista.

**Por que passar pelo Forms em vez de gravar direto?** Porque gravar direto no
SharePoint a partir de um sistema externo exigiria o conector premium (ou um app
registrado no Entra ID). O gatilho "nova resposta do Forms" é **gratuito** — por
isso ele é a ponte.

**Única limitação:** o formulário **não carrega o arquivo .docx**. Se você quiser
o anexo no item, baixe a carta no ARCA e anexe manualmente no SharePoint depois.

---

## 2. O que você vai precisar configurar (uma vez só)

São 4 etapas, feitas **uma única vez**. Depois disso, o dia a dia é só clicar e
enviar.

| Etapa | Onde | O que faz | Quem faz |
|---|---|---|---|
| A | Microsoft Forms | Criar o formulário com as perguntas | Você |
| B | Microsoft Forms | Gerar o "link pré-preenchido" (com sentinelas) | Você |
| C | Render (ARCA) | Colar esse link na configuração do ARCA | Você |
| D | Power Automate | Criar o fluxo que cria o item na lista | Você |

O ARCA **já está pronto** — ele só precisa do link da Etapa B para funcionar.

---

## 3. As colunas da lista — o que o ARCA já preenche

A lista do SharePoint tem 14 colunas. O ARCA preenche automaticamente as que ele
conhece no momento em que a carta é gerada; as outras dependem de algo que só
existe **depois** (protocolar no SEI), então ficam para você preencher na lista.

| # | Coluna na lista | ARCA preenche? | Como o ARCA envia (a "sentinela") |
|---|---|---|---|
| 1 | Número da Carta | ✅ | `ZZTITULOZZ` — ex.: `0703/GREG/2026` |
| 2 | E-mail do Responsável | ✅ | `ZZEMAILZZ` — do "Identifique-se" |
| 3 | Área do Responsável | ✅ | `ZZAREAZZ` — do "Identifique-se" (lista suspensa) |
| 4 | Data de envio | 🔷 | *(o fluxo preenche com hoje; editável na lista — ver Etapa D)* |
| 5 | Tema | ✅ | `ZZTEMAZZ` |
| 6 | Órgão | ✅ | `ZZORGAOZZ` — normalmente `ANTT` |
| 7 | Malha | ✅ | `ZZMALHAZZ` — 1 ou mais siglas, ex.: `RMN, RMP` |
| 8 | Ofício | ✅ | `ZZOFICIOZZ` — só em carta-resposta; em branco na espontânea |
| 9 | Dilação? | ⬜ | *(você preenche na lista)* |
| 10 | Prazo com Dilação | ⬜ | *(você preenche na lista)* |
| 11 | Forma de Envio | ✅ | `ZZFORMAZZ` — `SEI`, `E-mail` ou `Presencialmente` |
| 12 | Protocolo | ⬜ | *(você preenche na lista após protocolar)* |
| 13 | Número do Processo | ✅ | `ZZPROCESSOZZ` |
| 14 | Assuntos | ✅ | `ZZASSUNTOSZZ` — categoria escolhida no histórico |

> **O que é "sentinela"?** É uma palavra-código temporária (ex.: `ZZTITULOZZ`)
> que funciona como um "espaço reservado". Quando você monta o link do formulário
> na Etapa B, digita essas palavras nos campos. Depois, na hora real, o ARCA
> **troca cada sentinela pelo valor verdadeiro da carta**. Pense nelas como os
> `{nome}` de um documento-modelo: um marcador que será substituído.

---

## 4. Etapa A — Criar o formulário no Microsoft Forms

1. Acesse **forms.office.com** → **Novo formulário**.
2. Dê um nome, ex.: *"Registro de Cartas GREG"*.
3. Crie **uma pergunta para cada coluna que o ARCA preenche** (as 10 da tabela
   acima marcadas com ✅). Para adicionar, clique em **+ Adicionar novo**.

Use estes tipos de pergunta:

| Pergunta (nomeie assim) | Tipo no Forms |
|---|---|
| Número da Carta | Texto |
| E-mail do Responsável | Texto |
| Área do Responsável | Texto |
| Tema | Texto |
| Órgão | Texto |
| **Malha** | **Texto** ⚠️ *(leia o aviso abaixo — não use "Escolha")* |
| Ofício | Texto |
| Forma de Envio | Escolha → opções: `SEI`, `E-mail`, `Presencialmente` |
| Número do Processo | Texto |
| Assuntos | Escolha → as 14 opções (patrimônio, ativos, passivos, interferências, DUP, investimentos obrigatórios, obrigações contratuais, indicadores, acidentes, solicitação de acesso, fiscalização, RDT e RPMF, resposta a ofício, outro) |

> ⚠️ **Por que a Malha é "Texto" e não "Escolha"?**
> No SharePoint, a coluna Malha aceita **várias malhas ao mesmo tempo** (uma carta
> pode ser RMN **e** RMP). Uma pergunta do tipo "Escolha" no Forms só deixaria
> marcar **uma** opção. Então a pergunta Malha precisa ser de **Texto**, para
> receber algo como `RMN, RMP`. Depois, na Etapa D, o fluxo separa esse texto e
> marca as duas malhas na lista. Não se preocupe: o ARCA sempre manda as siglas
> exatas (`RMP, RMC, RMN, RMS, RMO, RSA, Todas as malhas`).

> 💡 **Dica sobre "Escolha":** nos campos Forma de Envio e Assuntos, o texto das
> opções precisa ser **idêntico** ao que o ARCA envia (mesmas palavras, mesmos
> acentos, minúsculas). Ex.: escreva `resposta a ofício`, não `Resposta Ofício`.

---

## 5. Etapa B — Gerar o "link pré-preenchido" (com as sentinelas)

Aqui você cria o molde de link que o ARCA vai usar.

1. No formulário, vá em **Coletar respostas** (botão no topo).
2. Clique nos **três pontinhos (⋯)** → **Obter URL pré-preenchida**
   (*Get pre-filled URL*).
3. Abrirá uma cópia do formulário para você "preencher". **Em cada campo, digite
   exatamente a sentinela correspondente** (copie e cole da tabela):

   | No campo... | Digite exatamente |
   |---|---|
   | Número da Carta | `ZZTITULOZZ` |
   | E-mail do Responsável | `ZZEMAILZZ` |
   | Área do Responsável | `ZZAREAZZ` |
   | Tema | `ZZTEMAZZ` |
   | Órgão | `ZZORGAOZZ` |
   | Malha | `ZZMALHAZZ` |
   | Ofício | `ZZOFICIOZZ` |
   | Forma de Envio | *(selecione qualquer opção — será trocada)* |
   | Número do Processo | `ZZPROCESSOZZ` |
   | Assuntos | *(selecione qualquer opção — será trocada)* |

   > Observação: em campos de **Escolha** (Forma de Envio, Assuntos) o Forms não
   > deixa digitar texto livre. Tudo bem — selecione qualquer opção só para gerar
   > o link; o ARCA substitui pelo valor certo mesmo assim, porque a sentinela
   > entra pela URL.

4. Clique em **Obter link** e **copie a URL inteira**. Ela é longa e tem as
   sentinelas embutidas, algo como:

   ```
   https://forms.office.com/Pages/ResponsePage.aspx?id=...&abc123=ZZTITULOZZ&def456=ZZTEMAZZ&...
   ```

5. **Guarde essa URL** — ela vai para a Etapa C.

> 🔒 **Cuidado ao editar o formulário depois:** se você adicionar, remover ou
> renomear perguntas, o Forms muda os códigos internos (`abc123=...`) e o link
> antigo para de preencher. Se isso acontecer, **refaça esta Etapa B** e atualize
> a configuração da Etapa C.

---

## 6. Etapa C — Colar o link na configuração do ARCA (Render)

1. Acesse o painel do **Render** → serviço do **backend do ARCA**.
2. Vá em **Environment** (variáveis de ambiente).
3. Crie/edite a variável:

   | Variável | Valor |
   |---|---|
   | `SHAREPOINT_FORMS_URL_TEMPLATE` | a URL inteira que você copiou na Etapa B |

4. Salve. O Render vai reiniciar o serviço automaticamente.

Pronto: no histórico do ARCA, o botão passa a ser **"Registrar via formulário"**.

> ℹ️ Se você **não** definir essa variável, o ARCA usa um link padrão já embutido
> no código (o do formulário atual da equipe). A variável serve para **trocar** o
> formulário sem mexer no código — por isso é bom configurá-la com o **seu** link.

---

## 7. Etapa D — Criar o fluxo que cria o item na lista

Este é o "robô" gratuito que, toda vez que alguém envia o formulário, cria a
linha na lista.

1. Acesse **make.powerautomate.com** → **Criar** → **Fluxo de nuvem
   automatizado**.
2. **Gatilho:** procure **Microsoft Forms** e escolha
   **"Quando uma nova resposta é enviada"** (é o conector **padrão/gratuito**).
   Selecione o seu formulário.
3. **Ação 1:** **+ Nova etapa** → **Microsoft Forms** →
   **"Obter os detalhes da resposta"**. No campo *Id da Resposta*, escolha o
   conteúdo dinâmico **"ID da resposta"** que veio do gatilho.
4. **Ação 2:** **+ Nova etapa** → **SharePoint** → **"Criar item"**.
   - Em *Endereço do site*, escolha o site da lista.
   - Em *Nome da lista*, escolha a lista das cartas (ex.: **Cartas 2026**).
   - Vão aparecer os campos da lista. Preencha cada um com a **resposta
     correspondente** (conteúdo dinâmico da Ação 1):

   | Campo da lista | Preencha com (resposta do Forms) |
   |---|---|
   | Número da Carta | Número da Carta |
   | E-mail do Responsável | E-mail do Responsável |
   | Área do Responsável | Área do Responsável |
   | Tema | Tema |
   | Orgão | Órgão |
   | **Malha** | **ver seção "Malha" abaixo** ⚠️ |
   | Ofício | Ofício |
   | Forma de Envio | Forma de Envio |
   | Número do Processo | Número do Processo |
   | Assuntos | Assuntos |

5. **Salve** o fluxo.

Deixe **em branco** (você preenche na lista depois de protocolar no SEI):
**Dilação?, Prazo com Dilação, Protocolo** (e "Conferida?", se existir).

**Data de Envio (hoje automático):** no campo Data de Envio do "Criar item", aba
**Expressão (fx)**, cole:

```
convertFromUtc(utcNow(), 'E. South America Standard Time', 'yyyy-MM-dd')
```

Isso grava a **data de hoje** (fuso de Brasília) ao criar o item. É só o valor
inicial — se o envio for em outro dia, a pessoa edita a Data de Envio direto na
lista depois. (Coluna do tipo Data e Hora? Use `utcNow()` ou
`'yyyy-MM-ddTHH:mm:ss'`.)

### Malha — o passo especial (coluna de escolha múltipla)

A coluna Malha aceita **vários valores**, mas o formulário manda um **texto**
(`RMN, RMP`). A coluna exige uma lista de **objetos** no formato
`[{"Value":"RMN"},{"Value":"RMP"}]` — um `split` simples (lista de textos) é
**recusado com BadRequest**.

1. Na ação **Criar item**, encontre o campo **Malha**.
2. No canto direito do campo, clique no ícone **⇆ "Alternar para inserir toda a
   matriz"** (*Switch to input entire array*). O campo vira uma caixa única.
3. Clique nessa caixa → aba **Expressão (fx)** → cole:

   ```
   if(empty(outputs('Obter_os_detalhes_da_resposta')?['body/IDDAPERGUNTAMALHA']), json('[]'), json(concat('[{"Value":"', replace(outputs('Obter_os_detalhes_da_resposta')?['body/IDDAPERGUNTAMALHA'], ', ', '"},{"Value":"'), '"}]')))
   ```

   - Troque `IDDAPERGUNTAMALHA` (aparece 2×) pelo identificador real da pergunta
     Malha. Dica: insira a resposta **"Malha"** pelo **Conteúdo dinâmico** dentro
     da expressão, que o editor preenche o caminho certo.

**O que essa expressão faz:** o `replace` troca cada `, ` (vírgula + espaço) por
`"},{"Value":"` e o `concat` fecha as pontas:
- `RMN, RMP` → `[{"Value":"RMN"},{"Value":"RMP"}]` (marca as duas malhas)
- `RMS` → `[{"Value":"RMS"}]` (marca uma só) — funciona igual.
- vazio → `[]` (não marca nada, sem quebrar o fluxo).

---

## 8. Como fica o dia a dia (depois de tudo configurado)

1. Gere a carta no ARCA normalmente.
2. **Antes**, no botão **"Identifique-se"** (canto inferior esquerdo): preencha
   **nome, e-mail e selecione sua área** na lista. Isso alimenta as colunas
   E-mail e Área do Responsável.
3. No **histórico**, na carta desejada, confira o **Assuntos** (escolha a
   categoria no seletor) e clique em **"Registrar via formulário"**.
4. Abre o **Forms já preenchido** → **confira** → **Enviar**.
5. Em segundos, o fluxo cria o item na lista. (Se quiser o `.docx` anexado, baixe
   a carta e anexe manualmente no item.)

---

## 9. Deu algum campo em branco na lista? Veja aqui

| Campo veio vazio | Causa provável | Como resolver |
|---|---|---|
| **Área do Responsável** | O campo "Área" não foi selecionado no "Identifique-se" quando a carta foi gerada. | Selecione sua área na lista suspensa do "Identifique-se" **antes** de gerar/registrar. |
| **Malha** | O campo Malha no Forms foi criado como "Escolha", ou faltou o `split` no fluxo. | Malha deve ser **Texto** (Etapa A) e o campo Malha do "Criar item" deve usar o `split` (Etapa D). |
| **Assuntos** | Em carta espontânea o Assuntos vai **em branco de propósito**. | Escolha a categoria no **seletor de Assuntos dentro do histórico** antes de registrar. |
| **Ofício** | Em carta espontânea o Ofício fica **em branco de propósito** (só carta-resposta tem ofício). | Comportamento correto — nada a fazer. |
| **Forma de Envio / Assuntos com valor "errado"** | O texto da opção no Forms não é idêntico ao que o ARCA envia. | Ajuste as opções do Forms para bater **exatamente** (acentos e minúsculas). |

---

## 10. Resumo de responsabilidades

- **Você (Microsoft), uma vez:** criar o Form (Etapa A), gerar o link com
  sentinelas (Etapa B) e criar o fluxo gratuito (Etapa D).
- **Você (Render), uma vez:** colar o link na variável
  `SHAREPOINT_FORMS_URL_TEMPLATE` (Etapa C).
- **ARCA:** já pronto — gera o link pré-preenchido de cada carta e abre para você
  conferir e enviar.
