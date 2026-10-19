
import PDFDocument from 'pdfkit';
import pptxgen from 'pptxgenjs';
import { Document, Packer, Paragraph } from 'docx';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  getFormat,
  makeFilename,
} from './registry.js';

function createPdf(content, title) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      margin: 50,
      bufferPages: true,
    });

    const chunks = [];

    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('error', reject);
    pdf.on('end', () => resolve(Buffer.concat(chunks)));

    pdf.fontSize(20).text(title);
    pdf.moveDown();
    pdf.fontSize(11).text(content, {
      lineGap: 4,
    });

    pdf.end();
  });
}

async function createWord(content, title) {
  const doc = new Document({
    creator: 'MIVCHAT',
    title,
    sections: [{
      children: [
        new Paragraph({
          text: title,
          heading: 'Heading1',
        }),
        ...String(content).split(/\r?\n/).map(
          (line) => new Paragraph({ text: line })
        ),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

async function createPowerPoint(content, title) {
  const pptx = new pptxgen();

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'MIVCHAT';
  pptx.subject = title;
  pptx.title = title;

  const lines = String(content).split(/\r?\n/);
  const linesPerSlide = 10;

  // Always create at least one slide.
  const slideCount = Math.max(
    1,
    Math.ceil(lines.length / linesPerSlide)
  );

  for (let i = 0; i < slideCount; i++) {
    const slide = pptx.addSlide();

    slide.addText(
      i === 0 ? title : `${title} — continued`,
      {
        x: 0.6,
        y: 0.4,
        w: 11,
        h: 0.7,
        fontSize: 25,
        bold: true,
      }
    );

    const slideText = lines
      .slice(i * linesPerSlide, (i + 1) * linesPerSlide)
      .join('\n');

    slide.addText(slideText, {
      x: 0.7,
      y: 1.4,
      w: 11,
      h: 5,
      fontSize: 16,
      valign: 'top',
      breakLine: false,
      fit: 'shrink',
    });
  }

  return pptx.write({ outputType: 'nodebuffer' });
}

async function createExcel(content, title) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('MIVCHAT');

  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = {
    bold: true,
    size: 16,
  };

  // Each line becomes a row in the first column.
  String(content).split(/\r?\n/).forEach((line, index) => {
    sheet.getCell(index + 3, 1).value = line;
  });

  sheet.getColumn(1).width = 60;
  sheet.getColumn(1).alignment = {
    wrapText: true,
    vertical: 'top',
  };

  return workbook.xlsx.writeBuffer();
}

async function createZip(files) {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file.content);
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6,
    },
  });

  return buffer;
}
export async function generateFile({
  content,
  format,
  title = 'MIVCHAT document',
  files,
}) {
  if (typeof format !== 'string') {
    throw new Error('A file format is required.');
  }

  const info = getFormat(format);

  if (!info) {
    throw new Error(`Unsupported format: ${format}`);
  }

  if (info.extension === 'zip') {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('A ZIP file requires at least one file.');
    }

    if (files.length > 20) {
      throw new Error('A ZIP archive can contain at most 20 files.');
    }

    for (const file of files) {
      if (
        !file ||
        typeof file.name !== 'string' ||
        typeof file.content !== 'string' ||
        !file.name.trim() ||
        file.name.includes('/') ||
        file.name.includes('\\') ||
        file.name === '.' ||
        file.name === '..'
      ) {
        throw new Error('A ZIP entry has an invalid filename or content.');
      }
    }

    const data = await createZip(files);

    return {
      data,
      filename: makeFilename(title, 'zip'),
      contentType: info.mime,
    };
  }

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('File content cannot be empty.');
  }

  if (Buffer.byteLength(content, 'utf8') > 500_000) {
    throw new Error('File content exceeds the 500 KB limit.');
  }

  let data;

  switch (info.extension) {
    case 'txt':
    case 'md':
    case 'html':
    case 'svg':
    case 'css':
    case 'js':
    case 'json':
    case 'xml':
    case 'csv':
    case 'py':
    case 'php':
    case 'sql':
    case 'c':
    case 'cpp':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'yaml':
    case 'mjs':
    case 'cjs':
    case 'scss':
    case 'less':
    case 'h':
    case 'hpp':
    case 'java':
    case 'cs':
    case 'go':
    case 'rs':
    case 'rb':
    case 'swift':
    case 'kt':
    case 'dart':
    case 'vue':
    case 'svelte':
    case 'sh':
    case 'ps1':
    case 'bat':
    case 'tsv':
    case 'yml':
    case 'toml':
    case 'ini':
    case 'log':
    case 'env':
      if (info.extension === 'json') {
        try {
          JSON.parse(content);
        } catch {
          throw new Error('The content must be valid JSON.');
        }
      }

      data = Buffer.from(content, 'utf8');
      break;

    case 'pdf':
      data = await createPdf(content, title);
      break;

    case 'docx':
      data = await createWord(content, title);
      break;

    case 'pptx':
      data = await createPowerPoint(content, title);
      break;

    case 'xlsx':
      data = await createExcel(content, title);
      break;

    default:
      throw new Error(
        `The format "${info.extension}" is registered but has no generator yet.`
      );
  }

  return {
    data: Buffer.from(data),
    filename: makeFilename(title, info.extension),
    contentType: info.mime,
  };
}
