# 🚀 Guia de Deploy - Agente Rumo

Este guia explica como colocar a aplicação Agente Rumo no ar para seus colegas de trabalho usarem.

---

## 📋 Visão Geral

A aplicação tem duas partes:
1. **Frontend** (React) - Interface do usuário
2. **Backend** (Node.js) - Processa PDFs e gera documentos

---

## Opção 1: Deploy Completo (Recomendado) ⭐

### Passo 1: Deploy do Backend

#### Opção A: Render (Gratuito e Mais Fácil)

1. **Crie uma conta gratuita** em [render.com](https://render.com)

2. **Faça upload do backend:**
   - Compacte a pasta `backend/` em um arquivo ZIP
   - No Render, clique em "New" → "Web Service"
   - Faça upload do ZIP ou conecte seu GitHub

3. **Configure o serviço:**
   - **Name:** `agente-rumo-api`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free

4. **Clique em "Create Web Service"**

5. **Aguarde o deploy** (2-3 minutos)

6. **Anote a URL** (ex: `https://agente-rumo-api.onrender.com`)

#### Opção B: Railway (Gratuito)

1. Crie conta em [railway.app](https://railway.app)
2. Novo projeto → Deploy from GitHub repo
3. Selecione seu repositório
4. Railway detecta automaticamente o Node.js
5. Aguarde o deploy

---

### Passo 2: Configurar o Frontend

1. **Edite o arquivo `index.html`** na pasta do frontend:

```html
<!-- Adicione antes do </head> -->
<script>
  window.API_URL = 'https://agente-rumo-api.onrender.com'; // URL do seu backend
</script>
```

2. **Ou use a versão já configurada** que vou preparar

---

### Passo 3: Deploy do Frontend

#### Opção A: Netlify (Gratuito)

1. Crie conta em [netlify.com](https://netlify.com)
2. Arraste a pasta `dist/` para a área de deploy
3. Pronto! Anote a URL

#### Opção B: Vercel (Gratuito)

1. Crie conta em [vercel.com](https://vercel.com)
2. Importe seu projeto
3. Deploy automático

#### Opção C: GitHub Pages (Gratuito)

1. Suba o código para um repositório GitHub
2. Vá em Settings → Pages
3. Selecione a branch e pasta `/dist`
4. Ative o GitHub Pages

---

## Opção 2: Solução Mais Simples (Sem Backend) 🎯

Se você só precisa da interface para demonstração:

1. Use a versão atual já deployada:
   - **URL:** https://4j2wvokt7rpxg.ok.kimi.link
   - Funciona sem backend (simula o processamento)
   - Ideal para testes e demonstrações

---

## Opção 3: Deploy Local na Rede da Empresa 🏢

Para uso interno na empresa:

### No computador servidor:

```bash
# 1. Instale Node.js (https://nodejs.org)

# 2. Baixe o backend
cd backend
npm install
npm start

# 3. O servidor estará rodando na porta 5000
# Acesse: http://localhost:5000
```

### Para acessar de outros computadores:

1. Descubra o IP do servidor:
```bash
ipconfig  # Windows
ifconfig  # Linux/Mac
```

2. No frontend, configure:
```javascript
window.API_URL = 'http://192.168.1.100:5000'; // IP do servidor
```

3. Acesse de qualquer computador na mesma rede:
```
http://192.168.1.100:5000
```

---

## 📁 Estrutura de Arquivos

```
agente-rumo/
├── backend/              # Backend Node.js
│   ├── server.js
│   ├── package.json
│   └── README.md
├── frontend/             # Frontend React (dist/)
│   ├── index.html
│   └── assets/
└── DEPLOY-GUIDE.md       # Este arquivo
```

---

## 🔧 Configurações Importantes

### CORS (Cross-Origin)

O backend já está configurado para aceitar requisições de qualquer origem:

```javascript
// server.js
app.use(cors()); // Permite acesso de qualquer domínio
```

Para produção, restrinja aos domínios permitidos:

```javascript
app.use(cors({
  origin: ['https://seu-frontend.com', 'https://app.seudominio.com']
}));
```

---

## 🐛 Solução de Problemas

### Erro: "Erro ao enviar arquivos"

**Causa:** Backend não está acessível

**Solução:**
1. Verifique se o backend está rodando
2. Confira a URL no frontend
3. Teste a API: `https://sua-api.com/api/status`

### Erro: "CORS policy"

**Causa:** Domínio não permitido

**Solução:**
1. No backend, adicione o domínio do frontend:
```javascript
app.use(cors({ origin: 'https://seu-frontend.com' }));
```

### Erro: "Cannot POST /api/models/upload"

**Causa:** Endpoint não existe

**Solução:**
1. Verifique se o backend está atualizado
2. Reinicie o servidor

---

## 💰 Custos

| Serviço | Plano Gratuito | Limite |
|---------|---------------|--------|
| Render | ✅ Sim | 750 horas/mês |
| Railway | ✅ Sim | $5 crédito/mês |
| Netlify | ✅ Sim | 100GB/mês |
| Vercel | ✅ Sim | 100GB/mês |

**Para uso interno:** Gratuito (servidor próprio)

---

## 📞 Suporte

Em caso de problemas:

1. Verifique os logs do backend
2. Teste os endpoints com Postman/Insomnia
3. Verifique a console do navegador (F12)

---

## ✅ Checklist de Deploy

- [ ] Backend deployado e acessível
- [ ] URL do backend anotada
- [ ] Frontend configurado com URL do backend
- [ ] Frontend deployado
- [ ] Teste de upload de PDF realizado
- [ ] Teste de geração de documento realizado
- [ ] URL compartilhada com a equipe

---

**Pronto!** 🎉 Sua aplicação está no ar e seus colegas podem acessar!
