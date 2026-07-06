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

## As 14 colunas da lista — o que o ARCA preenche

| Coluna | ARCA preenche? | Sentinela / observação |
|---|---|---|
| Número da Carta | ✅ | `ZZTITULOZZ` (0000/GREG/2026) |
| E-mail do Responsável | ✅ | `ZZEMAILZZ` |
| Área do Responsável | ✅ | `ZZAREAZZ` |
| Data de envio | ⬜ | preencher após protocolar no SEI |
| Tema | ✅ | `ZZTEMAZZ` |
| Órgão | ✅ | `ZZORGAOZZ` (ANTT) |
| Malha | ✅ | `ZZMALHAZZ` — opções: RMP, RMC, RMN, RMS, RMO, RSA, Todas as malhas |
| Ofício | ✅ | `ZZOFICIOZZ` |
| Dilação? | ⬜ | Sim/Não — após |
| Prazo com Dilação | ⬜ | após |
| Forma de Envio | ✅ | `ZZFORMAZZ` — opções: SEI, E-mail, Presencialmente (padrão SEI) |
| Protocolo | ⬜ | após |
| Número do Processo | ✅ | `ZZPROCESSOZZ` |
| Assuntos | ✅ | `ZZASSUNTOSZZ` — opções: patrimônio, ativos, passivos, interferências, DUP, investimentos obrigatórios, obrigações contratuais, indicadores, acidentes, solicitação de acesso, fiscalização, RDT e RPMF, resposta a ofício, outro |

Sentinela extra: `ZZRESPONSAVELZZ` (nome do responsável), `ZZORGAOZZ`.

## Passo 1 — Criar o Microsoft Form

Crie **uma pergunta por coluna que o ARCA preenche** (as demais — Data de envio,
Dilação?, Prazo com Dilação, Protocolo — ficam de fora do Form; são preenchidas
na lista após protocolar):

- Número da Carta *(texto)*
- E-mail do Responsável *(texto)*
- Área do Responsável *(texto)*
- Tema *(texto)*
- Órgão *(texto)*
- Malha *(escolha: RMP, RMC, RMN, RMS, RMO, RSA, Todas as malhas)*
- Ofício *(texto)*
- Forma de Envio *(escolha: SEI, E-mail, Presencialmente)*
- Número do Processo *(texto)*
- Assuntos *(escolha: as 14 opções acima)*

> Para os campos de **escolha** (Malha, Forma de Envio, Assuntos), o valor que o
> ARCA envia precisa bater **exatamente** com o texto da opção. O ARCA já envia
> nesse padrão (ex.: Forma de Envio = `SEI`, Assuntos = `resposta a ofício`).

## Passo 2 — Gerar o "URL pré-preenchido" com as SENTINELAS

No Forms: **Coletar respostas → ⋯ → Obter URL pré-preenchida** (Get pre-filled
URL). Preencha **cada campo com exatamente estas palavras** (copie e cole):

| Campo | Digite exatamente |
|---|---|
| Número da Carta | `ZZTITULOZZ` |
| E-mail do Responsável | `ZZEMAILZZ` |
| Área do Responsável | `ZZAREAZZ` |
| Tema | `ZZTEMAZZ` |
| Órgão | `ZZORGAOZZ` |
| Malha | `ZZMALHAZZ` |
| Ofício | `ZZOFICIOZZ` |
| Forma de Envio | `ZZFORMAZZ` |
| Número do Processo | `ZZPROCESSOZZ` |
| Assuntos | `ZZASSUNTOSZZ` |

Clique em **Obter link** e **copie a URL inteira**. Ela terá as sentinelas
embutidas (ex.: `...&abc123=ZZTITULOZZ&def456=ZZTEMAZZ...`). O ARCA substitui
cada sentinela pelo valor real da carta, já com a codificação correta.

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
| Número da Carta | resposta: Número da Carta |
| E-mail do Responsável | resposta: E-mail do Responsável |
| Área do Responsável | resposta: Área do Responsável |
| Tema | resposta: Tema |
| Orgão | resposta: Órgão |
| Malha | resposta: Malha *(se for escolha múltipla, divida por vírgula)* |
| Ofício | resposta: Ofício |
| Forma de Envio | resposta: Forma de Envio |
| Número do Processo | resposta: Número do Processo |
| Assuntos | resposta: Assuntos |

Deixe em branco (preenchidos após protocolar no SEI): **Data de Envio, Dilação?,
Prazo com Dilação, Protocolo**. (E, se existir, "Conferida?".)

---

## Resumo do que fica com cada um

- **Você (Microsoft):** criar o Form (Passo 1), gerar o URL com sentinelas
  (Passo 2), criar o fluxo padrão (Passo 4).
- **Você (Render):** colar a URL na env `SHAREPOINT_FORMS_URL_TEMPLATE` (Passo 3).
- **ARCA:** já pronto — gera o link pré-preenchido de cada carta.
