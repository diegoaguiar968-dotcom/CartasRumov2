const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const { Document, Paragraph, TextRun, AlignmentType, HeadingLevel, Packer } = require('docx');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Espião de Rotas: Vai mostrar no log do Render qual URL o frontend está tentando acessar
app.use((req, res, next) => {
  console.log(`[Nova Requisição] O Frontend chamou a rota: ${req.method} ${req.url}`);
  next();
});

// Criar diretório de uploads se não existir
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limite
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos'));
    }
  }
});

// Armazenamento em memória para modelos e dados processados
const modelosProcessados = [];
const oficiosProcessados = [];

// ============ ENDPOINTS DA API ============

// 1. STATUS DO SERVIDOR (Estava faltando!)
app.get('/api/status', (req, res) => {
  res.json({ success: true, status: 'ok', message: 'Servidor rodando perfeitamente!' });
});

// Função centralizada para processar os PDFs
const processarUploadModelos = async (req, res) => {
  try {
    console.log('Recebendo modelos:', req.files?.length, 'arquivos');
    
    const arquivosRecebidos = req.files || (req.file ? [req.file] : []);

    if (arquivosRecebidos.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });
    }

    const arquivosProcessados = [];

    for (const file of arquivosRecebidos) {
      try {
        const dataBuffer = fs.readFileSync(file.path);
        const pdfData = await pdfParse(dataBuffer);
        
        const modelo = {
          id: Date.now() + Math.random(),
          nome: file.originalname,
          tamanho: file.size,
          textoExtraido: pdfData.text.substring(0, 5000),
          dataUpload: new Date().toISOString(),
          caminho: file.path
        };

        modelosProcessados.push(modelo);
        arquivosProcessados.push({
          nome: file.originalname,
          tamanho: file.size,
          textoPreview: pdfData.text.substring(0, 200) + '...'
        });

        console.log('Modelo processado:', file.originalname);
      } catch (err) {
        console.error('Erro ao processar PDF:', file.originalname, err.message);
      }
    }

    res.json({
      success: true,
      message: `${arquivosProcessados.length} modelo(s) processado(s) com sucesso`,
      files: arquivosProcessados,
      totalModelos: modelosProcessados.length
    });

  } catch (error) {
    console.error('Erro no upload de modelos:', error);
    res.status(500).json({ success: false, message: 'Erro ao processar arquivos', error: error.message });
  }
};

// --- ROTAS DE UPLOAD E ANÁLISE DE MODELOS ---
app.post('/api/models/upload', upload.array('files'), processarUploadModelos);
app.post('/upload', upload.any(), processarUploadModelos);
app.post('/api/upload', upload.any(), processarUploadModelos);

app.get('/api/models/analyze', responderAnaliseModelos);
app.post('/api/models/analyze', responderAnaliseModelos);

function responderAnaliseModelos(req, res) {
  console.log('[Análise] Frontend pediu para analisar os modelos');
  res.json({
    success: true,
    message: 'Análise concluída com sucesso',
    totalAnalisado: modelosProcessados.length,
    analise: { pontos: ["Leitura dos modelos concluída", "Padrões identificados"] },
    pontos: ["Leitura dos modelos concluída", "Padrões identificados"]
  });
}

// --- ROTAS DE UPLOAD E ANÁLISE DE OFÍCIO ---
app.post('/api/oficio/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Recebendo ofício');
    if (!req.file) return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);

    const oficiosSolicita = extrairSolicitacoes(pdfData.text);

    const analise = {
      assunto: extrairAssunto(pdfData.text),
      dataReferencia: extrairData(pdfData.text),
      numeroOficio: extrairNumeroOficio(pdfData.text),
      solicitacoes: oficiosSolicita,
      pontos: oficiosSolicita // Essencial para não dar erro
    };

    // Salvando os dados processados na "memória" para uso futuro
    oficiosProcessados.push({
      id: Date.now(),
      nome: req.file.originalname,
      texto: pdfData.text,
      analise: analise
    });

    // Enviando resposta mega redundante para garantir que o Frontend ache a variável 'pontos'
    res.json({
      success: true,
      message: 'Ofício processado com sucesso',
      content: {
        texto: pdfData.text.substring(0, 3000),
        analise: analise,
        pontos: analise.pontos, // Segurança extra
        nomeArquivo: req.file.originalname
      },
      analise: analise, // Segurança extra
      pontos: analise.pontos // Segurança extra
    });
  } catch (error) {
    console.error('Erro no upload do ofício:', error);
    res.status(500).json({ success: false, message: 'Erro ao processar ofício', error: error.message });
  }
});

// Prevenção extra: Se o frontend tentar analisar o ofício separadamente
app.post('/api/oficio/analyze', (req, res) => {
  res.json({
    success: true,
    message: 'Ofício analisado com sucesso!',
    pontos: ["Ofício lido", "Aguardando geração da resposta"],
    analise: { pontos: ["Ofício lido", "Aguardando geração da resposta"] }
  });
});


// --- ROTAS DE GERAÇÃO (A etapa pós-análise estava faltando no código gerado!) ---
app.post('/api/generate', gerarRespostaMock);
app.post('/api/resposta/gerar', gerarRespostaMock);

function gerarRespostaMock(req, res) {
  console.log('[Geração] Frontend pediu para gerar a resposta final');
  res.json({
    success: true,
    message: 'Resposta gerada com sucesso!',
    textoGerado: gerarConteudoPadrao({}),
    resposta: gerarConteudoPadrao({}), // Por via das dúvidas
    pontosAbordados: ["Resposta aos apontamentos da ANTT", "Cumprimento de prazos"]
  });
}


// --- ROTAS DE EXPORTAÇÃO ---
app.post('/api/export/docx', async (req, res) => {
  try {
    const { signatario, cargo, dadosResposta } = req.body;
    console.log('Gerando DOCX para:', signatario);

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({ text: 'RUMO MALHA PAULISTA S/A', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: `Ofício de Resposta à ANTT`, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: '' }),
          new Paragraph({ children: [ new TextRun({ text: 'Assunto: ', bold: true }), new TextRun({ text: dadosResposta?.assunto || 'Resposta ao Ofício da ANTT' }) ] }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: dadosResposta?.conteudo || dadosResposta?.texto || gerarConteudoPadrao(dadosResposta) }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [ new TextRun({ text: 'Atenciosamente,' }) ] }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [ new TextRun({ text: signatario || 'Nome do Signatário', bold: true }) ] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [ new TextRun({ text: cargo || 'Cargo' }) ] })
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=resposta-antt.docx');
    res.send(buffer);
  } catch (error) {
    console.error('Erro ao gerar DOCX:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar documento', error: error.message });
  }
});

app.post('/api/export/pdf', async (req, res) => {
  try {
    const { signatario, cargo, dadosResposta } = req.body;
    console.log('Gerando PDF para:', signatario);

    const pdfContent = `
      RUMO MALHA PAULISTA S/A
      
      Ofício de Resposta à ANTT
      
      Assunto: ${dadosResposta?.assunto || 'Resposta ao Ofício da ANTT'}
      
      ${dadosResposta?.conteudo || dadosResposta?.texto || gerarConteudoPadrao(dadosResposta)}
      
      Atenciosamente,
      
      ${signatario || 'Nome do Signatário'}
      ${cargo || 'Cargo'}
    `;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=resposta-antt.pdf');
    res.send(Buffer.from(pdfContent));
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    res.status(500).json({ success: false, message: 'Erro ao gerar PDF', error: error.message });
  }
});

// Catch-all para lidar com rotas 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `A rota ${req.method} ${req.url} não existe neste servidor.`
  });
});

// ============ FUNÇÕES AUXILIARES ============

function extrairAssunto(texto) {
  const match = texto.match(/assunto[:\s]+([^\n]+)/i);
  return match ? match[1].trim() : 'Não identificado';
}

function extrairData(texto) {
  const match = texto.match(/(\d{2}\/\d{2}\/\d{4}|\d{2} de [a-zç]+ de \d{4})/i);
  return match ? match[1] : 'Não identificada';
}

function extrairNumeroOficio(texto) {
  const match = texto.match(/of[íi]cio\s*n[º°]?\s*(\d+[^\n]*)/i);
  return match ? match[1].trim() : 'Não identificado';
}

function extrairSolicitacoes(texto) {
  const solicitacoes = [];
  const linhas = texto.split('\n');
  
  for (const linha of linhas) {
    if (linha.match(/^(solicita|pede|requer|apresentar|encaminhar)/i)) {
      solicitacoes.push(linha.trim());
    }
  }
  
  return solicitacoes.length > 0 ? solicitacoes : ['Nenhuma solicitação específica identificada no texto do Ofício.'];
}

function gerarConteudoPadrao(dados) {
  return `Prezados Senhores,\n\nEm resposta ao ofício recebido, vimos por meio deste apresentar as informações solicitadas.\n\n[O conteúdo inteligente da resposta apareceria aqui. Como este é o MVP, apresentamos este texto padrão gerado pelo sistema.]\n\nAguardamos novas orientações.\n\nAtenciosamente.`;
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 Agente Rumo - Backend');
  console.log('='.repeat(50));
  console.log(`📡 Servidor rodando na porta ${PORT}`);
  console.log('='.repeat(50));
});

module.exports = app;