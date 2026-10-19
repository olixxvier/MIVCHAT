
import { generateFile } from './generate.js';
import { writeFile } from 'node:fs/promises';

const sampleText = `
MIVCHAT File Generation Test

1. TXT: plain text files.
2. PDF: portable documents.
3. DOCX: Word documents.
4. PPTX: PowerPoint presentations.
5. XLSX: Excel workbooks.

The goal is to create real files in different formats.
`;

const tests = [
  { format: 'txt', title: 'Test Text' },
  { format: 'pdf', title: 'Test PDF' },
  { format: 'docx', title: 'Test Word' },
  { format: 'pptx', title: 'Test Slides' },
  { format: 'xlsx', title: 'Test Spreadsheet' },
];

for (const test of tests) {
  try {
    const result = await generateFile({
      content: sampleText,
      format: test.format,
      title: test.title,
    });

    await writeFile(result.filename, result.data);

    console.log(
      `SUCCESS: ${result.filename} (${result.data.length} bytes)`
    );
  } catch (error) {
    console.error(`FAILED: ${test.format}`, error.message);
  }
}

try {
  const zip = await generateFile({
    format: 'zip',
    title: 'MIVCHAT ZIP Test',
    files: [
      {
        name: 'hello.txt',
        content: 'Hello from MIVCHAT!',
      },
      {
        name: 'index.html',
        content: '<h1>Hello from MIVCHAT</h1>',
      },
    ],
  });

  await writeFile(zip.filename, zip.data);

  console.log(
    `SUCCESS: ${zip.filename} (${zip.data.length} bytes)`
  );
} catch (error) {
  console.error('FAILED: zip', error.message);
}
