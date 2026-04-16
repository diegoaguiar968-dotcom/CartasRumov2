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

// Upload de modelos (PDFs de cartas anteriores)
app.post('/api/models/upload', upload.array('files'), async (req, res) => {
  try {
    console.log('Recebendo modelos:', req.files?.length, 'arquivos');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nenhum arquivo enviado' 
      });
    }

    const arquivosProcessados = [];

    for (const file of req.files) {
      try {
        // Ler e extrair texto do PDF
        const dataBuffer = fs.readFileSync(file.path);
        const pdfData = await pdfParse(dataBuffer);
        
        const modelo = {
          id: Date.now() + Math.random(),
          nome: file.originalname,
          tamanho: file.size,
          textoExtraido: pdfData.text.substring(0, 5000), // Primeiros 5000 caracteres
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
    res.status(500).json({
      success: false,
      message: 'Erro ao processar arquivos',
      error: error.message
    });
  }
});

// Upload do ofício recebido
app.post('/api/oficio/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Recebendo ofício');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo enviado'
      });
    }

    // Extrair texto do PDF
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);

    const oficio = {
      id: Date.now(),
      nome: req.file.originalname,
      texto: pdfData.text,
      dataUpload: new Date().toISOString(),
      caminho: req.file.path
    };

    oficiosProcessados.push(oficio);

    // Análise simples do conteúdo (simulação)
    const analise = {
      assunto: extrairAssunto(pdfData.text),
      dataReferencia: extrairData(pdfData.text),
      numeroOficio: extrairNumeroOficio(pdfData.text),
      solicitacoes: extrairSolicitacoes(pdfData.text)
    };

    res.json({
      success: true,
      message: 'Ofício processado com sucesso',
      content: {
        texto: pdfData.text.substring(0, 3000),
        analise: analise,
        nomeArquivo: req.file.originalname
      }
    });

  } catch (error) {
    console.error('Erro no upload do ofício:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar ofício',
      error: error.message
    });
  }
});

// Gerar minuta de resposta (DOCX)
app.post('/api/export/docx', async (req, res) => {
  try {
    const { signatario, cargo, dadosResposta } = req.body;
    
    console.log('Gerando DOCX para:', signatario);

    // Criar documento Word
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: 'RUMO MALHA PAULISTA S/A',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({
            text: `Ofício de Resposta à ANTT`,
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Assunto: ', bold: true }),
              new TextRun({ text: dadosResposta?.assunto || 'Resposta ao Ofício da ANTT' })
            ]
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: dadosResposta?.conteudo || gerarConteudoPadrao(dadosResposta)
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Atenciosamente,' })
            ]
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: signatario || 'Nome do Signatário', bold: true })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: cargo || 'Cargo' })
            ]
          })
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=resposta-antt.docx');
    res.send(buffer);

  } catch (error) {
    console.error('Erro ao gerar DOCX:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar documento',
      error: error.message
    });
  }
});

// Gerar PDF
app.post('/api/export/pdf', async (req, res) => {
  try {
    const { signatario, cargo, dadosResposta } = req.body;
    
    console.log('Gerando PDF para:', signatario);

    // Por enquanto, retorna um PDF simples de exemplo
    // Em produção, você usaria Puppeteer ou similar
    const pdfContent = `
      RUMO MALHA PAULISTA S/A
      
      Ofício de Resposta à ANTT
      
      Assunto: ${dadosResposta?.assunto || 'Resposta ao Ofício da ANTT'}
      
      ${dadosResposta?.conteudo || gerarConteudoPadrao(dadosResposta)}
      
      Atenciosamente,
      
      ${signatario || 'Nome do Signatário'}
      ${cargo || 'Cargo'}
    `;

    // Criar um PDF simples usando um buffer
    // Nota: Em produção, use Puppeteer para gerar PDF de verdade
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=resposta-antt.pdf');
    
    // Retorna um PDF básico (placeholder)
    // Para PDF real, seria necessário usar puppeteer ou pdfkit
    res.send(Buffer.from(pdfContent));

  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao gerar PDF',
      error: error.message
    });
  }
});

// Status da API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    modelosCarregados: modelosProcessados.length,
    oficiosProcessados: oficiosProcessados.length
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
  
  return solicitacoes.length > 0 ? solicitacoes : ['Nenhuma solicitação específica identificada'];
}

function gerarConteudoPadrao(dados) {
  return `Prezados Senhores,

Em resposta ao ofício recebido, vimos por meio deste apresentar as informações solicitadas.

[Conteúdo da resposta será gerado com base nos modelos carregados e no ofício recebido]

Aguardamos novas orientações.

Atenciosamente.`;
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 Agente Rumo - Backend');
  console.log('='.repeat(50));
  console.log(`📡 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📊 Status: http://localhost:${PORT}/api/status`);
  console.log('='.repeat(50));
});

module.exports = app;
