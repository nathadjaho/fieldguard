import { describe, it, expect } from 'vitest';
import { chat, ModelMismatch, EmptyAnswer } from '../api/_lib/tokenfactory.js';

const fake = (body, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });
const base = { apiKey: 'k', baseUrl: 'https://example.test/v1', model: 'nvidia/nemotron-x', messages: [] };

describe('Token Factory client', () => {
  it('returns the text of the first choice', async () => {
    const r = await chat({ ...base, fetchImpl: fake({ model: 'nvidia/nemotron-x', choices: [{ message: { content: '{}' } }] }) });
    expect(r.text).toBe('{}');
  });
  it('refuses an answer served by another model', async () => {
    await expect(chat({ ...base, fetchImpl: fake({ model: 'some/other-model', choices: [] }) })).rejects.toBeInstanceOf(ModelMismatch);
  });
  it('treats an empty answer as an error, never as an empty form', async () => {
    await expect(chat({ ...base, fetchImpl: fake({ model: 'nvidia/nemotron-x', choices: [{ finish_reason: 'length', message: { content: '', reasoning_content: '...' } }] }) }))
      .rejects.toBeInstanceOf(EmptyAnswer);
  });
  it('turns thinking off unless asked', async () => {
    let sent;
    const spy = async (_u, init) => { sent = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{}' } }] }) }; };
    await chat({ ...base, fetchImpl: spy });
    expect(sent.chat_template_kwargs).toEqual({ enable_thinking: false });
    await chat({ ...base, thinking: true, fetchImpl: spy });
    expect(sent.chat_template_kwargs).toBeUndefined();
  });
  it('surfaces HTTP errors with their status', async () => {
    await expect(chat({ ...base, fetchImpl: fake({ error: { message: 'bad key' } }, 401) })).rejects.toMatchObject({ status: 401 });
  });
});
