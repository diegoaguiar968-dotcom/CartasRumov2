# ARCA — Código-fonte do Frontend

Este é o código-fonte React + TypeScript + Vite que gera o bundle publicado em
`frontend/app/dist/`. **Sempre edite aqui, nunca edite o bundle compilado diretamente.**

## Como rodar localmente

```bash
cd frontend/source
npm install
npm run dev
```

## Como gerar um novo bundle de produção

```bash
cd frontend/source
npm install
npx vite build
```

Isso gera `client/dist/index.html` + `client/dist/assets/*`. Copie esses arquivos
para `frontend/app/dist/` (substituindo os antigos) e faça commit — o Netlify
publica automaticamente a partir de `frontend/app/dist/`.

## Estrutura

- `client/src/App.tsx` — componente principal, todas as 5 etapas do fluxo
- `client/src/lib/api.ts` — camada de chamadas ao backend (Render)
- `client/src/components/identify-widget.tsx` — widget "Identifique-se" (grava
  responsável/área no `localStorage`, usado no histórico)
- `client/src/index.css` — tema de cores (variáveis HSL, tokens `--surface-*`,
  `--rumo-green`, etc.) e componentes utilitários (`.step-pill`, `.info-card`,
  `.upload-zone`, `.badge-active`)

## Contrato com o backend

O frontend espera os endpoints em `backend/routes/*.js` do repositório. Principais:

- `GET /api/models/templates`
- `POST /api/oficio/upload`
- `POST /api/minuta/generate` (resposta a ofício)
- `POST /api/minuta/generate-espontanea` (carta espontânea)
- `POST /api/minuta/refinar`
- `POST /api/export/docx`

Toda requisição envia o header `X-Session-ID` (isolamento por sessão) e usa
`window.API_URL`, definido em `client/index.html`, para apontar ao backend.
