import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  MessageCircle, Plus, Search, Sun, Moon, Settings,
  Paperclip, Mic, Send, Sparkles, UserRound, X, Trash2,
  Menu, FileText, ImagePlus, Download, Apple, Mail, LoaderCircle,
  ShieldCheck, PanelLeftClose, LogIn, Pencil, Copy,
  RefreshCw, Check, ChevronDown, AlertCircle, Eye, EyeOff, Play, BookOpen, Globe2,
  Archive, Bookmark, Image, GraduationCap, Layers, ListChecks, SlidersHorizontal,
  ArrowRight, ArrowUpRight, Code2, Terminal, Star, Zap
} from 'lucide-react';

import 'highlight.js/styles/github-dark.css';
import './App.css';
import './App.workspace.css';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { supabase } from './lib/supabaseClient';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub, FaDiscord } from 'react-icons/fa';
const API_BASE = (
  import.meta.env.VITE_API_URL || 'http://localhost:3001'
).replace(/\/$/, '');

const API_URL = `${API_BASE}/api/chat`;

function createId() {
  return crypto.randomUUID();
}

function createChat() {
  return {
    id: createId(),
    title: 'New chat',
    messages: [],
    updatedAt: Date.now(),
  };
}


// Recover once when Supabase returns an expired access-token error.
function isExpiredSessionError(error) {
  const message = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean).join(' ').toLowerCase();
  return /jwt expired|token has expired|expired jwt|invalid jwt|pgrst301|refresh token|not authenticated|unauthorized|\b401\b/.test(message);
}

async function runSupabaseQueryWithRefresh(queryFactory) {
  let result = await queryFactory();
  if (!result?.error || !isExpiredSessionError(result.error)) return result;

  const { data, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !data?.session) {
    throw new Error('Your sign-in session could not be refreshed. Please sign out and sign in again. Your saved chats have not been deleted.');
  }

  // Retry the exact same database operation once using the refreshed session.
  result = await queryFactory();
  if (result?.error) throw result.error;
  return result;
}
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeType(file) {
  if (file.type) return file.type;

  const extension = file.name.split('.').pop().toLowerCase();

  const types = {
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    js: 'text/javascript',
    jsx: 'text/javascript',
    ts: 'text/plain',
    tsx: 'text/plain',
    py: 'text/x-python',
    php: 'text/x-php',
    html: 'text/html',
    css: 'text/css',
    c: 'text/plain',
    cpp: 'text/plain',
    h: 'text/plain',
    hpp: 'text/plain',
    sql: 'text/plain',
    xml: 'application/xml',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };

  return types[extension] || 'application/octet-stream';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== 'string' || !result.includes(',')) {
        reject(new Error(`Could not read ${file.name}.`));
        return;
      }

      resolve(result.slice(result.indexOf(',') + 1));
    };

    reader.onerror = () => {
      reject(new Error(`Could not read ${file.name}.`));
    };

    reader.readAsDataURL(file);
  });
}

function needsLocalContext(message) {
  return /\b(weather|forecast|near me|nearby|around me|my location|where am i|local news|traffic here|places around|businesses near)\b/i.test(message || '');
}

function hasExplicitPlace(message) {
  return /\b(?:in|near|around|at)\s+(?!me\b|my\b|here\b|there\b|the\b|nearby\b)([a-z][a-z-]*(?:\s+[a-z][a-z-]*){0,2})\b/i.test(message || '');
}

async function getLocationContextForMessage(message) {
  if (!needsLocalContext(message) || hasExplicitPlace(message)) return '';

  if (!navigator.geolocation) {
    return 'The browser did not provide geolocation. Ask the user for a city or area instead of guessing their location.';
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = Number(coords.latitude.toFixed(4));
        const longitude = Number(coords.longitude.toFixed(4));
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            { headers: { Accept: 'application/json' } }
          );
          if (!response.ok) throw new Error('Reverse geocoding unavailable');
          const place = await response.json();
          const address = place.address || {};
          const area = [
            address.city || address.town || address.village || address.suburb || address.county,
            address.state || address.region,
            address.country,
          ].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index);
          resolve(
            area.length
              ? `The user allowed browser location access. Approximate location: ${area.join(', ')}. Coordinates: ${latitude}, ${longitude}. Use this only for the current request.`
              : `The user allowed browser location access. Coordinates: ${latitude}, ${longitude}. Use these only for the current request.`
          );
        } catch {
          resolve(`The user allowed browser location access. Approximate coordinates: ${latitude}, ${longitude}. Use these only for the current request.`);
        }
      },
      () => resolve('The user did not share browser location, or location access failed. Ask for a city or area if needed; do not assume one.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}

function fallbackChatTitle(message) {
  const cleaned = String(message || '')
    .replace(/\[Location context for this request:[\s\S]*?\]/gi, '')
    .replace(/https?:\/\/\S+/gi, 'link')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'File analysis';
  const words = cleaned.split(' ').slice(0, 7);
  let title = words.join(' ').replace(/[.,!?;:]+$/g, '');
  if (title.length > 52) title = `${title.slice(0, 49).trimEnd()}…`;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

async function generateChatTitle(message, reply = '') {
  const fallback = fallbackChatTitle(message);
  try {
    const response = await fetch(`${API_BASE}/api/chat/title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ message: String(message || '').slice(0, 1600), reply: String(reply || '').slice(0, 1600) }),
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    const title = String(data.title || '').replace(/[\r\n\"'`]+/g, '').trim();
    return title ? title.slice(0, 60) : fallback;
  } catch {
    return fallback;
  }
}

async function requestAI(messages, files = [], locationContext = '', onChunk, mode = 'normal', preferences = {}) {
  const encodedFiles = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      mimeType: getMimeType(file),
      size: file.size,
      data: await fileToBase64(file),
    }))
  );

  const response = await fetch(API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(90000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map(({ role, content }, index) => {
        const isLastUserMessage = index === messages.length - 1 && role === 'user';
        const locationNote = isLastUserMessage && locationContext ? `${content ? '\n\n' : ''}[Location context for this request: ${locationContext}]` : '';
        const responseNote = isLastUserMessage && preferences.responseLength
          ? `\n\n[Response length preference: ${preferences.responseLength === 'concise' ? 'be concise and direct while preserving essential details' : preferences.responseLength === 'detailed' ? 'give a thorough explanation with examples where useful' : 'use a balanced level of detail'}]`
          : '';
        return { role, content: `${content}${locationNote}${responseNote}` };
      }),
      files: encodedFiles,
      mode: ['normal', 'research', 'study'].includes(mode) ? mode : 'normal',
      clientContext: {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        locale: navigator.language || 'en',
        responseLength: preferences.responseLength || 'balanced',
      },
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    let message = bodyText || `The request failed (${response.status}).`;
    try { message = JSON.parse(bodyText).error || message; } catch { /* Keep plain-text error. */ }
    throw new Error(message);
  }

  const contentType = response.headers.get('content-type') || '';
  // Compatibility with an older backend response while server.js is restarted.
  if (!contentType.includes('text/event-stream')) {
    const bodyText = await response.text();
    let data;
    try { data = JSON.parse(bodyText); }
    catch { throw new Error(bodyText || 'The server returned an invalid response.'); }
    const reply = data.reply ?? data.text;
    if (typeof reply !== 'string' || !reply.trim()) throw new Error(data.error || 'The AI returned an empty response.');
    return reply.trim();
  }

  if (!response.body) throw new Error('The server opened a stream without a response body.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';

  function processEvent(block) {
    if (!block.trim()) return;
    let eventName = 'message';
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    let payload;
    try { payload = JSON.parse(dataLines.join('\n')); }
    catch { throw new Error('MIVCHAT sent a malformed streaming response.'); }
    if (eventName === 'error' || payload.error) throw new Error(payload.error || 'MIVCHAT could not complete the response.');
    if (typeof payload.text === 'string') {
      answer += payload.text;
      onChunk?.(payload.text);
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        processEvent(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
      if (done) break;
    }
    if (buffer.trim()) processEvent(buffer);
  } finally {
    reader.releaseLock();
  }

  if (!answer.trim()) throw new Error('The AI returned an empty response. Check the backend terminal for the underlying error.');
  return answer.trim();
}


function CodeBlock({ children, onPreview }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  function getText(node) {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getText).join('');
    if (node?.props?.children !== undefined) return getText(node.props.children);
    return '';
  }

  const codeElement = Array.isArray(children)
    ? children.find((child) => child?.props)
    : children;
  const code = getText(codeElement);
  const className = codeElement?.props?.className || '';
  let language = className.match(/language-([\w+-]+)/)?.[1]?.toLowerCase() || '';

  if (!language && /<!doctype html|<html[\s>]|<body[\s>]|<div[\s>]|<h[1-6][\s>]/i.test(code)) {
    language = 'html';
  }

  const canPreview = ['html', 'htm', 'svg'].includes(language);
  const languageClass = language.replace(/[^a-z0-9-]/g, '') || 'plain';
  const lineCount = code ? code.split('\n').length : 0;
  const isLong = lineCount > 18;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy your code:', code);
    }
  }

  return (
    <div className={`code-block-shell lang-${languageClass} code-language-${languageClass}`}>
      <div className="code-block-toolbar">
        <span className={`code-language language-badge-${languageClass}`}>
          {language || 'code'}
        </span>
        <div className="code-block-actions">
          <button
            type="button"
            className="code-icon-button"
            onClick={copyCode}
            title={copied ? 'Copied!' : 'Copy code'}
            aria-label={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            type="button"
            className="code-icon-button"
            onClick={() => onPreview?.(code, language)}
            title={canPreview ? 'Preview in workspace' : 'Preview is available for HTML and SVG'}
            aria-label="Preview code"
            disabled={!canPreview}
          >
            <Play size={16} />
          </button>
        </div>
      </div>
      {/* Keep the original highlighted code element. Rebuilding it from a plain
          string would discard the <span class="hljs-*"> token colors. */}
      <pre className={isLong && !expanded ? 'code-pre-collapsed' : ''}>
        {codeElement}
      </pre>
      {isLong && (
        <button
          type="button"
          className="code-show-more"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : `Show more (${lineCount} lines)`}
          <ChevronDown size={15} className={expanded ? 'code-chevron-up' : ''} />
        </button>
      )}
    </div>
  );
}

const MIVCHAT_IMAGE_DB = 'mivchat-image-library';
const MIVCHAT_IMAGE_STORE = 'generated-images';

function openMivchatImageDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('Image library storage is unavailable in this browser.')); return; }
    const request = window.indexedDB.open(MIVCHAT_IMAGE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MIVCHAT_IMAGE_STORE)) db.createObjectStore(MIVCHAT_IMAGE_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open image library.'));
  });
}

async function readMivchatImages() {
  const db = await openMivchatImageDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(MIVCHAT_IMAGE_STORE, 'readonly').objectStore(MIVCHAT_IMAGE_STORE).getAll();
    request.onsuccess = () => { db.close(); resolve((request.result || []).sort((a, b) => b.createdAt - a.createdAt)); };
    request.onerror = () => { db.close(); reject(request.error || new Error('Could not read image library.')); };
  });
}

async function saveMivchatImage(item) {
  const db = await openMivchatImageDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MIVCHAT_IMAGE_STORE, 'readwrite');
    transaction.objectStore(MIVCHAT_IMAGE_STORE).put(item);
    transaction.oncomplete = () => { db.close(); resolve(item); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Could not save image.')); };
  });
}

async function deleteMivchatImage(id) {
  const db = await openMivchatImageDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MIVCHAT_IMAGE_STORE, 'readwrite');
    transaction.objectStore(MIVCHAT_IMAGE_STORE).delete(id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Could not remove image.')); };
  });
}

function LandingPage({ isLight, onToggleTheme, onEnter, onSignIn, onSignUp }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('Suggestion');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [showFeaturePage, setShowFeaturePage] = useState(false);
  const [extraPage, setExtraPage] = useState('');
  const [featureCategory, setFeatureCategory] = useState('All');
  const [featureSearch, setFeatureSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const updateScroll = () => {
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - window.innerHeight;
      setScrollProgress(maxScroll > 0 ? Math.min(100, (window.scrollY / maxScroll) * 100) : 0);
      setShowScrollTop(window.scrollY > 520);
    };
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll);
    return () => {
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, [showFeaturePage]);

  useEffect(() => {
    const root = document.querySelector('.mivchat-landing');
    if (!root) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = root.querySelectorAll('main > section, .landing-feature-card, .landing-directory-card, .landing-faq-item, .landing-step, .landing-usecase-card, .landing-about-value, .landing-help-card, .landing-roadmap-card');
    if (reducedMotion || !('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-revealed'));
      return undefined;
    }
    targets.forEach((target) => target.classList.add('landing-reveal'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-revealed');
        else entry.target.classList.remove('is-revealed');
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [showFeaturePage, extraPage]);

  const featureCatalog = [
    { icon: <MessageCircle size={21} />, title: 'AI conversations', category: 'Chat', description: 'Ask questions, brainstorm, request explanations, and continue with follow-up prompts.', status: 'Available', tags: 'chat conversation answers prompts' },
    { icon: <Code2 size={21} />, title: 'Coding assistant', category: 'Coding', description: 'Write, explain, debug, and improve code across common programming languages.', status: 'Available', tags: 'code javascript python php c cpp sql' },
    { icon: <Layers size={21} />, title: 'Syntax-highlighted code', category: 'Coding', description: 'Read code in a formatted code block with language-aware highlighting and copy controls.', status: 'Available', tags: 'syntax highlight copy code' },
    { icon: <Eye size={21} />, title: 'HTML and SVG preview', category: 'Coding', description: 'Open a live preview for supported HTML and SVG snippets inside the workspace.', status: 'Available', tags: 'preview html svg web' },
    { icon: <ImagePlus size={21} />, title: 'AI image generation', category: 'Creative', description: 'Describe an image and use the image-generation mode when the configured image service is available.', status: 'Service required', tags: 'image generate art creative picture' },
    { icon: <Paperclip size={21} />, title: 'File attachments', category: 'Files', description: 'Attach supported documents, text, code, spreadsheets, presentations, and images to a prompt.', status: 'Available', tags: 'upload attach pdf docx pptx xlsx image' },
    { icon: <Download size={21} />, title: 'Download generated content', category: 'Files', description: 'Save supported generated text or code content as a file from the workspace.', status: 'Available', tags: 'download export file save' },
    { icon: <Image size={21} />, title: 'Image gallery', category: 'Creative', description: 'Review generated images in the workspace gallery and access available image actions.', status: 'Available', tags: 'gallery images generated' },
    { icon: <Search size={21} />, title: 'Find conversations', category: 'Productivity', description: 'Search chat titles to get back to a conversation more quickly.', status: 'Available', tags: 'search find chats history' },
    { icon: <Pencil size={21} />, title: 'Rename chats', category: 'Productivity', description: 'Give conversations meaningful titles so your workspace stays organized.', status: 'Available', tags: 'rename edit title' },
    { icon: <Star size={21} />, title: 'Pin important chats', category: 'Productivity', description: 'Keep important conversations near the top of your chat list.', status: 'Available', tags: 'pin favorite important' },
    { icon: <Archive size={21} />, title: 'Archive conversations', category: 'Productivity', description: 'Move chats out of the main list without having to delete them.', status: 'Available', tags: 'archive organize history' },
    { icon: <Mic size={21} />, title: 'Voice input', category: 'Accessibility', description: 'Use supported browser speech recognition to dictate a message instead of typing.', status: 'Browser support required', tags: 'voice speech microphone dictate' },
    { icon: <GraduationCap size={21} />, title: 'Study mode', category: 'Learning', description: 'Ask for step-by-step explanations and learning-focused help for difficult topics.', status: 'Available', tags: 'study learn education explain' },
    { icon: <Globe2 size={21} />, title: 'Research mode', category: 'Learning', description: 'Use the workspace research mode for more deliberate, structured responses.', status: 'Available', tags: 'research investigate structured' },
    { icon: <Sun size={21} />, title: 'Light and dark themes', category: 'Personalization', description: 'Switch the landing page between light and dark appearance.', status: 'Available', tags: 'theme dark light appearance' },
    { icon: <ShieldCheck size={21} />, title: 'Account-based chat saving', category: 'Productivity', description: 'Sign in to use the account-based chat saving features configured for MIVCHAT.', status: 'Sign-in required', tags: 'account supabase save sync' },
    { icon: <BookOpen size={21} />, title: 'Math and formatted answers', category: 'Learning', description: 'Read structured Markdown responses, tables, and rendered mathematical expressions.', status: 'Available', tags: 'math latex markdown tables' },
  ];
  const featureCategories = ['All', ...new Set(featureCatalog.map((feature) => feature.category))];
  const visibleFeatures = featureCatalog.filter((feature) =>
    (featureCategory === 'All' || feature.category === featureCategory) &&
    `${feature.title} ${feature.description} ${feature.tags}`.toLowerCase().includes(featureSearch.toLowerCase().trim())
  );

  function openFeaturePage() {
    setExtraPage('');
    setShowFeaturePage(true);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function returnToLanding() {
    setExtraPage('');
    setShowFeaturePage(false);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function openInfoPage(page) {
    setShowFeaturePage(false);
    setExtraPage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function scrollToSection(sectionId) {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches ? 'auto' : 'smooth',
    block: 'start',
  });

  setMobileMenuOpen(false);
}
  async function submitFeedback(event) {
  event.preventDefault();

  if ((!rating && !feedback.trim()) || feedbackSending) return;

  setFeedbackSending(true);
  setFeedbackError('');

  const entry = {
    rating,
    feedback: feedback.trim(),
    type: feedbackType,
    createdAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${API_BASE}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(20000),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Could not send feedback.');
    }

    // Keep a local copy only after the server confirms success.
    try {
      const saved = JSON.parse(
        localStorage.getItem('mivchat-site-feedback') || '[]'
      );

      localStorage.setItem(
        'mivchat-site-feedback',
        JSON.stringify([entry, ...saved].slice(0, 20))
      );
    } catch (storageError) {
      console.warn('Could not save local feedback:', storageError);
    }

    setFeedbackSent(true);
    setFeedback('');
  } catch (error) {
    console.error('Feedback submission failed:', error);
    setFeedbackError(
      error.name === 'TimeoutError'
        ? 'The request timed out. Please try again.'
        : error.message || 'Could not send feedback. Please try again.'
    );
  } finally {
    setFeedbackSending(false);
  }
}

  if (extraPage) {
    const pageDetails = {
      'use-cases': {
        kicker: 'WAYS TO USE MIVCHAT', title: <>One workspace.<br /><span>Many starting points.</span></>,
        intro: 'Different goals, same idea: ask, explore, build, and keep moving. Choose a path to see how MIVCHAT can fit into your work.',
        cards: [
          { icon: <GraduationCap size={22} />, tag: 'LEARN', title: 'Students & self-learners', body: 'Break a topic into smaller steps, ask for examples, practice problem-solving, and request explanations when something is unclear.', prompt: 'Help me understand a difficult topic step by step, then give me a small practice exercise.' },
          { icon: <Code2 size={22} />, tag: 'BUILD', title: 'Developers & makers', body: 'Talk through an idea, understand an error, compare approaches, and work with supported code snippets and HTML/SVG previews.', prompt: 'Help me plan a small web project and explain each implementation step for a beginner.' },
          { icon: <BookOpen size={22} />, tag: 'WRITE', title: 'Writers & planners', body: 'Organize rough thoughts, outline a document, refine a draft, or turn a large task into a clear checklist.', prompt: 'Help me turn these rough notes into a clear outline and a practical action plan.' },
          { icon: <Globe2 size={22} />, tag: 'EXPLORE', title: 'Curious researchers', body: 'Explore questions, compare possibilities, and ask follow-ups. Verify important facts against trustworthy sources when needed.', prompt: 'Help me explore this question, list what is known versus uncertain, and suggest ways to verify it.' },
        ]
      },
      about: {
        kicker: 'THE IDEA BEHIND MIVCHAT', title: <>Built for curiosity.<br /><span>Designed to keep you moving.</span></>,
        intro: 'MIVCHAT brings conversation, learning, coding, and everyday creative work into one focused workspace—so an idea can become a clearer next step.',
        cards: [
          { icon: <Sparkles size={22} />, tag: 'OUR PRINCIPLE', title: 'Make complexity approachable', body: 'Useful help should make a hard problem feel more understandable, not hide the reasoning behind complicated language.' },
          { icon: <Layers size={22} />, tag: 'OUR APPROACH', title: 'Keep the workflow together', body: 'Move between asking questions, working with supported files, reading formatted code, and previewing supported web snippets.' },
          { icon: <ShieldCheck size={22} />, tag: 'OUR COMMITMENT', title: 'Be clear about limitations', body: 'Some capabilities depend on browser support, account status, and services configured for the current installation. We aim to describe those dependencies honestly.' },
        ]
      },
      help: {
        kicker: 'MIVCHAT HELP CENTER', title: <>A clearer next step<br /><span>starts right here.</span></>,
        intro: 'Quick guidance for getting started, using the workspace, and understanding what to do when something does not behave as expected.',
        cards: [
          { icon: <MessageCircle size={22} />, tag: 'GET STARTED', title: 'Start a useful conversation', body: 'Describe your goal, share relevant context, and say whether you want a short answer, a detailed explanation, or step-by-step guidance.', prompt: 'Help me get started with MIVCHAT and show me a few useful example prompts.' },
          { icon: <Paperclip size={22} />, tag: 'FILES', title: 'Working with attachments', body: 'Use the attachment control for supported file types. If an upload fails, check the extension and size, then try again with a smaller or supported file.', prompt: 'Help me figure out what information I should provide when a file upload fails.' },
          { icon: <Code2 size={22} />, tag: 'CODE & PREVIEW', title: 'Preview supported snippets', body: 'The current workspace supports previews for HTML and SVG code blocks. Other languages can still be displayed as highlighted code.', prompt: 'Explain how to use the HTML and SVG preview in my MIVCHAT workspace.' },
          { icon: <UserRound size={22} />, tag: 'ACCOUNT', title: 'Guest or signed in', body: 'You can explore as a guest. Sign in to use the account-based chat-saving features configured for this installation.', prompt: 'Explain the difference between guest use and signing in to MIVCHAT.' },
        ]
      },
      roadmap: {
        kicker: 'IDEAS FOR WHAT COMES NEXT', title: <>Growing with your ideas.<br /><span>One thoughtful step at a time.</span></>,
        intro: 'This is a place to collect directions worth exploring—not a promise that every idea is already available or scheduled for release.',
        cards: [
          { icon: <ListChecks size={22} />, tag: 'EXPERIENCE', title: 'More guided workflows', body: 'Explore ways to help people move from a goal to a checklist, plan, or sequence of practical steps.' },
          { icon: <BookOpen size={22} />, tag: 'LEARNING', title: 'More practice-oriented learning', body: 'Explore structured learning flows with examples, small exercises, and room to review mistakes.' },
          { icon: <Layers size={22} />, tag: 'WORKSPACE', title: 'Smoother project organization', body: 'Explore clearer ways to organize related conversations and keep useful work easier to find.' },
        ]
      }
    };
    const page = pageDetails[extraPage] || pageDetails['use-cases'];
    return (
      <div className={`mivchat-landing ${isLight ? 'light' : 'dark'} landing-extra-page landing-page-${extraPage}`}>
        <div className="landing-scroll-progress" aria-hidden="true"><span style={{ width: `${scrollProgress}%` }} /></div>
        <div className="landing-grain" aria-hidden="true" />
        <header className="landing-nav">
          <button className="landing-brand landing-brand-button" type="button" onClick={returnToLanding} aria-label="Return to MIVCHAT home"><span className="landing-brand-mark"><Sparkles size={20} /></span><span>MIV<span className="landing-brand-accent">CHAT</span><small>AI WORKSPACE</small></span></button>
          <nav className="landing-nav-links" aria-label="Information page navigation">
            <button type="button" onClick={() => openInfoPage('use-cases')}>Use cases</button><button type="button" onClick={() => openInfoPage('about')}>About</button><button type="button" onClick={() => openInfoPage('help')}>Help</button><button type="button" onClick={() => openInfoPage('roadmap')}>Roadmap</button>
          </nav>
          <div className="landing-nav-actions"><button className="landing-theme-toggle" type="button" onClick={onToggleTheme} aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'} title={isLight ? 'Dark mode' : 'Light mode'}>{isLight ? <Moon size={17} /> : <Sun size={17} />}</button><button className="landing-signin" type="button" onClick={returnToLanding}>Home</button><button className="landing-nav-cta" type="button" onClick={onEnter}>Open workspace <ArrowUpRight size={15} /></button></div>
        </header>
        <main className="landing-extra-content">
          <section className="landing-directory-hero landing-extra-hero"><span className="landing-kicker"><Sparkles size={14} /> {page.kicker}</span><h1>{page.title}</h1><p>{page.intro}</p><div className="landing-extra-hero-actions"><button className="landing-primary-cta" type="button" onClick={onEnter}>Open MIVCHAT <ArrowRight size={17} /></button><button className="landing-secondary-cta" type="button" onClick={returnToLanding}>Back to home <ArrowRight size={15} /></button></div></section>
          <section className="landing-extra-card-grid" aria-label={`${page.kicker} details`}>
            {page.cards.map((card, index) => <article className="landing-extra-card" key={card.title} style={{ animationDelay: `${index * 70}ms` }}><div className="landing-directory-card-top"><span className="landing-directory-icon">{card.icon}</span><span className="landing-extra-index">0{index + 1}</span></div><span className="landing-directory-category">{card.tag}</span><h2>{card.title}</h2><p>{card.body}</p>{card.prompt && <div className="landing-extra-sample-prompt"><strong>Try asking:</strong> “{card.prompt}”</div>}<button type="button" className="landing-directory-action" onClick={onEnter}>Explore in workspace <ArrowUpRight size={15} /></button></article>)}
          </section>
          {extraPage === 'help' && <section className="landing-extra-note"><span className="landing-kicker">QUICK TROUBLESHOOTING</span><h2>If something doesn't work</h2><p>Refresh the page once, check that the backend service is running, and look at the browser or server console for an error. Avoid sharing API keys, passwords, or private account details when asking for help.</p><button className="landing-primary-cta" type="button" onClick={() => { returnToLanding(); window.setTimeout(() => document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth' }), 100); }}>Share feedback <ArrowRight size={16} /></button></section>}
          {extraPage === 'roadmap' && <section className="landing-extra-note"><span className="landing-kicker">SHAPE THE NEXT VERSION</span><h2>What would help you most?</h2><p>Share an idea through the feedback form on the home page. Roadmap cards are possibilities to explore, not confirmed delivery dates.</p><button className="landing-primary-cta" type="button" onClick={() => { returnToLanding(); window.setTimeout(() => document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth' }), 100); }}>Suggest a feature <ArrowRight size={16} /></button></section>}
          <section className="landing-extra-bottom-cta"><div><span className="landing-kicker">READY WHEN YOU ARE</span><h2>Bring your next idea.</h2><p>Start with a question. Keep going from there.</p></div><button className="landing-primary-cta" type="button" onClick={onEnter}>Continue to MIVCHAT <ArrowRight size={17} /></button></section>
        </main>
        <footer className="landing-footer"><button className="landing-brand landing-brand-button footer-brand" type="button" onClick={returnToLanding}><span className="landing-brand-mark"><Sparkles size={18} /></span><span>MIV<span className="landing-brand-accent">CHAT</span><small>AI WORKSPACE</small></span></button><span className="landing-footer-tagline">Curiosity in. Possibility out.</span><div className="landing-footer-links"><button type="button" onClick={() => openInfoPage('use-cases')}>Use cases</button><button type="button" onClick={() => openFeaturePage()}>All features</button><button type="button" onClick={() => openInfoPage('about')}>About</button><button type="button" onClick={() => openInfoPage('help')}>Help center</button><button type="button" onClick={() => openInfoPage('roadmap')}>Roadmap</button><button type="button" onClick={onEnter}>Open workspace <ArrowRight size={14} /></button></div><span className="landing-footer-copy">© {new Date().getFullYear()} MIVCHAT. Built for curious minds.</span></footer>
        {showScrollTop && <button className="landing-scroll-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} aria-label="Scroll back to top" title="Back to top"><ArrowUpRight size={19} /></button>}
      </div>
    );
  }

  if (showFeaturePage) {
    return (
      <div className={`mivchat-landing ${isLight ? 'light' : 'dark'} landing-feature-directory-page`}>
        <div className="landing-scroll-progress" aria-hidden="true"><span style={{ width: `${scrollProgress}%` }} /></div>
        <div className="landing-grain" aria-hidden="true" />
        <header className="landing-nav">
          <a className="landing-brand" href="#feature-directory-top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="MIVCHAT features top">
            <span className="landing-brand-mark"><Sparkles size={20} /></span>
            <span>MIV<span className="landing-brand-accent">CHAT</span><small>AI WORKSPACE</small></span>
          </a>
          <nav className="landing-nav-links" aria-label="Feature navigation">
            <a href="#feature-directory">Feature directory</a><a href="#feature-categories">Categories</a><a href="#feature-directory-faq">Availability</a>
          </nav>
          <div className="landing-nav-actions">
            <button className="landing-theme-toggle" type="button" onClick={onToggleTheme} aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'} title={isLight ? 'Dark mode' : 'Light mode'}>{isLight ? <Moon size={17} /> : <Sun size={17} />}</button>
            <button className="landing-signin" type="button" onClick={returnToLanding}>Home</button>
            <button className="landing-nav-cta" type="button" onClick={onEnter}>Open workspace <ArrowUpRight size={15} /></button>
          </div>
        </header>
        <main id="feature-directory-top" className="landing-feature-directory">
          <section className="landing-directory-hero">
            <span className="landing-kicker"><Sparkles size={14} /> THE MIVCHAT TOOLKIT</span>
            <h1>One AI workspace.<br /><span>More ways to make.</span></h1>
            <p>Explore the tools built into MIVCHAT for conversation, coding, learning, files, creative work, and keeping your chats organized.</p>
            <div className="landing-directory-stats"><div><strong>{featureCatalog.length}</strong><span>feature areas</span></div><div><strong>6+</strong><span>ways to work</span></div><div><strong>1</strong><span>connected workspace</span></div></div>
            <button className="landing-primary-cta" type="button" onClick={onEnter}>Try the workspace <ArrowRight size={17} /></button>
          </section>
          <section className="landing-directory-list" id="feature-directory">
            <div className="landing-directory-heading"><div><span className="landing-kicker">BUILT TO BE EXPLORED</span><h2>Everything in one place</h2><p>Search the directory or choose a category to find what you need.</p></div><label className="landing-feature-search"><Search size={17} /><input value={featureSearch} onChange={(event) => setFeatureSearch(event.target.value)} placeholder="Search features…" aria-label="Search all features" /><kbd>/</kbd></label></div>
            <div className="landing-feature-filters" id="feature-categories" role="group" aria-label="Filter features by category">
              {featureCategories.map((category) => <button key={category} type="button" className={featureCategory === category ? 'active' : ''} onClick={() => setFeatureCategory(category)} aria-pressed={featureCategory === category}>{category}</button>)}
            </div>
            <div className="landing-directory-grid" aria-live="polite">
              {visibleFeatures.map((feature, index) => <article className="landing-directory-card" key={feature.title} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                <div className="landing-directory-card-top"><span className="landing-directory-icon">{feature.icon}</span><span className={`landing-feature-status ${feature.status === 'Available' ? 'is-available' : ''}`}>{feature.status}</span></div>
                <span className="landing-directory-category">{feature.category}</span><h3>{feature.title}</h3><p>{feature.description}</p>
                <button type="button" className="landing-directory-action" onClick={onEnter}>Explore in workspace <ArrowUpRight size={15} /></button>
              </article>)}
              {visibleFeatures.length === 0 && <div className="landing-feature-empty"><Search size={24} /><h3>No matching features</h3><p>Try a different word or select another category.</p><button type="button" onClick={() => { setFeatureSearch(''); setFeatureCategory('All'); }}>Clear filters</button></div>}
            </div>
          </section>
          <section className="landing-directory-note" id="feature-directory-faq"><div className="landing-directory-note-icon"><ShieldCheck size={22} /></div><div><h2>Availability, explained honestly</h2><p>Some features depend on your browser, sign-in status, or services configured by the MIVCHAT developer. Image generation requires the image service to be configured and reachable; voice input requires browser speech-recognition support. File support depends on the formats accepted by the current workspace.</p></div><button type="button" className="landing-secondary-cta" onClick={returnToLanding}>Back to landing page <ArrowRight size={16} /></button></section>
          <section className="landing-directory-bottom"><span className="landing-kicker">READY WHEN YOU ARE</span><h2>Your next idea starts here.</h2><p>Ask a question, build something, or learn a new concept with MIVCHAT.</p><button className="landing-primary-cta" type="button" onClick={onEnter}>Open MIVCHAT <ArrowRight size={17} /></button></section>
        </main>
        <footer className="landing-footer"><a className="landing-brand footer-brand" href="#feature-directory-top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><span className="landing-brand-mark"><Sparkles size={18} /></span><span>MIV<span className="landing-brand-accent">CHAT</span><small>AI WORKSPACE</small></span></a><span className="landing-footer-tagline">Curiosity in. Possibility out.</span><div className="landing-footer-links"><button type="button" onClick={returnToLanding}>Landing page</button><button type="button" onClick={onEnter}>Open workspace <ArrowRight size={14} /></button></div><span className="landing-footer-copy">© {new Date().getFullYear()} MIVCHAT. Built for curious minds.</span></footer>
        {showScrollTop && <button className="landing-scroll-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} aria-label="Scroll back to top" title="Back to top"><ArrowUpRight size={19} /></button>}
      </div>
    );
  }

  return (
    <div className={`mivchat-landing ${isLight ? 'light' : 'dark'}`}>
      <div className="landing-scroll-progress" aria-hidden="true"><span style={{ width: `${scrollProgress}%` }} /></div>
      <div className="landing-grain" aria-hidden="true" />
      <header className="landing-nav">
        <a className="landing-brand" href="#home" aria-label="MIVCHAT home">
          <span className="landing-brand-mark"><Sparkles size={20} /></span>
          <span>MIV<span className="landing-brand-accent">CHAT</span><small>AI WORKSPACE</small></span>
        </a>
        <nav className="landing-nav-links" aria-label="Main navigation">
          <a href="#features">Highlights</a>
          <button type="button" className="landing-nav-feature-button" onClick={openFeaturePage}>All features <ArrowUpRight size={13} /></button>
          <a href="#how-it-works">How it works</a>
          <button type="button" className="landing-nav-feature-button" onClick={() => openInfoPage('use-cases')}>Use cases</button>
          <button type="button" className="landing-nav-feature-button" onClick={() => openInfoPage('about')}>About</button>
          <a href="#faq">FAQ</a>
          <a href="#feedback">Feedback</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="landing-nav-actions">
          <button className="landing-theme-toggle" type="button" onClick={onToggleTheme} aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'} title={isLight ? 'Dark mode' : 'Light mode'}>
            {isLight ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button className="landing-signin" type="button" onClick={onSignIn}>Sign in</button>
          <button className="landing-nav-cta" type="button" onClick={onEnter}>Open workspace <ArrowUpRight size={15} /></button>
          <button className="landing-mobile-menu-toggle" type="button" onClick={() => setMobileMenuOpen((open) => !open)} aria-expanded={mobileMenuOpen} aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}>{mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
      </header>
      {mobileMenuOpen && <nav className="landing-mobile-menu" aria-label="Mobile navigation"><a href="#features" onClick={() => setMobileMenuOpen(false)}>Highlights</a><button type="button" onClick={openFeaturePage}>Explore all features <ArrowUpRight size={15} /></button><a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it works</a><a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a><a href="#feedback" onClick={() => setMobileMenuOpen(false)}>Feedback</a><a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a><button type="button" onClick={() => openInfoPage('use-cases')}>Use cases <ArrowUpRight size={15} /></button><button type="button" onClick={() => openInfoPage('about')}>About MIVCHAT <ArrowUpRight size={15} /></button><button type="button" onClick={() => openInfoPage('help')}>Help center <ArrowUpRight size={15} /></button><button type="button" onClick={() => openInfoPage('roadmap')}>Roadmap <ArrowUpRight size={15} /></button></nav>}

      <main id="home">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-status"><span className="landing-status-dot" /> YOUR IDEAS, WITH ROOM TO GROW</div>
            <h1>Think bigger.<br /><span>Make it happen.</span></h1>
            <p className="landing-hero-description">Meet your AI workspace for questions, code, learning, research, and creative work — all in one focused place.</p>
            <div className="landing-hero-actions">
              <button className="landing-primary-cta" type="button" onClick={onEnter}>Continue to MIVCHAT <ArrowRight size={18} /></button>
              <a className="landing-secondary-cta" href="#features">Explore what you can do <span>↓</span></a>
            </div>
            <div className="landing-trust-line"><span className="landing-trust-icon"><ShieldCheck size={16} /></span><span>Start exploring as a guest. Sign in when you want your work saved to your account.</span></div>
          </div>

          <div className="landing-hero-visual" aria-label="Illustration of the MIVCHAT AI workspace">
            <div className="landing-orbit landing-orbit-one" />
            <div className="landing-orbit landing-orbit-two" />
            <div className="landing-planet-glow" />
            <div className="landing-planet"><div className="landing-planet-core"><Sparkles size={54} strokeWidth={1.3} /></div></div>
            <div className="landing-float-card landing-float-code"><span className="landing-mini-icon mint"><Code2 size={16} /></span><span><strong>Code with clarity</strong><small>Build · Debug · Understand</small></span><span className="landing-card-dot" /></div>
            <div className="landing-float-card landing-float-study"><span className="landing-mini-icon violet"><GraduationCap size={17} /></span><span><strong>Learn at your pace</strong><small>One concept at a time</small></span></div>
            <div className="landing-float-card landing-float-create"><span className="landing-mini-icon coral"><Zap size={16} /></span><span><strong>From thought to draft</strong><small>Ideas into something real</small></span></div>
            <div className="landing-visual-caption"><span className="landing-caption-pulse" /> A workspace built around your curiosity</div>
          </div>
          <button className="landing-scroll-cue" type="button" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })} aria-label="Scroll to explore features"><span /> SCROLL TO EXPLORE <ArrowRight size={13} /></button>
        </section>

        <section className="landing-capability-strip" aria-label="MIVCHAT capabilities">
          <span><MessageCircle size={16} /> Ask anything</span><i />
          <span><Terminal size={16} /> Write and understand code</span><i />
          <span><FileText size={16} /> Work with files</span><i />
          <span><BookOpen size={16} /> Learn and practice</span>
        </section>

        <section className="landing-section landing-features" id="features">
          <div className="landing-section-heading">
            <span className="landing-kicker">ONE WORKSPACE. MANY POSSIBILITIES.</span>
            <h2>Made for the way<br /><span>your mind works.</span></h2>
            <p>Move from a question to a plan, from a tricky bug to a working idea, without losing your flow.</p>
          </div>
          <div className="landing-feature-grid">
            <article className="landing-feature-card feature-violet"><div className="landing-feature-icon"><MessageCircle size={21} /></div><span className="landing-feature-number">01 / CONVERSATION</span><h3>Think it through</h3><p>Ask questions, compare options, explore unfamiliar topics, and get explanations shaped around what you need.</p><button type="button" onClick={onEnter}>Start a conversation <ArrowUpRight size={15} /></button><div className="landing-feature-decoration deco-chat"><span /><span /><span /></div></article>
            <article className="landing-feature-card feature-mint"><div className="landing-feature-icon"><Code2 size={21} /></div><span className="landing-feature-number">02 / DEVELOPMENT</span><h3>Build with confidence</h3><p>Draft code, understand errors, improve ideas, and preview supported HTML or SVG directly in your workspace.</p><button type="button" onClick={onEnter}>Explore coding <ArrowUpRight size={15} /></button><div className="landing-code-decoration"><span>const idea</span><span className="code-line-two">= build<span>();</span></span><span className="code-line-three">// keep learning</span></div></article>
            <article className="landing-feature-card feature-blue"><div className="landing-feature-icon"><FileText size={21} /></div><span className="landing-feature-number">03 / FILES & IDEAS</span><h3>Bring your work together</h3><p>Ask for help with supported attachments, create text and code files, and keep your conversations organized.</p><button type="button" onClick={onEnter}>Open your workspace <ArrowUpRight size={15} /></button><div className="landing-file-decoration"><span><FileText size={17} /></span><span><FileText size={17} /></span><span><FileText size={17} /></span></div></article>
            <article className="landing-feature-card feature-coral"><div className="landing-feature-icon"><GraduationCap size={21} /></div><span className="landing-feature-number">04 / LEARNING</span><h3>Make progress, not guesses</h3><p>Study a topic, practice a skill, and break complex ideas into steps that are easier to understand.</p><button type="button" onClick={onEnter}>Start learning <ArrowUpRight size={15} /></button><div className="landing-learning-decoration"><span>WHY?</span><span>HOW?</span><span>TRY IT</span></div></article>
          </div>
          <div className="landing-all-features-cta"><div><span className="landing-kicker">THERE'S MORE TO EXPLORE</span><h3>See the complete MIVCHAT toolkit.</h3><p>Browse features by category, search for a tool, and learn what each one does.</p></div><button className="landing-primary-cta" type="button" onClick={openFeaturePage}>Explore all features <ArrowUpRight size={16} /></button></div>
        </section>

        <section className="landing-how" id="how-it-works">
          <div className="landing-how-art"><div className="landing-how-ring ring-a" /><div className="landing-how-ring ring-b" /><div className="landing-how-center"><Sparkles size={34} /><span>MIVCHAT</span></div><div className="landing-how-node node-one"><MessageCircle size={18} /></div><div className="landing-how-node node-two"><Code2 size={18} /></div><div className="landing-how-node node-three"><BookOpen size={18} /></div></div>
          <div className="landing-how-copy"><span className="landing-kicker">SIMPLE BY DESIGN</span><h2>Start with a thought.<br /><span>Go wherever it leads.</span></h2><div className="landing-step"><span>01</span><div><strong>Bring your question</strong><p>Describe what you're trying to understand, create, or solve.</p></div></div><div className="landing-step"><span>02</span><div><strong>Work through it together</strong><p>Ask follow-up questions, refine the result, and learn as you go.</p></div></div><div className="landing-step"><span>03</span><div><strong>Take the next step</strong><p>Turn the answer into code, a draft, a study session, or a clearer plan.</p></div></div><button className="landing-primary-cta" type="button" onClick={onEnter}>Try MIVCHAT <ArrowRight size={17} /></button></div>
        </section>

        <section className="landing-section landing-faq" id="faq">
          <div className="landing-section-heading">
            <span className="landing-kicker">A FEW QUICK ANSWERS</span>
            <h2>Good to know<br /><span>before you begin.</span></h2>
            <p>Simple answers about getting started with MIVCHAT.</p>
          </div>
          <div className="landing-faq-list">
            <details className="landing-faq-item"><summary>Can I try MIVCHAT without signing in?</summary><p>Yes. Choose “Continue to MIVCHAT” to open the workspace as a guest. Sign in when you want to use your account features.</p></details>
            <details className="landing-faq-item"><summary>Can MIVCHAT help me understand code?</summary><p>Yes. Ask for explanations, examples, debugging help, or step-by-step guidance. Always test code before using it in an important project.</p></details>
            <details className="landing-faq-item"><summary>Can I upload files?</summary><p>The workspace includes file-related tools. The formats and limits available to you depend on the current MIVCHAT implementation.</p></details>
            <details className="landing-faq-item"><summary>Will my conversations be saved?</summary><p>Guest and signed-in experiences may differ. Sign in to use the account-based chat saving features configured for MIVCHAT.</p></details>
            <details className="landing-faq-item"><summary>Does the feedback form email the developer?</summary><p>Yes. The current feedback is sent to the email of the developer that is MUNEZERO Olivier</p></details>
          </div>
        </section>

        <section className="landing-feedback-section" id="feedback">
          <div className="landing-feedback-copy"><span className="landing-kicker">HELP US MAKE IT BETTER</span><h2>Your experience<br /><span>matters here.</span></h2><p>MIVCHAT is growing. Tell us what works, what feels confusing, or what you would love to see next.</p><div className="landing-feedback-note"><ShieldCheck size={17} /><span>Your feedback stays in this browser for now. This form does not send information to a server.</span></div></div>
          <form className="landing-feedback-card" onSubmit={submitFeedback}>
            <div className="landing-feedback-card-top"><span className="landing-feedback-badge"><Star size={14} /> QUICK FEEDBACK</span><span className="landing-feedback-step">YOUR VOICE / 01</span></div>
            {feedbackSent ? <div className="landing-feedback-success"><span><Sparkles size={25} /></span><h3>Thanks for sharing.</h3><p><p>Your feedback was sent successfully. Thank you for helping improve MIVCHAT.</p></p><button type="button" onClick={() => { setFeedbackSent(false); setRating(0); }}>Send more feedback <ArrowRight size={15} /></button></div> : <>
              <label className="landing-form-label">How would you rate your experience?</label>
              <div className="landing-rating-stars" role="radiogroup" aria-label="Rate your experience">
                {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? '' : 's'}`} className={(hoverRating || rating) >= value ? 'active' : ''} onMouseEnter={() => setHoverRating(value)} onMouseLeave={() => setHoverRating(0)} onFocus={() => setHoverRating(value)} onBlur={() => setHoverRating(0)} onClick={() => setRating(value)}><Star size={26} fill={(hoverRating || rating) >= value ? 'currentColor' : 'none'} /></button>)}
                <span>{rating ? ['','Needs work','Fair','Good','Great','Excellent'][rating] : 'Choose a rating'}</span>
              </div>
              <label className="landing-form-label" htmlFor="mivchat-feedback-type">What is this about?</label>
              <select id="mivchat-feedback-type" value={feedbackType} onChange={(event) => setFeedbackType(event.target.value)}><option>Suggestion</option><option>Something I like</option><option>Bug report</option><option>Feature request</option></select>
              <label className="landing-form-label" htmlFor="mivchat-feedback-message">Anything you want us to know? <span>Optional</span></label>
              <textarea id="mivchat-feedback-message" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="A feature I'd love to see is…" rows={3} maxLength={1200} />
              {feedbackError && (
                  <p role="alert" style={{ color: '#ff8b9a', fontSize: 12 }}>
                    {feedbackError}
                  </p>
                )}

                <button
                  className="landing-primary-cta landing-feedback-submit"
                  type="submit"
                  disabled={feedbackSending || (!rating && !feedback.trim())}
                >
                  {feedbackSending
                    ? 'Sending feedback…'
                    : 'Send feedback'}
                  <ArrowRight size={16} />
                </button>
            </>}
          </form>
        </section>

        <section className="landing-contact" id="contact"><div className="landing-contact-orb"><MessageCircle size={25} /></div><div><span className="landing-kicker">LET'S KEEP IMPROVING</span><h2>Have an idea for MIVCHAT?</h2><p>Use the feedback form to share a suggestion, or email <a className="landing-inline-email" href="mailto:omunezero891@gmail.com">omunezero891@gmail.com</a> directly.</p></div><a href="#feedback" className="landing-contact-link">Share your thoughts <ArrowUpRight size={17} /></a></section>
      </main>

      <footer className="landing-footer"><a className="landing-brand footer-brand" href="#home"><span className="landing-brand-mark"><Sparkles size={18} /></span><span>MIV<span className="landing-brand-accent">CHAT</span><small>AI WORKSPACE</small></span></a><span className="landing-footer-tagline">Curiosity in. Possibility out.</span><div className="landing-footer-links"><a href="#features">Highlights</a><button type="button" onClick={openFeaturePage}>All features</button><a href="#faq">FAQ</a><a href="#feedback">Feedback</a><a href="#contact">Contact</a><button type="button" onClick={() => openInfoPage('use-cases')}>Use cases</button><button type="button" onClick={() => openInfoPage('about')}>About</button><button type="button" onClick={() => openInfoPage('help')}>Help center</button><button type="button" onClick={() => openInfoPage('roadmap')}>Roadmap</button><button type="button" onClick={onEnter}>Open workspace <ArrowRight size={14} /></button></div><span className="landing-footer-copy">© {new Date().getFullYear()} MIVCHAT. Built for curious minds.</span></footer>
      {showScrollTop && <button className="landing-scroll-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} aria-label="Scroll back to top" title="Back to top"><ArrowUpRight size={19} /></button>}
    </div>
  );
}


function App() {
  const [showLandingPage, setShowLandingPage] = useState(true);
  const [chats, setChats] = useState(() => [createChat()]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState('');
  const [assistantMode, setAssistantMode] = useState(() => {
    try {
      const savedMode = localStorage.getItem('mivchat-assistant-mode');
      return ['normal', 'research', 'study'].includes(savedMode) ? savedMode : 'normal';
    } catch {
      return 'normal';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('mivchat-assistant-mode', assistantMode);
    } catch (error) {
      console.warn('Could not save MIVCHAT mode preference:', error);
    }
  }, [assistantMode]);
  const [showSettings, setShowSettings] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [showStudyTools, setShowStudyTools] = useState(false);
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const [studyTopic, setStudyTopic] = useState('');
  const [galleryImages, setGalleryImages] = useState([]);
  const [responseLength, setResponseLength] = useState(() => {
    try { const saved = localStorage.getItem('mivchat-response-length'); return ['concise', 'balanced', 'detailed'].includes(saved) ? saved : 'balanced'; }
    catch { return 'balanced'; }
  });
  const [textScale, setTextScale] = useState(() => {
    try { const saved = Number(localStorage.getItem('mivchat-text-scale')); return [100, 110, 120].includes(saved) ? saved : 100; }
    catch { return 100; }
  });
  const [chatMeta, setChatMeta] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mivchat-chat-meta') || '{}') || {}; }
    catch { return {}; }
  });
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showGuestReminder, setShowGuestReminder] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLight, setIsLight] = useState(() => {
  try {
    return localStorage.getItem('mivchat-theme') !== 'dark';
  } catch {
    return true;
  }
  });
  const [listening, setListening] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [authMode, setAuthMode] = useState(null);
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState(null);
  // Controls whether the password is visible.
  const [showPassword, setShowPassword] = useState(false);
  const authFormKey = authMode ?? 'closed';

// Holds the email and password currently typed in the auth form.
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingChatId, setStreamingChatId] = useState(null);
  const [cloudReadyUserId, setCloudReadyUserId] = useState(null);
  const cloudSaveQueueRef = useRef(Promise.resolve());
  // Tombstones stop an old queued autosave from recreating a deleted chat.
  const deletedChatIdsRef = useRef(new Set());
  const cloudSaveRetryRef = useRef(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  // Controls the Create File panel.
  const [showFileCreator, setShowFileCreator] = useState(false);
  const [fileTitle, setFileTitle] = useState('My document');
  const [fileFormat, setFileFormat] = useState('txt');
  const [fileContent, setFileContent] = useState('');
  const [isGeneratingFile, setIsGeneratingFile] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewLanguage, setPreviewLanguage] = useState('html');
  const [previewVersion, setPreviewVersion] = useState(0);
  // Indicates that the signed-in user's workspace has been restored.
  const [workspaceReadyUserId, setWorkspaceReadyUserId] = useState(null);

  // Width of the live-preview panel.
  const [previewWidth, setPreviewWidth] = useState(520);
  const [isResizingPreview, setIsResizingPreview] = useState(false);

  const conversationRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const dragDepthRef = useRef(0);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  const activeChat = chats.find((chat) => chat.id === activeChatId);
  function resetAuthForm() {
  setAuthEmail('');
  setAuthPassword('');
  setShowPassword(false);
}
  async function handleSignOut() {
  setNotice('');

  const { error } = await supabase.auth.signOut({
    scope: 'local',
  });

  if (error) {
    setNotice(`Sign-out failed: ${error.message}`);
    return;
  }

  setAuthMode(null);
  setNotice('Signed out successfully.');
}

  


useEffect(() => {
  let mounted = true;

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!mounted) return;

    setUser(session?.user ?? null);

    if (session?.user) {
      setShowLandingPage(false);
      setAuthMode(null);
    }

    setIsSessionReady(true);
  });

  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      if (!mounted) return;

      setUser(session?.user ?? null);

      if (session?.user) {
        setShowLandingPage(false);
        setAuthMode(null);
      }

      setIsSessionReady(true);
    })
    .catch((error) => {
      console.warn('Could not restore the sign-in session:', error);

      if (mounted) {
        setIsSessionReady(true);
      }
    });

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []);



useEffect(() => {
  try {
    localStorage.setItem(
      'mivchat-theme',
      isLight ? 'light' : 'dark'
    );
  } catch (error) {
    console.warn('Could not save the theme:', error);
  }
}, [isLight]);

useEffect(() => {
  try {
    localStorage.setItem('mivchat-response-length', responseLength);
    localStorage.setItem('mivchat-text-scale', String(textScale));
    localStorage.setItem('mivchat-chat-meta', JSON.stringify(chatMeta));
  } catch (error) { console.warn('Could not save MIVCHAT preferences:', error); }
}, [responseLength, textScale, chatMeta]);

useEffect(() => {
  let cancelled = false;
  readMivchatImages().then((items) => { if (!cancelled) setGalleryImages(items); })
    .catch((error) => console.warn('Could not load image gallery:', error));
  return () => { cancelled = true; };
}, []);

// A friendly, one-time-per-tab reminder after 15 minutes of guest use.
// Dismissing it keeps the guest experience uninterrupted for this tab session.
useEffect(() => {
  if (user?.id) {
    setShowGuestReminder(false);
    return undefined;
  }

  try {
    if (sessionStorage.getItem('mivchat-guest-reminder-dismissed') === 'yes') {
      return undefined;
    }
  } catch {
    // Storage may be disabled; the timer can still work for this visit.
  }

  const reminderTimer = window.setTimeout(() => setShowGuestReminder(true), 15 * 60 * 1000);
  return () => window.clearTimeout(reminderTimer);
}, [user?.id]);

// Load the signed-in user's private chat history.
// Restore unfinished workspace state for signed-in users.
// Guests intentionally start with a clean workspace.
useEffect(() => {
  if (!user?.id) {
    setWorkspaceReadyUserId(null);

    setInput('');
    setSelectedFiles([]);
    setShowFileCreator(false);
    setFileTitle('My document');
    setFileFormat('txt');
    setFileContent('');
    setPreviewDocument(null);
    setPreviewLanguage('html');

    return;
  }

  const storageKey = `mivchat-workspace-${user.id}`;

  try {
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      const workspace = JSON.parse(saved);

      setInput(
        typeof workspace.input === 'string'
          ? workspace.input
          : ''
      );

      setShowFileCreator(
        workspace.showFileCreator === true
      );

      setFileTitle(
        typeof workspace.fileTitle === 'string'
          ? workspace.fileTitle
          : 'My document'
      );

      setFileFormat(
        typeof workspace.fileFormat === 'string'
          ? workspace.fileFormat
          : 'txt'
      );

      setFileContent(
        typeof workspace.fileContent === 'string'
          ? workspace.fileContent
          : ''
      );

      setPreviewDocument(
        typeof workspace.previewDocument === 'string'
          ? workspace.previewDocument
          : null
      );

      setPreviewLanguage(
        typeof workspace.previewLanguage === 'string'
          ? workspace.previewLanguage
          : 'html'
      );

      if (typeof workspace.previewWidth === 'number') {
        setPreviewWidth(
          Math.min(1100, Math.max(300, workspace.previewWidth))
        );
      }

      if (typeof workspace.isLight === 'boolean') {
        setIsLight(workspace.isLight);
      }

      setPreviewVersion((version) => version + 1);
    }
  } catch (error) {
    console.warn('Could not restore the saved workspace:', error);
  }

  setWorkspaceReadyUserId(user.id);
}, [user?.id]);

// Keep saving the signed-in user's unfinished workspace.
// Wait until restoration finishes to avoid overwriting saved data
// with the initial, empty React state.
useEffect(() => {
  if (!user?.id || workspaceReadyUserId !== user.id) {
    return;
  }

  const workspace = {
    input,
    showFileCreator,
    fileTitle,
    fileFormat,
    fileContent,
    previewDocument,
    previewLanguage,
    previewWidth,
    isLight,
  };

  try {
    localStorage.setItem(
      `mivchat-workspace-${user.id}`,
      JSON.stringify(workspace)
    );
  } catch (error) {
    console.warn(
      'Could not save the workspace. Browser storage may be full:',
      error
    );
  }
}, [
  user?.id,
  workspaceReadyUserId,
  input,
  showFileCreator,
  fileTitle,
  fileFormat,
  fileContent,
  previewDocument,
  previewLanguage,
  previewWidth,
  isLight,
]);
// Allow the preview panel to be resized by dragging its divider.
useEffect(() => {
  if (!isResizingPreview) return;

  function handlePointerMove(event) {
    const minimumWidth = 300;
    const maximumWidth = Math.floor(window.innerWidth * 0.7);

    const nextWidth = window.innerWidth - event.clientX;

    setPreviewWidth(
      Math.min(
        maximumWidth,
        Math.max(minimumWidth, nextWidth)
      )
    );
  }

  function stopResizing() {
    setIsResizingPreview(false);
  }

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', stopResizing);
  window.addEventListener('pointercancel', stopResizing);

  return () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopResizing);
    window.removeEventListener('pointercancel', stopResizing);
  };
}, [isResizingPreview]);
useEffect(() => {
  let cancelled = false;

  async function loadUserChats() {
    // Guests always start with a fresh conversation.
    if (!user) {
        setCloudReadyUserId(null);
        setChats([createChat()]);
        setActiveChatId(null);
        setIsLoadingChats(false);
        return;
      }
    setCloudReadyUserId(null);

    // Never leave another account's chats visible while loading.
    const freshChat = createChat();

    setChats([freshChat]);
    setActiveChatId(freshChat.id);
    setIsLoadingChats(true);

    try {
      // Step 1: Retrieve this user's most recent conversations.
      const { data: chatRows, error: chatError } = await runSupabaseQueryWithRefresh(() =>
        supabase.from('chats')
          .select('id, title, created_at, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(50)
      );

      if (chatError) throw chatError;

      if (cancelled) return;

      let messageRows = [];

      // Step 2: Retrieve messages belonging to those conversations.
      if (chatRows.length > 0) {
        const chatIds = chatRows.map((chat) => chat.id);

        const { data, error: messageError } = await runSupabaseQueryWithRefresh(() =>
          supabase.from('messages')
            .select('id, chat_id, role, content, created_at')
            .in('chat_id', chatIds)
            .order('created_at', { ascending: true })
        );

        if (messageError) throw messageError;

        messageRows = data ?? [];
      }

      if (cancelled) return;

      // Step 3: Group each message under its conversation.
      const loadedChats = (chatRows ?? []).map((chat) => ({
        id: chat.id,
        title: chat.title || 'New chat',
        updatedAt: new Date(chat.updated_at).getTime() || Date.now(),

        messages: messageRows
          .filter((message) => message.chat_id === chat.id)
          .map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
          })),
      }));

      // Step 4: Put a fresh chat first, followed by recent saved chats.
      // Step 4: Put a fresh chat first, followed by saved chats.
// Restore the last conversation selected by this signed-in user.
        let savedActiveChatId = null;

        try {
          savedActiveChatId = sessionStorage.getItem(
            `mivchat-active-chat-${user.id}`
          );
        } catch {
          // The app can still work if browser storage is unavailable.
        }

        const restoredChat = loadedChats.find(
          (chat) => chat.id === savedActiveChatId
        );

        setChats([freshChat, ...loadedChats]);

        // Return to the saved conversation when it still exists.
        // Otherwise, open a fresh conversation.
        setActiveChatId(restoredChat?.id ?? freshChat.id);

        setCloudReadyUserId(user.id);
            } catch (error) {
      if (!cancelled) {
        setCloudReadyUserId(null);
        setNotice(
          `Could not load your saved chats: ${error.message}`
        );
      }
    } finally {
      if (!cancelled) {
        setIsLoadingChats(false);
      }
    }
  }

  loadUserChats();

  return () => {
    cancelled = true;
  };
}, [user?.id]);
 // Save signed-in conversations and messages to Supabase.
useEffect(() => {
  if (!user || cloudReadyUserId !== user.id) {
    return;
  }

  const userId = user.id;

  // Capture this version of the chat list for this save operation.
  const chatsToSave = chats.map((chat) => ({
    ...chat,
    messages: [...chat.messages],
  }));

  const saveTimer = window.setTimeout(() => {
    cloudSaveQueueRef.current = cloudSaveQueueRef.current
    .catch(() => {
      // Allow later saves to continue if an earlier save failed.
    })
    .then(async () => {
      // Don't start saving after this account has signed out or changed.
      if (userId !== user.id || cloudReadyUserId !== userId) {
        return;
      }

      for (const chat of chatsToSave) {
        // A queued snapshot may predate a delete click. Never upsert tombstoned chats.
        if (deletedChatIdsRef.current.has(chat.id)) continue;

        const { error: chatError } = await runSupabaseQueryWithRefresh(() =>
          supabase.from('chats').upsert(
            {
              id: chat.id,
              user_id: userId,
              title: chat.title,
              updated_at: new Date(chat.updatedAt).toISOString(),
            },
            { onConflict: 'id' }
          )
        );

        if (chatError) throw chatError;

        // Find messages currently stored for this conversation.
        const { data: savedMessages, error: readError } = await runSupabaseQueryWithRefresh(() =>
          supabase.from('messages').select('id').eq('chat_id', chat.id)
        );

        if (readError) throw readError;

        const currentIds = new Set(
          chat.messages.map((message) => message.id)
        );

        // Remove database messages that no longer exist locally.
        const staleIds = savedMessages
          .map((message) => message.id)
          .filter((id) => !currentIds.has(id));

        if (staleIds.length > 0) {
          const { error: deleteError } = await runSupabaseQueryWithRefresh(() =>
            supabase.from('messages').delete().eq('chat_id', chat.id).in('id', staleIds)
          );

          if (deleteError) throw deleteError;
        }

        // Save the messages that currently belong to the conversation.
        if (chat.messages.length > 0) {
          const rows = chat.messages.map((message) => ({
            id: message.id,
            chat_id: chat.id,
            role: message.role,
            content: message.content,
          }));

          const { error: messageError } = await runSupabaseQueryWithRefresh(() =>
            supabase.from('messages').upsert(rows, { onConflict: 'id' })
          );

          if (messageError) throw messageError;
        }
      }
      cloudSaveRetryRef.current = false;
    })
    .catch(async (error) => {
      const message = String(error?.message || error || 'Unknown save error');
      cloudSaveRetryRef.current = false;
      console.error('MIVCHAT cloud save failed:', error);
      setNotice(isExpiredSessionError(error)
        ? 'Your sign-in session expired and could not be refreshed. Please sign out and sign in again. Your saved chats have not been deleted.'
        : `Could not save your chats: ${message}`);
    });
  }, 450);

  return () => window.clearTimeout(saveTimer);
}, [chats, user?.id, cloudReadyUserId]);

  // Ensure that the selected conversation always exists.
  useEffect(() => {
    if (!chats.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(chats[0]?.id ?? null);
    }
  }, [chats, activeChatId]);
  // Remember the active conversation for each signed-in account.
useEffect(() => {
  if (!user || cloudReadyUserId !== user.id || !activeChatId) {
    return;
  }

  if (!chats.some((chat) => chat.id === activeChatId)) {
    return;
  }

  try {
    sessionStorage.setItem(
      `mivchat-active-chat-${user.id}`,
      activeChatId
    );
  } catch (error) {
    console.warn('Could not remember the active chat:', error);
  }
}, [activeChatId, chats, user?.id, cloudReadyUserId]);

  // Scroll the actual conversation container, not the whole page.
  // If the user scrolls upward to read older content, don't pull them down.
  const scrollToBottom = useCallback((behavior = 'smooth', force = false) => {
    const container = conversationRef.current;
    if (!container) return;

    if (!force && !shouldAutoScrollRef.current) {
      setShowScrollButton(
        container.scrollHeight - container.scrollTop - container.clientHeight > 160
      );
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });

    setShowScrollButton(false);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollToBottom('smooth');
    });

    return () => cancelAnimationFrame(frame);
  }, [activeChatId, activeChat?.messages, isLoading, scrollToBottom]);

  // Keep the textarea at a comfortable height as the user types.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [input]);

  function handleConversationScroll() {
    const container = conversationRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    shouldAutoScrollRef.current = distanceFromBottom < 120;
    setShowScrollButton(distanceFromBottom > 180);
  }

  function handleNewChat() {
    const chat = createChat();

    setChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
    setInput('');
    setSelectedFiles([]);
    setNotice('');
    setEditingMessageId(null);
    setIsSidebarOpen(true);
    shouldAutoScrollRef.current = true;
  }

  function handleRenameChat(id) {
    const title = editingChatTitle.trim().slice(0, 60);
    if (!title) { setEditingChatId(null); setEditingChatTitle(''); return; }
    setChats((current) => current.map((chat) => chat.id === id ? { ...chat, title, updatedAt: Date.now() } : chat));
    setEditingChatId(null);
    setEditingChatTitle('');
  }

  function toggleChatMeta(id, key) {
    setChatMeta((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), [key]: !(current[id]?.[key] === true) },
    }));
  }

  function startStudyActivity(activity) {
    const topic = studyTopic.trim();
    if (!topic) { setNotice('Enter a topic first so MIVCHAT knows what you want to study.'); return; }
    const prompts = {
      quiz: `Act as my study tutor. Create a quiz about "${topic}". Ask me one question at a time, wait for my answer, then explain whether I was correct and why. Start with question 1 and do not reveal the answer yet.`,
      flashcards: `Create study flashcards about "${topic}". Give me 10 concise cards in a clear numbered format. Each card should have a question on the front and its answer on the back, separated clearly. After the cards, offer to quiz me.`,
      notes: `Teach me "${topic}" step by step. Start with beginner-friendly notes, define every important term, use practical examples, then give me a short recap and 5 practice questions without answers.`,
      explain: `Teach me "${topic}" from beginner level. Explain each new term in simple words, use practical examples, check my understanding, and build up gradually.`,
    };
    handleNewChat();
    setAssistantMode('study');
    setInput(prompts[activity] || prompts.explain);
    setShowStudyTools(false);
    setNotice('');
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function handleRemoveGalleryImage(item) {
    try {
      await deleteMivchatImage(item.id);
      setGalleryImages((current) => current.filter((imageItem) => imageItem.id !== item.id));
    } catch (error) { setNotice(`Could not remove this image: ${error.message || 'storage error'}`); }
  }

  async function handleDeleteChat(id) {
    const chatToDelete = chats.find((chat) => chat.id === id);
    if (!chatToDelete) return;

    // Mark deleted before changing React state so stale autosaves cannot restore it.
    deletedChatIdsRef.current.add(id);

    const remaining = chats.filter((chat) => chat.id !== id);
    const nextChats = remaining.length > 0 ? remaining : [createChat()];
    setChats(nextChats);
    if (activeChatId === id) setActiveChatId(nextChats[0]?.id ?? null);

    // The queue ensures any already-running save finishes before this deletion,
    // and later queued saves will skip this chat because of the tombstone above.
    if (user?.id) {
      const userId = user.id;
      cloudSaveQueueRef.current = cloudSaveQueueRef.current
        .catch(() => {})
        .then(async () => {
          const { error: messageDeleteError } = await runSupabaseQueryWithRefresh(() =>
            supabase.from('messages').delete().eq('chat_id', id)
          );
          if (messageDeleteError) throw messageDeleteError;

          const { error: chatDeleteError } = await runSupabaseQueryWithRefresh(() =>
            supabase.from('chats').delete().eq('id', id).eq('user_id', userId)
          );
          if (chatDeleteError) throw chatDeleteError;
        })
        .catch((error) => {
          console.error('MIVCHAT chat deletion failed:', error);
          setNotice(`The chat was removed from this view, but could not be deleted from your account: ${error.message || 'unknown database error'}. Please try again after checking your connection.`);
        });
    }
  }

  function handleSelectChat(id) {
    setActiveChatId(id);
    setInput('');
    setSelectedFiles([]);
    setNotice('');
    setEditingMessageId(null);
    shouldAutoScrollRef.current = true;

    if (window.innerWidth <= 850) {
      setIsSidebarOpen(false);
    }
  }

function addFiles(fileList) {
  const incoming = Array.from(fileList || []);
  if (!incoming.length) return;

  const MAX_FILE_SIZE = 8 * 1024 * 1024;
  const MAX_TOTAL_SIZE = 12 * 1024 * 1024;
  const MAX_FILES = 10;

  const allowedExtensions =
    /\.(txt|md|csv|json|js|jsx|ts|tsx|py|php|html|css|scss|less|c|cpp|h|hpp|sql|xml|pdf|docx|pptx|xlsx|png|jpe?g|webp)$/i;

  const existingKeys = new Set(
    selectedFiles.map(
      (file) => `${file.name}:${file.size}:${file.lastModified}`
    )
  );

  const accepted = [];
  const rejected = [];

  let totalSize = selectedFiles.reduce(
    (sum, file) => sum + file.size,
    0
  );

  for (const file of incoming) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;

    if (!allowedExtensions.test(file.name)) {
      rejected.push(`${file.name}: unsupported file type`);
    } else if (file.size > MAX_FILE_SIZE) {
      rejected.push(`${file.name}: exceeds the 8 MB limit`);
    } else if (existingKeys.has(key)) {
      // Ignore duplicate selections.
      continue;
    } else if (selectedFiles.length + accepted.length >= MAX_FILES) {
      rejected.push(`${file.name}: maximum 10 files per message`);
    } else if (totalSize + file.size > MAX_TOTAL_SIZE) {
      rejected.push(`${file.name}: combined upload limit is 12 MB`);
    } else {
      accepted.push(file);
      existingKeys.add(key);
      totalSize += file.size;
    }
  }

  if (accepted.length) {
    setSelectedFiles((current) => [...current, ...accepted]);
  }

  setNotice(
    [
      accepted.length ? `${accepted.length} file(s) added.` : '',
      ...rejected,
    ]
      .filter(Boolean)
      .join(' ')
  );
}
  function handleFiles(event) {
    addFiles(event.target.files);
    event.target.value = '';
  }

  function handleDragEnter(event) {
    event.preventDefault();
    dragDepthRef.current += 1;

    if (event.dataTransfer?.types?.includes('Files')) {
      setIsDraggingFiles(true);
    }
  }

  function handleDragLeave(event) {
    event.preventDefault();
    dragDepthRef.current -= 1;

    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  function handleDrop(event) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    addFiles(event.dataTransfer.files);
  }

async function handleGenerateFile() {
  if (!fileContent.trim()) {
    setNotice('Please enter some content for your file.');
    return;
  }

  if (isGeneratingFile) return;

  setIsGeneratingFile(true);
  setNotice('');

  try {
    const response = await fetch(
      `${API_BASE}/api/files/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: fileTitle.trim() || 'MIVCHAT document',
          format: fileFormat,
          content: fileContent,
        }),
        signal: AbortSignal.timeout(60000),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'File generation failed.');
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = objectUrl;
    link.download = `${(fileTitle.trim() || 'MIVCHAT document')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 100)}.${fileFormat}`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

    setNotice(`${fileFormat.toUpperCase()} file generated successfully.`);
  } catch (error) {
    setNotice(error.message || 'Could not generate the file.');
  } finally {
    setIsGeneratingFile(false);
  }
}

// Recognize direct image-creation requests without treating ordinary questions
// about images or image-generation technology as requests to create one.
function isImageGenerationRequest(message) {
  const text = String(message || '').trim();
  if (!text) return false;

  if (/^(?:how|why|when|where|what|which|who|explain|describe|teach me|tell me)\b/i.test(text)) {
    return false;
  }

  const imageNoun = '(?:image|picture|illustration|artwork|wallpaper|poster|logo|icon|drawing|portrait)';
  const creationVerb = '(?:create|generate|draw|make|design|paint|illustrate|render|produce)';

  // Direct art commands like "draw a cat" are image requests even if the
  // user does not explicitly say the word image or picture.
  if (/^(?:please\s+)?(?:draw|paint|illustrate)\b/i.test(text)) {
    return true;
  }

  // Examples: "Create an image of a cat", "make a logo", "generate a picture of..."
  if (new RegExp(`\\b${creationVerb}\\b.{0,100}\\b${imageNoun}s?\\b`, 'i').test(text)) {
    return true;
  }

  // Also accept short direct prompts such as "an image of a futuristic city".
  if (new RegExp(`^(?:please\\s+)?(?:an?\\s+)?${imageNoun}\\s+(?:of|showing|with|for)\\b`, 'i').test(text)) {
    return true;
  }

  return false;
}

async function handleSend(event) {
  event?.preventDefault();

  const text = input.trim();

  if ((!text && selectedFiles.length === 0) || isLoading || !activeChat) {
    return;
  }

  const filesToSend = [...selectedFiles];
  const chatId = activeChat.id;
  const previousMessages = activeChat.messages;
  const shouldGenerateTitle = previousMessages.length === 0;
  const titleSeed = text || filesToSend[0]?.name || 'File analysis';
  // The Create Image button remains available, but direct image prompts now
  // trigger the same image endpoint automatically from the normal chat box.
  const shouldGenerateImage = imageMode || (filesToSend.length === 0 && isImageGenerationRequest(text));

  const userMessage = {
    id: createId(),
    role: 'user',
    content: text,
    files: filesToSend.map((file) => ({
      name: file.name,
      size: file.size,
      type: getMimeType(file),
    })),
  };

  const updatedMessages = [...previousMessages, userMessage];

  shouldAutoScrollRef.current = true;

  setChats((current) =>
    current.map((chat) =>
      chat.id === chatId
        ? {
            ...chat,
            title:
              chat.messages.length === 0
                ? fallbackChatTitle(titleSeed)
                : chat.title,
            messages: updatedMessages,
            updatedAt: Date.now(),
          }
        : chat
    )
  );

  setInput('');
  setSelectedFiles([]);
  setNotice('');
  setIsLoading(true);
  setLoadingAction(shouldGenerateImage ? 'image' : 'send');
  setIsGeneratingImage(shouldGenerateImage);
  setStreamingText('');
  setStreamingChatId(chatId);

  try {
    if (shouldGenerateImage) {
      if (!text) throw new Error('Describe the image you want MIVCHAT to create.');
      if (filesToSend.length > 0) {
        throw new Error('Image creation currently uses your written prompt. Remove attachments or turn off Create Image mode first.');
      }

      const imageResponse = await fetch(`${API_BASE}/api/chat/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({ prompt: text }),
      });
      const imageResult = await imageResponse.json().catch(() => ({}));
      if (!imageResponse.ok) {
        throw new Error(imageResult.error || 'MIVCHAT could not create that image. Please try another prompt.');
      }
      if (!imageResult.imageData) throw new Error('The image service returned no image. Please try again.');

      const imageMessage = {
        id: createId(),
        role: 'assistant',
        content: imageResult.text || '🎨 Your image is ready! You can preview it below and download it.',
        imageData: imageResult.imageData,
        imageMimeType: imageResult.mimeType || 'image/png',
      };
      setChats((current) => current.map((chat) => chat.id === chatId
        ? { ...chat, messages: [...chat.messages, imageMessage], updatedAt: Date.now() }
        : chat));
      const libraryItem = {
        id: imageMessage.id, chatId, prompt: text,
        imageData: imageResult.imageData,
        imageMimeType: imageResult.mimeType || 'image/png',
        createdAt: Date.now(),
      };
      try {
        await saveMivchatImage(libraryItem);
        setGalleryImages((current) => [libraryItem, ...current.filter((item) => item.id !== libraryItem.id)]);
      } catch (libraryError) {
        console.warn('The image was generated but could not be saved to the gallery:', libraryError);
      }
      shouldAutoScrollRef.current = true;
      if (shouldGenerateTitle) {
        void generateChatTitle(titleSeed, 'Generated an image from the user prompt.').then((title) => {
          setChats((current) => current.map((chat) => {
            if (chat.id !== chatId || chat.messages[0]?.content !== text) return chat;
            return { ...chat, title, updatedAt: Date.now() };
          }));
        });
      }
      setImageMode(false);
      return;
    }

    // Ask for browser location only when the question needs local/current context.
    // The browser will request permission; if denied, MIVCHAT must ask for a city.
    const locationContext = await getLocationContextForMessage(text);

    // Send the actual files, conversation history, and consented location context.
    const reply = await requestAI(
      updatedMessages,
      filesToSend,
      locationContext,
      (chunk) => setStreamingText((current) => current + chunk),
      assistantMode,
      { responseLength }
    );

    const assistantMessage = {
      id: createId(),
      role: 'assistant',
      content: reply,
    };

    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, assistantMessage],
              updatedAt: Date.now(),
            }
          : chat
      )
    );

    shouldAutoScrollRef.current = true;

    // Title generation runs after the answer and never blocks the response.
    if (shouldGenerateTitle) {
      void generateChatTitle(titleSeed, reply).then((title) => {
        setChats((current) => current.map((chat) => {
          if (chat.id !== chatId || chat.messages[0]?.content !== text) return chat;
          return { ...chat, title, updatedAt: Date.now() };
        }));
      });
    }
  } catch (error) {
    setNotice(
      error.message || 'Something went wrong while contacting MIVCHAT.'
    );
  } finally {
    setIsLoading(false);
    setLoadingAction('');
    setIsGeneratingImage(false);
    setStreamingText('');
    setStreamingChatId(null);
  }
}

  function handleDeleteMessage(chatId, messageId) {
    const chat = chats.find((item) => item.id === chatId);
    if (!chat) return;
    const messageIndex = chat.messages.findIndex((item) => item.id === messageId);
    if (messageIndex < 0) return;

    const confirmed = window.confirm(
      'Delete this message and everything after it? This keeps the conversation history consistent.'
    );
    if (!confirmed) return;

    const remainingMessages = chat.messages.slice(0, messageIndex);
    setChats((current) => current.map((item) => item.id === chatId
      ? { ...item, title: remainingMessages.length ? item.title : 'New chat', messages: remainingMessages, updatedAt: Date.now() }
      : item));
    setNotice('Message and later replies removed. Your saved chat will sync shortly.');
    if (editingMessageId === messageId) {
      setEditingMessageId(null);
      setEditingText('');
    }
  }

  async function handleSaveEdit(chatId, messageId) {
    const revisedText = editingText.trim();

    if (!revisedText || isLoading) return;

    const chat = chats.find((item) => item.id === chatId);
    if (!chat) return;

    const messageIndex = chat.messages.findIndex(
      (message) => message.id === messageId
    );

    if (messageIndex === -1 || chat.messages[messageIndex].role !== 'user') {
      return;
    }

    const revisedMessages = [
      ...chat.messages.slice(0, messageIndex),
      { ...chat.messages[messageIndex], content: revisedText },
    ];

    shouldAutoScrollRef.current = true;

    setChats((current) =>
      current.map((item) =>
        item.id === chatId
          ? {
              ...item,
              title:
                messageIndex === 0
                  ? revisedText.slice(0, 36) +
                    (revisedText.length > 36 ? '…' : '')
                  : item.title,
              messages: revisedMessages,
              updatedAt: Date.now(),
            }
          : item
      )
    );

    setEditingMessageId(null);
    setEditingText('');
    setNotice('');
    setIsLoading(true);
    setLoadingAction('edit');

    try {
      const reply = await requestAI(revisedMessages, [], '', undefined, assistantMode, { responseLength });

      setChats((current) =>
        current.map((item) =>
          item.id === chatId
            ? {
                ...item,
                messages: [
                  ...revisedMessages,
                  { id: createId(), role: 'assistant', content: reply },
                ],
                updatedAt: Date.now(),
              }
            : item
        )
      );
    } catch (error) {
      setNotice(`Your edit was saved, but MIVCHAT could not reply: ${error.message}`);
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  }

  async function handleRegenerate(messageIndex) {
    if (isLoading || !activeChat) return;

    const chatId = activeChat.id;
    const context = activeChat.messages.slice(0, messageIndex);

    if (!context.length || context[context.length - 1].role !== 'user') {
      setNotice('There is no user message available to regenerate a response for.');
      return;
    }

    setNotice('');
    setIsLoading(true);
    setLoadingAction('regenerate');
    shouldAutoScrollRef.current = true;

    try {
      const reply = await requestAI(context, [], '', undefined, assistantMode, { responseLength });
      const replacement = {
        id: createId(),
        role: 'assistant',
        content: reply,
      };

      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [...context, replacement],
                updatedAt: Date.now(),
              }
            : chat
        )
      );
    } catch (error) {
      setNotice(`Could not regenerate the response: ${error.message}`);
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  }

  async function handleCopy(message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(null), 1800);
    } catch {
      setNotice('Copy failed. Select the message text and copy it manually.');
    }
  }

  function handleVoiceInput() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setNotice('Voice input is not supported here. Try a recent version of Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
      setNotice('Listening… speak now.');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((current) => `${current} ${transcript}`.trim());
      setNotice('Voice input added to your message.');
    };

    recognition.onerror = () => {
      setNotice('Voice input failed. Check your microphone permissions.');
    };

    recognition.onend = () => setListening(false);

    try {
      recognition.start();
    } catch {
      setListening(false);
      setNotice('Could not start voice input. Please try again.');
    }
  }

  function handlePrompt(prompt) {
    setInput(prompt);
    textareaRef.current?.focus();
  }

  function openLivePreview(code, language) {
    setPreviewDocument(code);
    setPreviewLanguage(language || 'html');
    setPreviewVersion((version) => version + 1);
  }

  function openPreviewInNewTab() {
    if (previewDocument == null) return;
    const blob = new Blob([previewDocument], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) setNotice('Your browser blocked the new tab. Allow pop-ups and try again.');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const filteredChats = chats
    .filter((chat) => (chatMeta[chat.id]?.archived === true) === showArchivedChats)
    .filter((chat) => chat.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const pinnedDifference = Number(chatMeta[b.id]?.pinned === true) - Number(chatMeta[a.id]?.pinned === true);
      return pinnedDifference || b.updatedAt - a.updatedAt;
    });

  const allGalleryImages = [...galleryImages].sort((a, b) => b.createdAt - a.createdAt);

  if (!isSessionReady) {
  return (
    <div className="mivchat-auth-loading" role="status" aria-label="Loading MIVCHAT">
      <div className="hero-orb">
        <div className="hero-orb-inner">
          <Sparkles size={35} />
        </div>
      </div>
    </div>
  );
}

if (showLandingPage) {
  return (
    <LandingPage
        isLight={isLight}
        onToggleTheme={() => setIsLight((current) => !current)}
        onEnter={() => setShowLandingPage(false)}
        onSignIn={() => {
          setShowLandingPage(false);
          resetAuthForm();
          setNotice('');
          setAuthMode('signin');
        }}
        onSignUp={() => {
          setShowLandingPage(false);
          resetAuthForm();
          setNotice('');
          setAuthMode('signup');
        }}
      />
    );
  }

  return (
    <div
      className={`mivchat ${isLight ? 'light' : ''} ${previewDocument !== null ? 'has-live-preview' : ''}`}
      style={{ '--mivchat-text-scale': textScale / 100 }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {(!isSessionReady || isLoadingChats) && (
        <div className="mivchat-loading-bar" role="status" aria-label="Restoring your MIVCHAT workspace">
          <span />
        </div>
      )}

      {isDraggingFiles && (
        <div className="drop-overlay">
          <div>
            <Paperclip size={35} />
            <strong>Drop files to attach them</strong>
            <span>Text, code, PDF, and common image files up to 15 MB</span>
          </div>
        </div>
      )}

      {isSidebarOpen && (
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
<svg
  className="mivchat-star-logo"
  viewBox="0 0 64 64"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-label="MIVCHAT star logo"
>
  <defs>
    <linearGradient
      id="mivchatStarGradient"
      x1="0"
      y1="0"
      x2="1"
      y2="1"
    >
      <stop offset="0%" stopColor="#42f5d4" />
      <stop offset="48%" stopColor="#8c7bff" />
      <stop offset="100%" stopColor="#c084fc" />
    </linearGradient>
  </defs>
  <path
    d="M32 3 L39 23 L59 32 L39 39 L32 59 L25 39 L5 32 L25 23 Z"
    fill="url(#mivchatStarGradient)"
  />
  <path
    d="M49 5 L51 12 L58 14 L51 16 L49 23 L47 16 L40 14 L47 12 Z"
    fill="#7fffea"
  />
  <circle cx="15" cy="49" r="3" fill="#a78bfa" />
</svg>
</div>
            <div className="brand-name">
              <span>MIV</span>CHAT
              <small>YOUR AI SPACE</small>
            </div>
            <button
              className="icon-button sidebar-close"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close sidebar"
              title="Close sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>

          <button className="new-chat-button" onClick={handleNewChat}>
            <Plus size={19} />
            <span>New chat</span>
            <span className="shortcut">＋</span>
          </button>

          <div className="workspace-shortcuts">
            <button type="button" onClick={() => setShowImageGallery(true)}><Image size={16} /><span>Image gallery</span><small>{allGalleryImages.length}</small></button>
            <button type="button" onClick={() => { setShowStudyTools(true); setNotice(''); }}><GraduationCap size={16} /><span>Study tools</span></button>
            <button type="button" onClick={() => setShowSettings(true)}><SlidersHorizontal size={16} /><span>Preferences</span></button>
          </div>

          <label className="sidebar-search">
            <Search size={17} />
            <input
              type="text"
              placeholder="Search conversations"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          <div className="sidebar-section-title">
            <span>{showArchivedChats ? 'ARCHIVED CHATS' : 'YOUR CONVERSATIONS'}</span>
            <button type="button" className="archive-filter-button" onClick={() => setShowArchivedChats((value) => !value)} title={showArchivedChats ? 'Show active chats' : 'Show archived chats'}><Archive size={13} /> {showArchivedChats ? 'Active' : 'Archive'}</button>
            <span>{filteredChats.length}</span>
          </div>

          <div className="chat-history">
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                className={`history-row ${chat.id === activeChatId ? 'active' : ''}`}
              >
                {editingChatId === chat.id ? (
                  <form className="history-rename-form" onSubmit={(event) => { event.preventDefault(); handleRenameChat(chat.id); }}>
                    <input autoFocus maxLength={60} value={editingChatTitle} onChange={(event) => setEditingChatTitle(event.target.value)} aria-label="Conversation title" />
                    <button type="submit" title="Save title" aria-label="Save title"><Check size={14} /></button>
                    <button type="button" title="Cancel rename" aria-label="Cancel rename" onClick={() => { setEditingChatId(null); setEditingChatTitle(''); }}><X size={14} /></button>
                  </form>
                ) : (
                  <button className="history-select" onClick={() => handleSelectChat(chat.id)} title={chat.title}>
                    {chatMeta[chat.id]?.pinned ? <Bookmark size={15} className="pinned-chat-icon" /> : <MessageCircle size={16} />}
                    <span>{chat.title}</span>
                  </button>
                )}
                {editingChatId !== chat.id && (
                  <div className="history-actions">
                    <button className={`history-action ${chatMeta[chat.id]?.pinned ? 'selected' : ''}`} onClick={() => toggleChatMeta(chat.id, 'pinned')} aria-label={chatMeta[chat.id]?.pinned ? 'Unpin conversation' : 'Pin conversation'} title={chatMeta[chat.id]?.pinned ? 'Unpin' : 'Pin'}><Bookmark size={13} /></button>
                    <button className="history-action" onClick={() => { setEditingChatId(chat.id); setEditingChatTitle(chat.title); }} aria-label={`Rename ${chat.title}`} title="Rename"><Pencil size={13} /></button>
                    <button className="history-action" onClick={() => toggleChatMeta(chat.id, 'archived')} aria-label={chatMeta[chat.id]?.archived ? 'Unarchive conversation' : 'Archive conversation'} title={chatMeta[chat.id]?.archived ? 'Unarchive' : 'Archive'}><Archive size={13} /></button>
                    <button className="history-delete" onClick={() => handleDeleteChat(chat.id)} aria-label={`Delete ${chat.title}`} title="Delete conversation"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            ))}

            {filteredChats.length === 0 && (
              <p className="empty-history">No matching conversations.</p>
            )}
          </div>

          <div className="sidebar-bottom">
            <div className="privacy-note">
              <ShieldCheck size={17} />
              <div>
                <strong>Your space, your ideas</strong>
                <span>Conversations saved in this browser</span>
              </div>
            </div>

            {user ? (
  <div className="profile-button">
    <div className="profile-avatar">
      <UserRound size={19} />
    </div>

    <div className="profile-text">
      <strong>
        {user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email ||
          'Signed-in user'}
      </strong>
      <span>{user.email}</span>
    </div>

    <button
      className="icon-button"
      onClick={handleSignOut}
      title="Sign out"
      aria-label="Sign out"
    >
      <LogIn size={18} />
    </button>
  </div>
) : (
  <button
    className="profile-button"
    onClick={() => {
      resetAuthForm();
      setNotice('');
      setAuthMode('signin');
    }}
  >
    <div className="profile-avatar">
      <UserRound size={19} />
    </div>

    <div className="profile-text">
      <strong>Guest user</strong>
      <span>Sign in to access your account</span>
    </div>

    <Settings size={18} />
  </button>
)}
          </div>
        </aside>
      )}

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            {!isSidebarOpen && (
              <button
                className="icon-button"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open sidebar"
                title="Open sidebar"
              >
                <Menu size={20} />
              </button>
            )}

            <div className="model-selector">
              <div className="model-dot" />
              <span>MIVCHAT</span>
              <span className="model-label">AI</span>
            </div>
          </div>

          <div className="topbar-actions">
            <button type="button" className="icon-button" onClick={() => setShowSettings(true)} title="Preferences" aria-label="Open preferences"><Settings size={18} /></button>
            <button
              className="icon-button theme-button"
              onClick={() => setIsLight((current) => !current)}
              title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-label="Toggle color theme"
            >
              {isLight ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            {!user && (
  <>
    <button
      className="signin-button"
      onClick={() => {
      resetAuthForm();
      setNotice('');
      setAuthMode('signin');
      }}
    >
      Sign in
    </button>

    <button
      className="signup-button"
      onClick={() => {
      resetAuthForm();
      setNotice('');
      setAuthMode('signup');
    }}
    >
      Sign up
    </button>
  </>
)}
          </div>
        </header>

        <section
          className="conversation-area"
          ref={conversationRef}
          onScroll={handleConversationScroll}
        >
          {activeChat?.messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="hero-orb">
                <div className="hero-orb-inner"><Sparkles size={35} /></div>
              </div>

              <div className="eyebrow">
                <span className="eyebrow-line" />
                A NEW WAY TO THINK
                <span className="eyebrow-line" />
              </div>

              <h1>Your ideas,<br /><span>in motion.</span></h1>
              <p className="welcome-description">
                Ask questions, explore possibilities, and turn your curiosity
                into something extraordinary.
              </p>

              <div className="suggestion-grid">
                <button
                  className="suggestion-card"
                  onClick={() => handlePrompt('Teach me something fascinating, step by step.')}
                >
                  <span className="suggestion-icon violet"><Sparkles size={19} /></span>
                  <strong>Learn something new</strong>
                  <span>Understand a difficult concept simply</span>
                </button>
                <button
                  className="suggestion-card"
                  onClick={() => handlePrompt('Help me brainstorm a creative project idea.')}
                >
                  <span className="suggestion-icon blue"><ImagePlus size={19} /></span>
                  <strong>Create something</strong>
                  <span>Explore ideas and creative possibilities</span>
                </button>
                <button
                  className="suggestion-card"
                  onClick={() => handlePrompt('Help me plan and solve a problem step by step.')}
                >
                  <span className="suggestion-icon pink"><FileText size={19} /></span>
                  <strong>Solve a problem</strong>
                  <span>Break a challenge into clear steps</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {activeChat?.messages.map((message, index) => (
                <article
                  key={message.id}
                  className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
                >
                  <div className={`message-avatar ${message.role === 'assistant' ? 'assistant-avatar' : 'user-avatar'}`}>
                    {message.role === 'user'
                      ? <UserRound size={18} />
                      : <Sparkles size={18} />}
                  </div>

                  <div className="message-body">
                    <div className="message-author">
                      {message.role === 'user' ? 'You' : 'MIVCHAT'}
                    </div>

                    {message.files?.length > 0 && (
                      <div className="message-files">
                        {message.files.map((file, fileIndex) => (
                          <div className="message-file" key={`${file.name}-${fileIndex}`}>
                            <FileText size={15} />
                            <span>{file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {message.role === 'user' && editingMessageId === message.id ? (
                      <div className="message-edit-form">
                        <textarea
                          className="message-edit-textarea"
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              handleSaveEdit(activeChat.id, message.id);
                            }
                            if (event.key === 'Escape') {
                              setEditingMessageId(null);
                              setEditingText('');
                            }
                          }}
                          aria-label="Edit your message"
                          autoFocus
                        />
                        <div className="message-edit-actions">
                          <button
                            className="edit-save-button"
                            onClick={() => handleSaveEdit(activeChat.id, message.id)}
                            disabled={!editingText.trim() || isLoading}
                          >
                            <Check size={15} /> Save & resend
                          </button>
                          <button
                            className="edit-cancel-button"
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditingText('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="message-content">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex, rehypeHighlight]}
                        components={{
                          a: ({ node, ...props }) => (
                            <a {...props} target="_blank" rel="noreferrer noopener" />
                          ),
                          pre: ({ children }) => (
                            <CodeBlock onPreview={openLivePreview}>{children}</CodeBlock>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                      </div>
                    )}

                    {message.imageData && (
                      <div className="generated-image-card">
                        <img
                          src={`data:${message.imageMimeType || 'image/png'};base64,${message.imageData}`}
                          alt="Image generated by MIVCHAT"
                          loading="lazy"
                        />
                        <button
                          type="button"
                          className="generated-image-download"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = `data:${message.imageMimeType || 'image/png'};base64,${message.imageData}`;
                            const extension = (message.imageMimeType || 'image/png').split('/')[1] || 'png';
                            link.download = `mivchat-image-${Date.now()}.${extension === 'jpeg' ? 'jpg' : extension}`;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                          }}
                        >
                          <Download size={15} /> Download image
                        </button>
                      </div>
                    )}

                    {message.role === 'user' && editingMessageId !== message.id && (
                      <div className="message-actions">
                        <button
                          onClick={() => {
                            setEditingMessageId(message.id);
                            setEditingText(message.content);
                          }}
                          disabled={isLoading}
                          title="Edit message"
                          aria-label="Edit message"
                        >
                          <Pencil size={14} /><span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleCopy(message)}
                          title="Copy message"
                          aria-label="Copy message"
                        >
                          {copiedMessageId === message.id
                            ? <Check size={14} />
                            : <Copy size={14} />}
                          <span>{copiedMessageId === message.id ? 'Copied' : 'Copy'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(activeChat.id, message.id)}
                          disabled={isLoading}
                          title="Delete this message and later replies"
                          aria-label="Delete this message and later replies"
                        >
                          <Trash2 size={14} /><span>Delete</span>
                        </button>
                      </div>
                    )}

                    {message.role === 'assistant' && (
                      <div className="message-actions assistant-actions">
                        <button
                          onClick={() => handleCopy(message)}
                          title="Copy response"
                          aria-label="Copy response"
                        >
                          {copiedMessageId === message.id
                            ? <Check size={14} />
                            : <Copy size={14} />}
                          <span>{copiedMessageId === message.id ? 'Copied' : 'Copy'}</span>
                        </button>
                        <button
                          onClick={() => handleRegenerate(index)}
                          disabled={isLoading}
                          title="Regenerate response"
                          aria-label="Regenerate response"
                        >
                          <RefreshCw size={14} /><span>Regenerate</span>
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(activeChat.id, message.id)}
                          disabled={isLoading}
                          title="Delete this message and later replies"
                          aria-label="Delete this message and later replies"
                        >
                          <Trash2 size={14} /><span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}

              {isLoading && streamingChatId === activeChat?.id && streamingText && (
                <article className="message assistant-message streaming-message">
                  <div className="message-avatar assistant-avatar"><Sparkles size={18} /></div>
                  <div className="message-body">
                    <div className="message-author">MIVCHAT</div>
                    <div className="message-content streaming-content" style={{ whiteSpace: 'pre-wrap' }}>
                      {streamingText}
                    </div>
                  </div>
                </article>
              )}

              {isLoading && (
                <div className="thinking-indicator">
                  <div className="message-avatar assistant-avatar"><Sparkles size={18} /></div>
                  <div>
                    <strong>MIVCHAT</strong>
                    <span>
                      <LoaderCircle size={15} className="spin" />
                      {loadingAction === 'regenerate'
                        ? 'Regenerating response…'
                        : loadingAction === 'edit'
                          ? 'Updating response…'
                          : 'Thinking…'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {showScrollButton && (
          <button
            className="scroll-bottom-button"
            onClick={() => {
              shouldAutoScrollRef.current = true;
              scrollToBottom('smooth', true);
            }}
            aria-label="Scroll to latest message"
            title="Scroll to latest message"
          >
            <ChevronDown size={18} />
          </button>
        )}

        <footer className="composer-section">
        

{showFileCreator && (
  <section className="file-creator">
    <div className="file-creator-header">
      <div className="file-creator-heading">
        <div className="file-creator-logo">
          <Sparkles size={22} />
        </div>

        <div>
          <span className="file-creator-eyebrow">MIVCHAT STUDIO</span>
          <h2>Create something useful</h2>
          <p>Turn your ideas into downloadable files.</p>
        </div>
      </div>

      <button
        type="button"
        className="icon-button file-creator-close"
        onClick={() => setShowFileCreator(false)}
        aria-label="Close file creator"
        title="Close"
      >
        <X size={19} />
      </button>
    </div>

    <div className="file-creator-body">
      <div className="file-creator-section-title">
        <span className="file-creator-step">01</span>
        <div>
          <h3>Choose a format</h3>
          <p>Select the type of file you want to create.</p>
        </div>
      </div>

      <div className="file-format-grid">
        {[
            { id: 'txt', name: 'Text', ext: '.txt', icon: 'TXT', color: 'mint' },
            { id: 'md', name: 'Markdown', ext: '.md', icon: 'MD', color: 'violet' },
            { id: 'html', name: 'HTML', ext: '.html', icon: '</>', color: 'orange' },
            { id: 'css', name: 'CSS', ext: '.css', icon: '#', color: 'blue' },
            { id: 'scss', name: 'SCSS', ext: '.scss', icon: 'SCSS', color: 'pink' },
            { id: 'less', name: 'LESS', ext: '.less', icon: 'LESS', color: 'blue' },
            { id: 'js', name: 'JavaScript', ext: '.js', icon: 'JS', color: 'yellow' },
            { id: 'mjs', name: 'JavaScript module', ext: '.mjs', icon: 'MJS', color: 'yellow' },
            { id: 'cjs', name: 'CommonJS', ext: '.cjs', icon: 'CJS', color: 'yellow' },
            { id: 'ts', name: 'TypeScript', ext: '.ts', icon: 'TS', color: 'blue' },
            { id: 'jsx', name: 'React JSX', ext: '.jsx', icon: 'JSX', color: 'blue' },
            { id: 'tsx', name: 'React TSX', ext: '.tsx', icon: 'TSX', color: 'blue' },
            { id: 'py', name: 'Python', ext: '.py', icon: 'PY', color: 'blue' },
            { id: 'php', name: 'PHP', ext: '.php', icon: 'PHP', color: 'violet' },
            { id: 'c', name: 'C language', ext: '.c', icon: 'C', color: 'blue' },
            { id: 'h', name: 'C header', ext: '.h', icon: 'H', color: 'blue' },
            { id: 'cpp', name: 'C++', ext: '.cpp', icon: 'C++', color: 'blue' },
            { id: 'hpp', name: 'C++ header', ext: '.hpp', icon: 'HPP', color: 'blue' },
            { id: 'java', name: 'Java', ext: '.java', icon: 'JAVA', color: 'orange' },
            { id: 'cs', name: 'C#', ext: '.cs', icon: 'C#', color: 'violet' },
            { id: 'go', name: 'Go', ext: '.go', icon: 'GO', color: 'blue' },
            { id: 'rs', name: 'Rust', ext: '.rs', icon: 'RS', color: 'orange' },
            { id: 'rb', name: 'Ruby', ext: '.rb', icon: 'RB', color: 'red' },
            { id: 'swift', name: 'Swift', ext: '.swift', icon: 'SW', color: 'orange' },
            { id: 'kt', name: 'Kotlin', ext: '.kt', icon: 'KT', color: 'violet' },
            { id: 'dart', name: 'Dart', ext: '.dart', icon: 'DART', color: 'blue' },
            { id: 'vue', name: 'Vue component', ext: '.vue', icon: 'VUE', color: 'green' },
            { id: 'svelte', name: 'Svelte component', ext: '.svelte', icon: 'SV', color: 'orange' },
            { id: 'sql', name: 'SQL', ext: '.sql', icon: 'SQL', color: 'blue' },
            { id: 'sh', name: 'Shell script', ext: '.sh', icon: 'SH', color: 'green' },
            { id: 'ps1', name: 'PowerShell', ext: '.ps1', icon: 'PS', color: 'blue' },
            { id: 'bat', name: 'Windows batch', ext: '.bat', icon: 'BAT', color: 'green' },
            { id: 'json', name: 'JSON', ext: '.json', icon: '{}', color: 'green' },
            { id: 'xml', name: 'XML', ext: '.xml', icon: 'XML', color: 'orange' },
            { id: 'csv', name: 'CSV', ext: '.csv', icon: 'CSV', color: 'green' },
            { id: 'tsv', name: 'TSV', ext: '.tsv', icon: 'TSV', color: 'green' },
            { id: 'yaml', name: 'YAML', ext: '.yaml', icon: 'YML', color: 'orange' },
            { id: 'yml', name: 'YML', ext: '.yml', icon: 'YML', color: 'orange' },
            { id: 'toml', name: 'TOML config', ext: '.toml', icon: 'TOML', color: 'blue' },
            { id: 'ini', name: 'INI config', ext: '.ini', icon: 'INI', color: 'blue' },
            { id: 'log', name: 'Log file', ext: '.log', icon: 'LOG', color: 'green' },
            { id: 'env', name: 'Environment file', ext: '.env', icon: 'ENV', color: 'green' },
            { id: 'svg', name: 'SVG image', ext: '.svg', icon: 'SVG', color: 'purple' },
            { id: 'pdf', name: 'PDF document', ext: '.pdf', icon: 'PDF', color: 'red' },
            { id: 'docx', name: 'Word document', ext: '.docx', icon: 'DOC', color: 'blue' },
            { id: 'pptx', name: 'PowerPoint', ext: '.pptx', icon: 'PPT', color: 'orange' },
            { id: 'xlsx', name: 'Excel sheet', ext: '.xlsx', icon: 'XLS', color: 'green' },
            { id: 'zip', name: 'ZIP archive', ext: '.zip', icon: 'ZIP', color: 'violet' },
].map((format) => (
          <button
            type="button"
            key={format.id}
            className={`file-format-card ${fileFormat === format.id ? 'selected' : ''}`}
            onClick={() => setFileFormat(format.id)}
            aria-pressed={fileFormat === format.id}
          >
            <span className={`file-format-icon ${format.color}`}>
              {format.icon}
            </span>

            <span className="file-format-details">
              <strong>{format.name}</strong>
              <small>{format.ext}</small>
            </span>

            {fileFormat === format.id && (
              <span className="file-format-check">
                <Check size={13} />
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="file-creator-section-title file-details-title">
        <span className="file-creator-step">02</span>
        <div>
          <h3>Add your content</h3>
          <p>Give your file a name and add its contents.</p>
        </div>
      </div>

      <label className="file-field">
        <span>File name</span>
        <div className="file-name-input-wrap">
          <FileText size={18} />
          <input
            value={fileTitle}
            onChange={(event) => setFileTitle(event.target.value)}
            placeholder="My document"
            maxLength={100}
            aria-label="File name"
          />
          <span className="file-extension">.{fileFormat}</span>
        </div>
      </label>

      <label className="file-field">
        <span>Content <small>— what should go inside?</small></span>
        <textarea
          className="file-content-editor"
          value={fileContent}
          onChange={(event) => setFileContent(event.target.value)}
          placeholder={
            fileFormat === 'py'
              ? 'print("Hello, world!")'
              : fileFormat === 'html'
                ? '<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Hello, world!</h1>\n  </body>\n</html>'
                : 'Write or paste your content here...'
          }
          rows={7}
          maxLength={500000}
          spellCheck={fileFormat === 'txt' || fileFormat === 'md'}
        />
        <span className="file-editor-footer">
          <span>Changes appear in your preview automatically.</span>
          <span>{fileContent.length.toLocaleString()} characters</span>
        </span>
      </label>

      <div className="file-preview">
        <div className="file-preview-header">
          <div className="file-preview-title">
            <Eye size={16} />
            <strong>Live preview</strong>
          </div>
          <span className="file-preview-badge">
            {fileFormat.toUpperCase()}
          </span>
        </div>

        <div className="file-preview-filename">
          <FileText size={16} />
          <span>
            {(fileTitle.trim() || 'My document')}.{fileFormat}
          </span>
        </div>

        <pre>
          {fileContent || 'Your file content will appear here as you type.'}
        </pre>
      </div>

      <div className="file-creator-actions">
        <div className="file-creator-hint">
          <ShieldCheck size={16} />
          <span>Your file is generated locally through your MIVCHAT server.</span>
        </div>

        <button
          type="button"
          className="file-generate-button"
          onClick={handleGenerateFile}
          disabled={!fileContent.trim() || isGeneratingFile}
        >
          {isGeneratingFile ? (
            <>
              <LoaderCircle size={18} className="spin" />
              Generating file...
            </>
          ) : (
            <>
              <FileText size={18} />
              Generate & Download
              <span className="file-button-arrow">↗</span>
            </>
          )}
        </button>
      </div>
    </div>
  </section>
)}


          <form className={`composer ${assistantMode !== 'normal' ? `mode-${assistantMode}` : ''}`} onSubmit={handleSend}>
            <div className="assistant-mode-switch" role="group" aria-label="Choose assistant mode">
              <button
                type="button"
                className={`assistant-mode-button ${assistantMode === 'normal' ? 'selected' : ''}`}
                onClick={() => setAssistantMode('normal')}
                aria-pressed={assistantMode === 'normal'}
                title="General-purpose chat"
              >
                <Sparkles size={15} /> <span>Normal</span>
              </button>
              <button
                type="button"
                className={`assistant-mode-button ${assistantMode === 'research' ? 'selected' : ''}`}
                onClick={() => setAssistantMode('research')}
                aria-pressed={assistantMode === 'research'}
                title="Prioritize evidence, web research, and source transparency"
              >
                <Globe2 size={15} /> <span>Research</span>
              </button>
              <button
                type="button"
                className={`assistant-mode-button ${assistantMode === 'study' ? 'selected' : ''}`}
                onClick={() => setAssistantMode('study')}
                aria-pressed={assistantMode === 'study'}
                title="Learn concepts step by step and practise"
              >
                <BookOpen size={15} /> <span>Study</span>
              </button>
              {assistantMode !== 'normal' && (
                <span className="assistant-mode-description">
                  {assistantMode === 'research'
                    ? 'Evidence-first answers; sources when available'
                    : 'Step-by-step teaching and practice'}
                </span>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  handleSend(event);
                }
              }}
              placeholder={imageMode ? "Describe the image you want to create…" : "Message MIVCHAT…"}
              rows={1}
              aria-label="Message MIVCHAT"
            />

            {selectedFiles.length > 0 && (
              <div className="selected-files">
                {selectedFiles.map((file, index) => (
                  <div
                    className="file-chip"
                    key={`${file.name}-${file.size}-${index}`}
                  >
                    <FileText size={15} />
                    <div className="file-chip-info">
                      <span>{file.name}</span>
                      <small>{formatFileSize(file.size)}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles((current) =>
                        current.filter((_, i) => i !== index)
                      )}
                      aria-label={`Remove ${file.name}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="composer-toolbar">
              <div className="composer-tools">
                <button
  type="button"
  className={`tool-button ${showFileCreator ? 'active' : ''}`}
  onClick={() => setShowFileCreator((current) => !current)}
  title="Create and download a file"
>
  <FileText size={18} />
  <span>Create File</span>
</button>

<button
  type="button"
  className={`tool-button image-mode-toggle ${imageMode ? 'active' : ''}`}
  onClick={() => {
    setImageMode((current) => !current);
    if (!imageMode) setNotice('🎨 Create Image is on. Describe what you want to see, then press Send.');
  }}
  title="Generate an image from a text prompt"
  aria-pressed={imageMode}
  disabled={isGeneratingImage}
>
  <ImagePlus size={18} />
  <span>{imageMode ? 'Image mode on' : 'Create Image'}</span>
</button>

<span className="tool-divider" />
                <button
                  type="button"
                  className="tool-button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach files"
                >
                  <Paperclip size={18} /><span>Attach</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.html,.css,.scss,.less,.js,.mjs,.cjs,.ts,.jsx,.tsx,.py,.php,.c,.h,.cpp,.hpp,.java,.cs,.go,.rs,.rb,.swift,.kt,.dart,.vue,.svelte,.sql,.sh,.ps1,.bat,.json,.xml,.csv,.tsv,.yaml,.yml,.toml,.ini,.log,.env,.svg,.pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.webp,.zip"
                  onChange={handleFiles}
                  hidden
                />
                <span className="tool-divider" />
                <button
                  type="button"
                  className={`tool-button ${listening ? 'listening' : ''}`}
                  onClick={handleVoiceInput}
                  title="Use voice input"
                >
                  <Mic size={18} /><span>{listening ? 'Listening…' : 'Voice'}</span>
                </button>
                <span className="composer-hint">Enter to send · Shift + Enter for a new line</span>
              </div>

              <button
                className="send-button"
                type="submit"
                disabled={(!input.trim() && selectedFiles.length === 0) || isLoading}
                aria-label="Send message"
                title={imageMode ? "Generate image" : "Send message"}
              >
                {isLoading
                  ? <LoaderCircle size={19} className="spin" />
                  : <Send size={18} />}
              </button>
            </div>
          </form>

          {notice && (
            <div className="notice-message" role="status">
              <AlertCircle size={15} />
              <span>{notice}</span>
              <button onClick={() => setNotice('')} aria-label="Dismiss message">
                <X size={14} />
              </button>
            </div>
          )}

          <p className="disclaimer">
            MIVCHAT can make mistakes. Check important information.
          </p>
        </footer>
      </main>

      {previewDocument !== null && (
  <>
    <div
      className="preview-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize chat and preview panels"
      title="Drag to resize the preview"
      onPointerDown={(event) => {
        event.preventDefault();
        setIsResizingPreview(true);
      }}
    />

    <aside
      className="preview-workspace"
      aria-label="Live preview workspace"
      style={{
        width: `${previewWidth}px`,
        flexBasis: `${previewWidth}px`,
      }}
    >
          <header className="preview-workspace-header">
            <div className="preview-workspace-title">
              <Eye size={18} />
              <div className="preview-workspace-heading">
                <strong>Preview</strong>
                <span>Rendered output</span>
              </div>
              <span className={`preview-workspace-language language-badge-${previewLanguage}`}>
                {previewLanguage.toUpperCase()}
              </span>
            </div>
            <div className="preview-workspace-actions">
              <button
                type="button"
                className="preview-workspace-button"
                onClick={() => setPreviewVersion((version) => version + 1)}
                title="Refresh preview"
                aria-label="Refresh preview"
              >
                <RefreshCw size={16} />
              </button>
              <button
                type="button"
                className="preview-workspace-button"
                onClick={openPreviewInNewTab}
                title="Open output in a new tab"
                aria-label="Open output in a new tab"
              >
                <Plus size={17} />
                <span>New tab</span>
              </button>
              <button
                type="button"
                className="preview-workspace-button preview-close-button"
                onClick={() => setPreviewDocument(null)}
                title="Close preview"
                aria-label="Close preview"
              >
                <X size={19} />
              </button>
            </div>
          </header>
          <div className="preview-workspace-content">
            <iframe
              key={previewVersion}
              title="Live rendered output"
              sandbox="allow-scripts"
              srcDoc={previewDocument}
              className="preview-workspace-frame"
            />
          </div>
        </aside>
        </>
      )}

      {showGuestReminder && !user && !authMode && (
        <div className="guest-reminder-backdrop" role="presentation">
          <section className="guest-reminder-card" role="dialog" aria-modal="true" aria-labelledby="guest-reminder-title">
            <button
              type="button"
              className="guest-reminder-close"
              aria-label="Close sign-in reminder"
              onClick={() => {
                setShowGuestReminder(false);
                try { sessionStorage.setItem('mivchat-guest-reminder-dismissed', 'yes'); } catch {}
              }}
            ><X size={18} /></button>
            <div className="guest-reminder-icon"><Sparkles size={27} /></div>
            <p className="guest-reminder-eyebrow">YOUR IDEAS DESERVE A HOME ✨</p>
            <h2 id="guest-reminder-title">Enjoying MIVCHAT?</h2>
            <p>Sign in or create a free account to keep your conversations saved and pick up where you left off. You can absolutely keep exploring as a guest, too.</p>
            <button
              type="button"
              className="guest-reminder-primary"
              onClick={() => {
                setShowGuestReminder(false);
                setNotice('');
                setAuthMode('signup');
              }}
            ><UserRound size={17} /> Create a free account</button>
            <button
              type="button"
              className="guest-reminder-secondary"
              onClick={() => {
                setShowGuestReminder(false);
                try { sessionStorage.setItem('mivchat-guest-reminder-dismissed', 'yes'); } catch {}
              }}
            >Continue as guest</button>
            <span className="guest-reminder-footnote">No pressure — your choice, your pace. 💜</span>
          </section>
        </div>
      )}

      {showSettings && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSettings(false); }}>
          <section className="feature-modal preferences-modal" role="dialog" aria-modal="true" aria-labelledby="preferences-title">
            <button type="button" className="icon-button modal-close" onClick={() => setShowSettings(false)} aria-label="Close preferences"><X size={18} /></button>
            <div className="feature-modal-icon"><SlidersHorizontal size={23} /></div>
            <h2 id="preferences-title">MIVCHAT preferences</h2>
            <p className="feature-modal-subtitle">Make your workspace comfortable. Preferences are saved in this browser.</p>
            <div className="preference-row"><div><strong>Appearance</strong><span>Choose your workspace theme</span></div><div className="preference-control"><button type="button" className={`preference-choice ${isLight ? 'active' : ''}`} onClick={() => setIsLight(true)}><Sun size={15} /> Light</button><button type="button" className={`preference-choice ${!isLight ? 'active' : ''}`} onClick={() => setIsLight(false)}><Moon size={15} /> Dark</button></div></div>
            <div className="preference-row"><div><strong>Response detail</strong><span>Choose how much explanation you prefer</span></div><select value={responseLength} onChange={(event) => setResponseLength(event.target.value)}><option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></div>
            <div className="preference-row"><div><strong>Text size</strong><span>Adjust chat response readability</span></div><div className="preference-control">{[100, 110, 120].map((scale) => <button type="button" key={scale} className={`preference-choice ${textScale === scale ? 'active' : ''}`} onClick={() => setTextScale(scale)}>{scale === 100 ? 'Default' : scale === 110 ? 'Large' : 'XL'}</button>)}</div></div>
            <p className="feature-modal-footnote">Your response-detail preference is sent with new AI requests. Existing replies are not changed.</p><button type="button" className="feature-primary-button" onClick={() => setShowSettings(false)}>Save and close</button>
          </section>
        </div>
      )}

      {showImageGallery && (
        <div className="modal-backdrop gallery-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowImageGallery(false); }}>
          <section className="feature-modal gallery-modal" role="dialog" aria-modal="true" aria-labelledby="gallery-title">
            <button type="button" className="icon-button modal-close" onClick={() => setShowImageGallery(false)} aria-label="Close image gallery"><X size={18} /></button><div className="feature-modal-icon"><Image size={23} /></div><h2 id="gallery-title">Your image gallery</h2>
            <p className="feature-modal-subtitle">Generated images are saved in this browser's local image library, separate from your chat history.</p>
            {allGalleryImages.length ? <div className="image-gallery-grid">{allGalleryImages.map((item) => <article className="gallery-image-card" key={item.id}>
              <img src={`data:${item.imageMimeType || 'image/png'};base64,${item.imageData}`} alt={`Generated image: ${item.prompt || 'MIVCHAT artwork'}`} loading="lazy" />
              <div className="gallery-image-info"><p>{item.prompt || 'Generated image'}</p><small>{new Date(item.createdAt || Date.now()).toLocaleDateString()}</small></div>
              <div className="gallery-image-actions"><button type="button" onClick={() => { setInput(item.prompt || 'Create an image'); setImageMode(true); setShowImageGallery(false); window.setTimeout(() => textareaRef.current?.focus(), 0); }}><RefreshCw size={14} /> Regenerate</button><button type="button" onClick={() => { const link = document.createElement('a'); link.href = `data:${item.imageMimeType || 'image/png'};base64,${item.imageData}`; link.download = `mivchat-image-${Date.now()}.${(item.imageMimeType || 'image/png').split('/')[1] || 'png'}`; link.click(); }}><Download size={14} /> Download</button><button type="button" className="gallery-remove" onClick={() => handleRemoveGalleryImage(item)} title="Remove from gallery" aria-label="Remove image"><Trash2 size={14} /></button></div>
            </article>)}</div> : <div className="feature-empty-state"><Image size={30} /><strong>No generated images yet</strong><span>Ask MIVCHAT to create an image and it will appear here.</span></div>}
          </section>
        </div>
      )}

      {showStudyTools && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowStudyTools(false); }}>
          <section className="feature-modal study-modal" role="dialog" aria-modal="true" aria-labelledby="study-tools-title">
            <button type="button" className="icon-button modal-close" onClick={() => setShowStudyTools(false)} aria-label="Close study tools"><X size={18} /></button><div className="feature-modal-icon"><GraduationCap size={23} /></div><h2 id="study-tools-title">Study with MIVCHAT</h2>
            <p className="feature-modal-subtitle">Choose a learning activity. MIVCHAT will open a study conversation and guide you through it.</p>
            <label className="study-topic-field"><span>What are you studying?</span><input value={studyTopic} onChange={(event) => setStudyTopic(event.target.value)} placeholder="e.g. JavaScript arrays, logic gates, networking" onKeyDown={(event) => { if (event.key === 'Enter') startStudyActivity('explain'); }} autoFocus /></label>
            <div className="study-activity-grid"><button type="button" onClick={() => startStudyActivity('explain')}><BookOpen size={19} /><strong>Learn a topic</strong><span>Step-by-step explanation</span></button><button type="button" onClick={() => startStudyActivity('quiz')}><ListChecks size={19} /><strong>Take a quiz</strong><span>One question at a time</span></button><button type="button" onClick={() => startStudyActivity('flashcards')}><Layers size={19} /><strong>Flashcards</strong><span>Remember key concepts</span></button><button type="button" onClick={() => startStudyActivity('notes')}><FileText size={19} /><strong>Study notes</strong><span>Notes and practice questions</span></button></div>
            <p className="feature-modal-footnote">Tip: You can attach notes or a supported document in a chat, then ask MIVCHAT to quiz you on it.</p>
          </section>
        </div>
      )}

      {authMode && (
        <div
          key={authFormKey}
          className="modal-backdrop"
          onClick={() => {
            setAuthMode(null);
            setNotice('');
          }}
        >
          <section
            className="auth-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >
            <button
              className="icon-button modal-close"
              onClick={() => {
                setAuthMode(null);
                setNotice('');
              }}
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>

            <div className="auth-logo"><Sparkles size={25} /></div>
            <h2 id="auth-title">
              {authMode === 'signin' ? 'Welcome back.' : 'Create your space.'}
            </h2>
            <p className="auth-subtitle">
              {authMode === 'signin'
                ? 'Sign in to continue your journey with MIVCHAT.'
                : 'Join MIVCHAT and bring your ideas to life.'}
            </p>

            <button
              className="provider-button"
              onClick={async () => {
              setNotice('');

              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: window.location.origin,
                },
              });

              if (error) {
                  setNotice(error.message);
                }
              }}
            >
              <span className="google-mark"><FcGoogle size={19} /></span> Continue with Google
            </button>
            
<button
  className="provider-button"
  onClick={async () => {
    setNotice('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setNotice(`GitHub sign-in failed: ${error.message}`);
    }
  }}
>
  <span className="github-mark"><FaGithub size={19} /></span> Continue with GitHub
</button>

            <button
            className="provider-button"
            onClick={async () => {
              setNotice('');

              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: {
                  redirectTo: window.location.origin,
                },
              });

              if (error) {
                setNotice(`Discord sign-in failed: ${error.message}`);
              }
            }}
          >
            <FaDiscord size={19} />
            Continue with Discord
          </button>

            <div className="auth-divider"><span />or continue with email<span /></div>

            
<form
  className="auth-form"
  autoComplete="off"
  onSubmit={async (event) => {
    event.preventDefault();
    setNotice('');

    const formData = new FormData(event.currentTarget);

    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const name = String(formData.get('name') ?? '').trim();

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setNotice('Account created successfully! You are signed in.');
        } else {
          setNotice(
            'Account created. Check your email for a confirmation link before signing in.'
          );
        }
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (error) throw error;

        setNotice('Signed in successfully!');
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Authentication failed. Please try again.'
      );
    }
  }}
>
  {authMode === 'signup' && (
    <label>
      Your name
      <input
        type="text"
        name="name"
        placeholder="Enter your name"
        required
      />
    </label>
  )}

  
  <label>
    Email address
    <input
      type="email"
      name="email"
      placeholder="you@example.com"
      autoComplete="off"
      value={authEmail}
      onChange={(event) => setAuthEmail(event.target.value)}
      required
    />
  </label>

  <label>
    Password
    <div className="auth-password-field">
      <input
        type={showPassword ? 'text' : 'password'}
        name="password"
        placeholder="At least 8 characters"
        autoComplete="off"
        minLength={8}
        value={authPassword}
        onChange={(event) => setAuthPassword(event.target.value)}
        required
      />

      <button
        type="button"
        className="password-toggle"
        onClick={() => setShowPassword((current) => !current)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        title={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword
          ? <EyeOff size={18} />
          : <Eye size={18} />}
      </button>
    </div>
  </label>


  <button className="signup-button auth-submit" type="submit">
    {authMode === 'signin' ? <LogIn size={17} /> : <Mail size={17} />}
    {authMode === 'signin' ? 'Sign in' : 'Create account'}
  </button>
</form>


            {notice && <p className="auth-notice">{notice}</p>}

            <p className="auth-switch">
              {authMode === 'signin'
                ? "Don't have an account?"
                : 'Already have an account?'}
              <button
                onClick={() => {
                resetAuthForm();
                setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                setNotice('');
                }}
              >
                {authMode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
            <p className="auth-terms">
              By continuing, you agree to use MIVCHAT responsibly.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
