import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, 'server.js');
const backupPath = path.join(here, 'server.js.before-mivchat-image-update.bak');
if (!fs.existsSync(serverPath)) {
  console.error('Could not find server.js. Copy this patch file into the folder containing your MIVCHAT server.js, then run it again.');
  process.exit(1);
}
let source = fs.readFileSync(serverPath, 'utf8');
const anchor = "app.post('/api/chat', async (req, res) => {";
if (!source.includes(anchor)) {
  console.error('Could not find the expected /api/chat route. No changes were made. Keep server.js unchanged and ask for help matching your current route.');
  process.exit(1);
}
const routes = [];
if (!source.includes("app.post('/api/chat/title'")) {
  routes.push(String.raw`app.post('/api/chat/title', async (req, res) => {
  const message = String(req.body?.message || '').replace(/\s+/g, ' ').trim().slice(0, 1600);
  const reply = String(req.body?.reply || '').replace(/\s+/g, ' ').trim().slice(0, 1600);
  const fallbackTitle = (value) => {
    const words = String(value || 'New conversation').split(/\s+/).filter(Boolean).slice(0, 6);
    const title = words.join(' ').replace(/[.,!?;:]+$/g, '').slice(0, 52).trim();
    return title ? title.charAt(0).toUpperCase() + title.slice(1) : 'New conversation';
  };
  const fallback = fallbackTitle(message);
  if (!message) return res.json({ title: fallback });
  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: 'Create a short, useful title for this AI conversation. Use 2 to 6 words. Capture the topic, not the full question. No quotes, numbering, markdown, or final punctuation. Return only the title.\n\nFirst user message: ' + message + '\n\nAssistant response: ' + reply,
      config: { maxOutputTokens: 32, temperature: 0.2 },
    });
    const title = String(result.text || '').replace(/[\r\n"']+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return res.json({ title: title || fallback });
  } catch (error) {
    console.warn('MIVCHAT title generation failed; using fallback:', error?.message || error);
    return res.json({ title: fallback });
  }
});
`);
}
if (!source.includes("app.post('/api/chat/image'")) {
  routes.push(String.raw`app.post('/api/chat/image', async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim().slice(0, 2000);
  if (!prompt) return res.status(400).json({ error: 'Describe the image you want to create.' });
  try {
    const imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1';
    const result = await ai.models.generateContent({
      model: imageModel,
      contents: 'Create a high-quality image that follows this user prompt. Focus on visual composition, coherent details, and a polished result. User prompt: ' + prompt,
      config: { responseModalities: ['IMAGE'] },
    });
    const parts = result?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part) => part?.inlineData?.data);
    if (!imagePart) {
      console.error('Gemini image endpoint returned no image data.');
      return res.status(502).json({ error: 'The image model returned no image. Try a more specific prompt or check that your API key has access to image generation.' });
    }
    return res.json({
      imageData: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
      text: '🎨 Your image is ready! Preview it below or download it to your device.',
    });
  } catch (error) {
    console.error('MIVCHAT image generation failed:', error?.message || error);
    const raw = String(error?.message || '');
    const safeMessage = /quota|billing|permission|not found|unsupported|api key|model/i.test(raw)
      ? 'Image generation is unavailable for this API key or model right now. Check your Gemini API access, quota, and GEMINI_IMAGE_MODEL setting.'
      : 'Image generation failed. Please try again with a different prompt.';
    return res.status(500).json({ error: safeMessage });
  }
});
`);
}
if (routes.length === 0) {
  console.log('Both MIVCHAT endpoints already exist. No changes were made.');
  process.exit(0);
}
if (!fs.existsSync(backupPath)) fs.copyFileSync(serverPath, backupPath);
source = source.replace(anchor, routes.join('\n') + '\n' + anchor);
const styleAnchor = 'Avoid repetitive introductions and unnecessary conclusions.';
const styleRules = [
  '- Use a few relevant emojis when they improve warmth or readability; avoid emoji overload.',
  '- Make answers easy to scan with clear headings, concise sections, useful bullets, comparison tables, and readable code blocks when they help.',
  '- For suitable explanations, use simple text diagrams or structured step-by-step layouts. Do not pretend a plain-text diagram is an actual interactive graphic.',
  '- When brainstorming, choosing, or learning, invite interaction when it genuinely helps: offer a small set of next-step choices or ask one focused follow-up question, not several questions at once.',
  '- If the user asks for an illustration, logo, poster, or other artwork, help them create a clear visual prompt and use the MIVCHAT Create Image feature when available.'
].join('\n');
if (!source.includes(styleRules.split('\n')[0]) && source.includes(styleAnchor)) {
  source = source.replace(styleAnchor, styleAnchor + '\n\nVISUAL AND INTERACTIVE STYLE\n' + styleRules);
}
fs.writeFileSync(serverPath, source, 'utf8');
console.log('MIVCHAT endpoints added: ' + (source.includes("app.post('/api/chat/title'") ? 'chat titles' : '') + (source.includes("app.post('/api/chat/image'") ? ' and image generation' : '') + '. Backup saved as ' + path.basename(backupPath));
