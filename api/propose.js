// POST /api/propose  { note: string, lang?: "en" | "fr", pipeline?: "meeting" | "fieldnotes" }
// Nemotron proposes fields; the gate (plain code) decides which ones may enter
// the record. The model never writes the record.
import { chat, config, ModelMismatch } from './_lib/tokenfactory.js';
import { allow } from './_lib/ratelimit.js';
import { buildMessages, parseProposal } from '../src/core/prompt.js';
import { runGate } from '../src/core/gate.js';
import { retryTargets, buildRetryMessages, mergeRetry } from '../src/core/retry.js';
import { getPipeline } from '../src/pipelines/index.js';

const MAX_NOTE = 4000;

// The reasoning model re-reads the fields the gate refused. If it fails or runs
// past the time limit, the first pass stands and the page says so.
export async function retryRejected({ cfg, note, lang, profile, gate, fetchImpl = fetch }) {
  const targets = retryTargets(gate);
  if (!cfg.retry || !targets.length) return { gate, retry: null };
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.retryTimeoutMs);
  try {
    const answer = await chat({
      ...cfg, model: cfg.reasoningModel, messages: buildRetryMessages(note, lang, profile, targets),
      fetchImpl: (url, init) => fetchImpl(url, { ...init, signal: ctrl.signal })
    });
    const merged = mergeRetry(note, profile, gate, answer.text, answer.model);
    return { gate: merged, retry: { model: answer.model, ms: Date.now() - started, usage: answer.usage, fields: targets.length } };
  } catch (err) {
    const why = err.name === 'AbortError' ? `no answer within ${cfg.retryTimeoutMs} ms` : err.message;
    return { gate, retry: { model: cfg.reasoningModel, ms: Date.now() - started, fields: targets.length, error: why } };
  } finally {
    clearTimeout(timer);
  }
}

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
    const firstMs = Date.now() - started;
    const first = runGate(note, proposal, profile);
    const { gate, retry } = await retryRejected({ cfg, note, lang, profile, gate: first });
    return res.status(200).json({
      model: answer.model,
      ms: firstMs,
      usage: answer.usage,
      proposal,
      gate,
      retry
    });
  } catch (err) {
    const status = err instanceof ModelMismatch ? 502 : err.status || 500;
    return res.status(status).json({ error: err.message });
  }
}
