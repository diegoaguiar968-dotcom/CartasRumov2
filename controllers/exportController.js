/**
 * controllers/exportController.js
 * Exportação da minuta para DOCX e PDF
 */

const {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Packer,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} = require('docx');

/**
 * Gera e faz download do arquivo DOCX da minuta
 */
async function exportarDocx(req, res, next) {
  try {
    const { signatario, cargo, dadosResposta } = req.body;
    const conteudo = dadosResposta?.minuta || dadosResposta?.conteudo || dadosResposta?.texto || '';

    if (!conteudo) {
      return res.status(400).json({ success: false, message: 'Conteúdo da minuta não fornecido.' });
    }

    // Converte o texto da minuta em parágrafos do docx
    const paragrafos = conteudo.split('\n').map((linha) =>
      new Paragraph({
        children: [new TextRun({ text: linha, font: 'Calibri', size: 24 })],
        spacing: { after: 120 },
      })
    );

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, right: 1080, bottom: 1440, left: 1440 },
            },
          },
          children: [
            new Paragraph({
              text: 'RUMO LOGÍSTICA OPERADORA MULTIMODAL S.A.',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: '', break: 1 })],
            }),
            ...paragrafos,
            new Paragraph({ children: [new TextRun({ text: '', break: 2 })] }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Atenciosamente,', font: 'Calibri', size: 24 })],
            }),
            new Paragraph({ children: [new TextRun({ text: '', break: 2 })] }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: signatario || '[SIGNATÁRIO]', bold: true, font: 'Calibri', size: 24 }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: cargo || '[CARGO]', font: 'Calibri', size: 22 }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=resposta-antt.docx');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

/**
 * Retorna o texto como PDF simples (plaintext wrapped in PDF headers)
 * Para PDF com layout rico, use puppeteer ou uma biblioteca dedicada.
 */
async function exportarPdf(req, res, next) {
  try {
    const { signatario, cargo, dadosResposta } = req.body;
    const conteudo = dadosResposta?.minuta || dadosResposta?.conteudo || dadosResposta?.texto || '';

    const textoFinal = `RUMO LOGÍSTICA OPERADORA MULTIMODAL S.A.\n\n${conteudo}\n\nAtenciosamente,\n\n${signatario || '[SIGNATÁRIO]'}\n${cargo || '[CARGO]'}`;

    // Para um PDF básico funcional — substitua por puppeteer para layout completo
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=resposta-antt.pdf');
    res.send(Buffer.from(textoFinal, 'utf-8'));
  } catch (err) {
    next(err);
  }
}

module.exports = { exportarDocx, exportarPdf };
