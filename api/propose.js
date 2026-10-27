// POST /api/propose  { note: string, lang?: "en" | "fr", pipeline?: "meeting" | "fieldnotes" }
// Nemotron proposes fields; the gate (plain code) decides which ones may enter
// the record. The model never writes the record.
import { chat, config, ModelMismatch } from './_lib/tokenfactory.js';
import { allow } from './_lib/ratelimit.js';
import { buildMessages, parseProposal } from '../src/core/prompt.js';
import { runGate } from '../src/core/gate.js';
import { getPipeline } from '../src/pipelines/index.js';

const MAX_NOTE = 4000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local').split(',')[0].trim();
  if (!allow(ip, Number(process.env.RATE_LIMIT_PER_HOUR) || 30)) {
    return res.status(429).json({ error: 'Demo limit reached for this hour. Please try again later.' });
  }

  const { note, lang = 'en', pipeline = 'meeting' } = req.body || {};
  const profile = getPipeline(pipeline);
  if (!profile) return res.status(400).json({ error: `unknown pipeline ${pipeline}` });
  if (typeof note !== 'string' || !note.trim()) return res.status(400).json({ error: 'note is required' });
  if (note.length > MAX_NOTE) return res.status(413).json({ error: `note is longer than ${MAX_NOTE} characters` });

  const cfg = config();
  const started = Date.now();
  try {
    const answer = await chat({ ...cfg, model: cfg.fastModel, messages: buildMessages(note, lang, profile) });
    const proposal = parseProposal(answer.text, profile);
    const gate = runGate(note, proposal, profile);
    return res.status(200).json({
      model: answer.model,
      ms: Date.now() - started,
      usage: answer.usage,
      proposal,
      gate
    });
  } catch (err) {
    const status = err instanceof ModelMismatch ? 502 : err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}
