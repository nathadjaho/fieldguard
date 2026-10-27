import { config } from './_lib/tokenfactory.js';

export default function handler(_req, res) {
  const cfg = config();
  res.status(200).json({ ok: true, keyConfigured: Boolean(cfg.apiKey), fastModel: cfg.fastModel });
}
