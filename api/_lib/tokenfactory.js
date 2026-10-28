// The one place FieldGuard talks to a model: NVIDIA Nemotron on Nebius Token
// Factory, through its OpenAI-compatible Chat Completions API.
//
// Lesson carried over from our red-teaming of Apertus: a gateway can answer
// with a different model than the one requested, and the only trace is the
// response's `model` field. So every answer is checked, and a mismatch is an
// error rather than a silent substitution.

export class ModelMismatch extends Error {
  constructor(requested, served) {
    super(`requested ${requested} but the gateway served ${served}`);
    this.name = 'ModelMismatch';
    this.requested = requested;
    this.served = served;
  }
}

const norm = (id) => String(id || '').toLowerCase().replace(/^nebius\//, '');

export function config(env = process.env) {
  return {
    apiKey: env.NEBIUS_API_KEY,
    baseUrl: (env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1').replace(/\/+$/, ''),
    fastModel: env.NEMOTRON_FAST_MODEL || 'nvidia/nemotron-3-super-120b-a12b',
    reasoningModel: env.NEMOTRON_REASONING_MODEL || 'nvidia/Nemotron-3-Ultra-550b-a55b',
    // Nemotron 3 models think before answering. For field extraction we turn it
    // off by default; set NEMOTRON_THINKING=on to keep it.
    thinking: (env.NEMOTRON_THINKING || 'off').toLowerCase() === 'on',
    // Second pass on rejected fields with the reasoning model (src/core/retry.js).
    // NEMOTRON_RETRY=off turns it off; past RETRY_TIMEOUT_MS the first pass stands.
    retry: (env.NEMOTRON_RETRY || 'on').toLowerCase() !== 'off',
    retryTimeoutMs: Number(env.RETRY_TIMEOUT_MS) || 20000,
    maxTokens: Number(env.NEMOTRON_MAX_TOKENS) || 4096
  };
}

/**
 * @returns {Promise<{text: string, model: string, usage: object|undefined}>}
 */
export class EmptyAnswer extends Error {
  constructor(finishReason, hadReasoning) {
    super(`the model returned no answer (finish_reason=${finishReason || 'unknown'}${hadReasoning ? ', it spent its budget thinking' : ''})`);
    this.name = 'EmptyAnswer';
    this.finishReason = finishReason;
    this.status = 502;
  }
}

export async function chat({ apiKey, baseUrl, model, messages, temperature = 0, maxTokens = 4096, thinking = false, json = true, fetchImpl = fetch }) {
  if (!apiKey) throw Object.assign(new Error('NEBIUS_API_KEY is not set'), { status: 500 });
  const body = { model, messages, temperature, max_tokens: maxTokens };
  if (json) body.response_format = { type: 'json_object' };
  if (!thinking) body.chat_template_kwargs = { enable_thinking: false };

  const res = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || data?.detail || `Token Factory HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (data.model && norm(data.model) !== norm(model)) throw new ModelMismatch(model, data.model);
  const choice = data.choices?.[0] || {};
  const text = choice.message?.content ?? '';
  if (!text.trim()) throw new EmptyAnswer(choice.finish_reason, Boolean(choice.message?.reasoning_content || choice.message?.reasoning));
  return { text, model: data.model || model, usage: data.usage, finishReason: choice.finish_reason };
}
