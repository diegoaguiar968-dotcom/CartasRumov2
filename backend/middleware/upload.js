/**
 * middleware/upload.js
 * Configuração do multer para recebimento de PDFs
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${unique}${path.extname(file.originalname)}`);
  },
});

const somentePdf = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Apenas arquivos PDF são permitidos'), false);
  }
};

// Documentos complementares aceitam qualquer formato (docx, xlsx, zip, imagens...).
// Executáveis são barrados por segurança — não há motivo para anexá-los a uma carta.
const EXTENSOES_BLOQUEADAS = [
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.ps1', '.sh', '.jar', '.app', '.dll',
];

const qualquerFormato = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (EXTENSOES_BLOQUEADAS.includes(ext)) {
    cb(new Error(`Arquivos ${ext} não são permitidos por segurança.`), false);
  } else {
    cb(null, true);
  }
};

/** Upload restrito a PDF — ofício principal da ANTT e modelos de referência. */
const uploadPdf = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: somentePdf,
});

/** Upload livre — documentos complementares (nota técnica, planilhas, anexos). */
const uploadLivre = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB (zips e planilhas pesam mais)
  fileFilter: qualquerFormato,
});

module.exports = { uploadPdf, uploadLivre };
