# Agente Rumo - Backend

Backend para a aplicação Agente Rumo - Respostas à ANTT.

## Funcionalidades

- 📤 Upload de PDFs (modelos de cartas)
- 📄 Extração de texto de PDFs
- 📝 Geração de documentos DOCX
- 📑 Geração de PDFs

## Instalação

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Ou iniciar servidor de produção
npm start
```

## Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/models/upload` | Upload de múltiplos PDFs de modelos |
| POST | `/api/oficio/upload` | Upload do ofício recebido |
| POST | `/api/export/docx` | Gerar documento Word |
| POST | `/api/export/pdf` | Gerar documento PDF |
| GET | `/api/status` | Verificar status da API |

## Deploy

### Opção 1: Render (Gratuito)

1. Crie uma conta em [render.com](https://render.com)
2. Clique em "New Web Service"
3. Conecte seu repositório GitHub ou faça upload do código
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Clique em "Create Web Service"

### Opção 2: Railway (Gratuito)

1. Crie uma conta em [railway.app](https://railway.app)
2. Crie um novo projeto
3. Faça deploy do código
4. A Railway detectará automaticamente o Node.js

### Opção 3: VPS/Próprio Servidor

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd backend

# Instale as dependências
npm install

# Inicie com PM2 (recomendado para produção)
npm install -g pm2
pm2 start server.js --name "agente-rumo"
pm2 startup
pm2 save
```

## Configuração do Frontend

Após fazer o deploy do backend, atualize o frontend com a URL da API:

```javascript
// No arquivo de configuração do frontend
const API_URL = 'https://seu-backend.onrender.com'; // ou sua URL
```

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
PORT=5000
NODE_ENV=production
```

## Estrutura de Pastas

```
backend/
├── uploads/          # PDFs enviados (criado automaticamente)
├── server.js         # Código principal
├── package.json
├── .env
└── README.md
```

## Suporte

Em caso de dúvidas, entre em contato com a equipe de TI.
