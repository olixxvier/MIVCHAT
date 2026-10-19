import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, 'server.js');
const backupPath = path.join(here, 'server.js.before-research-study-modes.bak');

if (!fs.existsSync(serverPath)) {
  console.error('Could not find server.js. Put this script in the same folder as your MIVCHAT server.js.');
  process.exit(1);
}

let source = fs.readFileSync(serverPath, 'utf8');
if (source.includes('MIVCHAT_MODE_INSTRUCTIONS_V1')) {
  console.log('Research/Study mode instructions already appear to be installed. No changes made.');
  process.exit(0);
}

const routeAnchor = "app.post('/api/chat', async (req, res) => {";
if (!source.includes(routeAnchor)) {
  console.error('Could not find the expected /api/chat route. No changes made. Keep server.js unchanged and ask for a matching patch.');
  process.exit(1);
}

const promptAnchor = 'You are MIVCHAT, a helpful and thoughtful AI assistant.';
if (!source.includes(promptAnchor)) {
  console.error('Could not find the expected MIVCHAT system-prompt sentence. No changes made.');
  process.exit(1);
}

const routeIndex = source.indexOf(routeAnchor) + routeAnchor.length;
const routeTail = source.slice(routeIndex);
const startedAtMatch = routeTail.match(/\n([ \t\u00a0]*)const startedAt = Date\.now\(\);/);
if (!startedAtMatch) {
  console.error('Could not find the expected request start marker. No changes made.');
  process.exit(1);
}

const startedAtLine = startedAtMatch[0];
const indent = startedAtMatch[1];
const modeSetup = `${startedAtLine}
${indent}const requestedMode = ['normal', 'research', 'study'].includes(req.body?.mode) ? req.body.mode : 'normal';
${indent}const modeInstructions = requestedMode === 'research'
${indent}  ? 'MIVCHAT_MODE_INSTRUCTIONS_V1\\nRESEARCH MODE: Treat the question as a research task. Prefer verified evidence over confident guesses. Use web-search/source context supplied to you when available. Clearly distinguish sourced facts, reasonable inference, and uncertainty. Provide useful source links or citations only when real source URLs are present in the context; never invent citations, titles, quotes, or browsing actions. If no sources were retrieved, say so when relevant and do not pretend that web research occurred. For current or disputed claims, note dates and limitations.'
${indent}  : requestedMode === 'study'
${indent}    ? 'MIVCHAT_MODE_INSTRUCTIONS_V1\\nSTUDY MODE: Act as a patient tutor. Start from the learner’s likely level, define unfamiliar terms, and explain concepts in logical steps. For coding/math/science, explain why each step works rather than dumping only the answer. Use a small worked example when helpful. When appropriate, finish with one short practice question and invite the learner to try it; do not force a quiz when the user asks for a direct concise answer. Correct mistakes kindly and explain them.'
${indent}    : '';`;

source = source.slice(0, routeIndex) + routeTail.replace(startedAtLine, modeSetup, 1);
source = source.replace(promptAnchor, `${promptAnchor}\n\n${'${modeInstructions}'}`);

if (!fs.existsSync(backupPath)) fs.copyFileSync(serverPath, backupPath);
fs.writeFileSync(serverPath, source, 'utf8');
console.log('Research and Study modes enabled. Backup saved as ' + path.basename(backupPath));
