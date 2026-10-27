import { useState } from 'react';
import { runGate } from './core/gate.js';
import { PIPELINES as PROFILES, DEFAULT_PIPELINE as DEFAULT_PROFILE, SCENARIOS } from './pipelines/index.js';

const STATUS = {
  accepted: { label: 'Accepted', cls: 'ok' },
  needs_confirmation: { label: 'Confirm', cls: 'ask' },
  rejected: { label: 'Rejected', cls: 'no' },
  not_stated: { label: 'Not stated', cls: 'none' }
};

const firstOf = (id) => SCENARIOS.find((s) => s.profile === id);

export default function App() {
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE);
  const profile = PROFILES[profileId];
  const [scenario, setScenario] = useState(firstOf(DEFAULT_PROFILE));
  const [note, setNote] = useState(firstOf(DEFAULT_PROFILE).note);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = (s) => { setScenario(s); setNote(s.note); setResult(null); setError(''); };
  const switchProfile = (id) => { setProfileId(id); pick(firstOf(id)); };

  async function propose() {
    setBusy(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/propose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note, lang: scenario?.lang || 'en', pipeline: profileId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult({ ...data.gate, source: `Live: ${data.model} on Nebius Token Factory, ${data.ms} ms` });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function runExample() {
    setError('');
    setNote(scenario.note);
    setResult({ ...runGate(scenario.note, scenario.example, profile), source: 'Hand-written example proposal (not model output), to show the gate offline' });
  }

  return (
    <div className="page">
      <header>
        <h1>FieldGuard</h1>
        <p className="tag">The model proposes. Code decides. Every field in the record quotes the note it comes from.</p>
      </header>

      <nav className="tabs" role="tablist" aria-label="What to turn into a record">
        {Object.values(PROFILES).map((p) => (
          <button key={p.id} role="tab" aria-selected={p.id === profileId} className={p.id === profileId ? 'tab on' : 'tab'} onClick={() => switchProfile(p.id)}>
            <strong>{p.label}</strong><span>{p.blurb}</span>
          </button>
        ))}
      </nav>

      <section className="card">
        <div className="chips" role="group" aria-label="Invented example notes">
          {SCENARIOS.filter((s) => s.profile === profileId).map((s) => (
            <button key={s.id} className={s.id === scenario?.id ? 'chip on' : 'chip'} onClick={() => pick(s)}>
              {s.lang.toUpperCase()} · {s.title}
            </button>
          ))}
        </div>
        <label htmlFor="note">{profileId === 'meeting' ? 'Meeting notes, one line per speaker (invented)' : 'Field note (invented, no real case data)'}</label>
        <textarea id="note" value={note} rows={6} onChange={(e) => { setNote(e.target.value); setScenario(null); }} />
        <div className="actions">
          <button className="primary" onClick={propose} disabled={busy || !note.trim()}>
            {busy ? 'Nemotron is proposing…' : 'Propose with Nemotron'}
          </button>
          <button className="secondary" onClick={runExample} disabled={!scenario}>Show the gate on an example</button>
        </div>
        {scenario && <p className="traps">Traps in this note: {scenario.traps.join(' · ')}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {result && (
        <>
          <section className="card">
            <div className="summary">
              {Object.entries(result.summary).map(([k, n]) => (
                <span key={k} className={`pill ${STATUS[k].cls}`}>{n} {STATUS[k].label.toLowerCase()}</span>
              ))}
            </div>
            <p className="source">{result.source}</p>
            <table>
              <thead><tr><th>Field</th><th>Proposed</th><th>Quote from the note</th><th>Gate</th></tr></thead>
              <tbody>
                {result.fields.map((f, i) => (
                  <tr key={`${f.name}-${i}`}>
                    <td>{profile.fields[f.name]?.label || f.name}{f.group && <span className="group"> #{f.group}</span>}</td>
                    <td>{f.value || '—'}{f.certainty === 'uncertain' && <em> (uncertain)</em>}</td>
                    <td className="quote">{f.quote ? `“${f.quote}”` : '—'}</td>
                    <td>
                      <span className={`pill ${STATUS[f.status].cls}`}>{STATUS[f.status].label}</span>
                      {f.reasons.map((r) => <div key={r} className="reason">{r}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {result.uncovered?.length > 0 && (
            <section className="card warn">
              <h2>Possibly missed: check these lines</h2>
              <p className="source">They read like a {[...new Set(result.uncovered.map((u) => u.kind))].join(' or ')}, but no proposal quotes them. The gate cannot judge what was never proposed, so a person checks.</p>
              <ul className="missed">
                {result.uncovered.map((u) => <li key={u.line}><span className="pill ask">{u.kind}</span> {u.line}</li>)}
              </ul>
            </section>
          )}

          <section className="card">
            <h2>Record written by the gate</h2>
            <p className="source">Only accepted fields. Fields marked “Confirm” wait for a person to confirm them.</p>
            <pre>{JSON.stringify(result.record, null, 2)}</pre>
          </section>
        </>
      )}

      <footer>
        Powered by NVIDIA Nemotron on Nebius Token Factory · Apache-2.0 · Built on the TRACE engine
      </footer>
    </div>
  );
}
