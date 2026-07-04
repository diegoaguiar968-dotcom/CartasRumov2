# Registro no SharePoint via Microsoft Forms (sem Power Automate Premium)

Esta é a forma recomendada quando **não há licença Power Automate Premium**.
O ARCA gera um **link do Microsoft Forms já pré-preenchido**; você revisa e
clica em **Enviar**; um fluxo **padrão** (não-premium) cria o item na lista.

```
ARCA (botão "Registrar via formulário")
   → abre o Forms pré-preenchido → você revisa → Enviar
      → Fluxo padrão (gatilho "nova resposta") → cria o item na lista
```

Vantagens: sem Premium, sem app no Entra ID, sem SaaS de terceiros, e com um
checkpoint humano (que casa com a coluna "Conferida?"). O único ponto: o **.docx
não vai junto** pelo formulário (anexe manualmente se precisar).

---

## Passo 1 — Criar o Microsoft Form

Crie um formulário com **uma pergunta de texto por coluna** que o ARCA preenche:

| Pergunta (sugestão) | Vai para a coluna |
|---|---|
| Título | Título |
| Tema | Tema |
| Órgão | Orgão |
| Malha | Malha |
| Ofício | Ofício |
| Número do Processo | Número do Processo |
| Área do Responsável | Área do Responsável |

Em **Configurações do formulário**, marque **"Somente pessoas da minha
organização podem responder"** e **"Registrar nome"** — assim o Forms captura
**quem enviou**, e usaremos isso para o campo **Responsável** (não precisa
digitar e-mail).

## Passo 2 — Gerar o "URL pré-preenchido" com as SENTINELAS

No Forms: **Coletar respostas → ⋯ → Obter URL pré-preenchida** (Get pre-filled
URL). Preencha **cada campo com exatamente estas palavras** (copie e cole):

| Campo | Digite exatamente |
|---|---|
| Título | `ZZTITULOZZ` |
| Tema | `ZZTEMAZZ` |
| Órgão | `ZZORGAOZZ` |
| Malha | `ZZMALHAZZ` |
| Ofício | `ZZOFICIOZZ` |
| Número do Processo | `ZZPROCESSOZZ` |
| Área do Responsável | `ZZAREAZZ` |

Clique em **Obter link** e **copie a URL inteira**. Ela terá as sentinelas
embutidas (ex.: `...&abc123=ZZTITULOZZ&def456=ZZTEMAZZ...`). O ARCA substitui
cada sentinela pelo valor real da carta, já com a codificação correta.

> Sentinelas extras disponíveis, se você criar as perguntas: `ZZFORMAZZ`
> (forma de envio), `ZZASSUNTOSZZ` (assuntos), `ZZRESPONSAVELZZ` (nome).

## Passo 3 — Configurar no ARCA (Render)

No serviço do backend no Render → **Environment**, defina:

| Variável | Valor |
|---|---|
| `SHAREPOINT_FORMS_URL_TEMPLATE` | a URL copiada no Passo 2 (com as sentinelas) |

Pronto — o botão do histórico vira **"Registrar via formulário"**. Sem essa
variável, o botão não aparece (nada quebra).

> Importante: se você **editar as perguntas** do formulário depois, os IDs
> internos podem mudar; nesse caso, refaça o Passo 2 e atualize a variável.

## Passo 4 — Criar o fluxo padrão (cria o item)

Em **make.powerautomate.com** → **Fluxo de nuvem automatizado**:

1. Gatilho: **Microsoft Forms → "Quando uma nova resposta é enviada"**
   (conector padrão, sem Premium). Selecione o formulário.
2. Ação: **Microsoft Forms → "Obter os detalhes da resposta"**.
3. Ação: **SharePoint → "Criar item"** na lista **Cartas**, mapeando:

| Coluna | Valor |
|---|---|
| Título | resposta: Título |
| Responsável (Claims) | **Responder' Email** (quem enviou o formulário) |
| Área do Responsável | resposta: Área |
| Tema | resposta: Tema |
| Orgão | resposta: Órgão |
| Malha | resposta: Malha *(se for escolha múltipla, divida por vírgula)* |
| Ofício | resposta: Ofício |
| Forma de Envio | `SEI` |
| Número do Processo | resposta: Número do Processo |

Deixe em branco (preenchidos após protocolar no SEI): **Conferida?, Data de
Envio, Dilação?, Prazo com Dilação, Protocolo**.

---

## Resumo do que fica com cada um

- **Você (Microsoft):** criar o Form (Passo 1), gerar o URL com sentinelas
  (Passo 2), criar o fluxo padrão (Passo 4).
- **Você (Render):** colar a URL na env `SHAREPOINT_FORMS_URL_TEMPLATE` (Passo 3).
- **ARCA:** já pronto — gera o link pré-preenchido de cada carta.
