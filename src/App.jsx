import { useEffect, useMemo, useRef, useState } from 'react';
import { evidence } from './evidence.js';
import { runGate } from './core/gate.js';
import { PIPELINES as PROFILES, DEFAULT_PIPELINE as DEFAULT_PROFILE, SCENARIOS } from './pipelines/index.js';

const STATUS = {
  accepted: { label: 'Accepted', cls: 'ok' },
  needs_confirmation: { label: 'Confirm', cls: 'ask' },
  rejected: { label: 'Rejected', cls: 'no' },
  not_stated: { label: 'Not stated', cls: 'none' }
};

const firstOf = (id) => SCENARIOS.find((s) => s.profile === id);
// "nvidia/Nemotron-3-Ultra-550b-a55b" reads as "Nemotron 3 Ultra" on the page.
const shortModel = (id) => { const m = String(id).split('/').pop().match(/nemotron-\d+-[a-z]+/i); return m ? m[0].replace(/-/g, ' ').replace(/^n/, 'N') : id; };

// The record as a caseworker or team lead would read it; the JSON stays one click away.
function RecordView({ record, profile }) {
  if (profile.id === 'meeting') {
    const { commitments = [], decisions = [] } = record;
    if (!commitments.length && !decisions.length) return <p className="empty">Nothing in the record yet: every proposal was refused or is waiting for a person.</p>;
    return (
      <dl className="record">
        {commitments.map((c, i) => (
          <div key={`c${i}`}><dt>Commitment</dt><dd><b>{c.owner}</b>: {c.action}{c.due && <span className="due"> · due {c.due}</span>}</dd></div>
        ))}
        {decisions.map((d, i) => <div key={`d${i}`}><dt>Decision</dt><dd>{d}</dd></div>)}
      </dl>
    );
  }
  const rows = Object.entries(record).filter(([, v]) => v);
  if (!rows.length) return <p className="empty">Nothing in the record yet: every proposal was refused or is waiting for a person.</p>;
  return (
    <dl className="record">
      {rows.map(([k, v]) => <div key={k}><dt>{profile.fields[k]?.label || k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

export default function App() {
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE);
  const profile = PROFILES[profileId];
  const [scenario, setScenario] = useState(firstOf(DEFAULT_PROFILE));
  const [note, setNote] = useState(firstOf(DEFAULT_PROFILE).note);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Fields a person confirmed or marked "not stated", keyed by row index.
  const [decided, setDecided] = useState({});
  const [showRows, setShowRows] = useState(false);
  const ev = useMemo(() => evidence(), []);
  // Results draw below the note; bring them into view so a click visibly does something.
  const resultRef = useRef(null);
  useEffect(() => { if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [result]);

  const pick = (s) => { setScenario(s); setNote(s.note); setResult(null); setError(''); setDecided({}); };
  const switchProfile = (id) => { setProfileId(id); pick(firstOf(id)); };

  async function propose() {
    setBusy(true); setError(''); setResult(null); setDecided({});
    try {
      const res = await fetch('/api/propose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note, lang: scenario?.lang || 'en', pipeline: profileId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const r = data.retry;
      const second = !r ? '' : r.error
        ? ` · second pass by ${r.model} skipped: ${r.error}`
        : ` · ${r.model} re-read ${r.fields} refused field${r.fields > 1 ? 's' : ''}, ${r.ms} ms`;
      setResult({ ...data.gate, source: `Live on Nebius Token Factory: ${data.model} proposed, ${data.ms} ms${second}` });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function runExample() {
    setError('');
    setDecided({});
    setNote(scenario.note);
    setResult({ ...runGate(scenario.note, scenario.example, profile), source: 'Hand-written example proposal (not model output), to show the gate offline' });
  }

  // The gate's record plus what a person confirmed. Confirming is the only way a
  // "Confirm" field reaches the record; the model still never writes it.
  const resultProfile = result ? PROFILES[result.profile] || profile : profile;
  const finalRecord = result
    ? resultProfile.buildRecord(result.fields.filter((f, i) => f.status === 'accepted' || decided[i] === 'confirmed'))
    : null;
  const pending = result ? result.fields.filter((f, i) => f.status === 'needs_confirmation' && !decided[i]).length : 0;
  const t = ev.totals;

  return (
    <div className="page">
      <header>
        <h1>FieldGuard</h1>
        <p className="tag">The model proposes. Code decides. Every field in the record quotes the note it comes from.</p>
      </header>

      {t.notes > 0 && (
        <section className="card evidence" aria-labelledby="ev-title">
          <h2 id="ev-title">Measured on NVIDIA Nemotron</h2>
          <p className="source">{t.notes} invented notes, {ev.model} on Nebius Token Factory, recorded {ev.date} and replayed here through the same gate (no model call).</p>
          <div className="kpis">
            <div className="kpi"><b>{t.wrongBefore} → {t.wrongAfter}</b><span>wrong values in the record, without → with the gate</span></div>
            <div className="kpi"><b>{t.firstRefused} → {t.refused}</b><span>values refused for lack of evidence, before → after Nemotron 3 Ultra re-read them ({t.fixed} fixed)</span></div>
            <div className="kpi"><b>{t.flagged} of {t.omitted}</b><span>meeting items the model left out, flagged for a person</span></div>
            <div className="kpi"><b>~{Math.round(t.tokens / t.notes)}</b><span>tokens per note ({t.tokens} in total)</span></div>
          </div>
          <button className="link" onClick={() => setShowRows((v) => !v)} aria-expanded={showRows}>
            {showRows ? 'Hide' : 'Show'} the {t.notes} notes
          </button>
          {showRows && (
            <table className="small">
              <thead><tr><th>Note</th><th>Wrong without → with</th><th>Refused</th><th>To confirm</th><th>Left out → flagged</th></tr></thead>
              <tbody>
                {ev.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.pipeline} · {r.lang.toUpperCase()} · {r.title}</td>
                    <td>{r.wrongBefore} → {r.wrongAfter}</td>
                    <td>{r.refused}</td>
                    <td>{r.toConfirm}</td>
                    <td>{r.omitted == null ? '—' : `${r.omitted} → ${r.flagged}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

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
        {error && (
          <div className="fallback" role="alert">
            <p><b>The live model call did not go through.</b> FieldGuard still works without it: the results measured on Nemotron are at the top of the page, and the button below runs the same gate on an example.</p>
            <p className="source">Details: {error}</p>
            {scenario && <button className="secondary" onClick={runExample}>Show the gate on an example</button>}
          </div>
        )}
      </section>

      {result && (
        <>
          <section className="card" ref={resultRef}>
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
                      {f.retry && (
                        <div className="retry">Second pass by {shortModel(f.retry.model)}. First answer “{f.retry.first.value}” was refused: {f.retry.first.reasons.join('; ')}</div>
                      )}
                      {f.status === 'needs_confirmation' && (
                        decided[i]
                          ? <div className="decided">{decided[i] === 'confirmed' ? '✓ Confirmed by a person' : 'Marked not stated'}
                              <button className="link" onClick={() => setDecided((d) => { const n = { ...d }; delete n[i]; return n; })}>Undo</button></div>
                          : <div className="decide">
                              <button className="mini ok" onClick={() => setDecided((d) => ({ ...d, [i]: 'confirmed' }))}>Confirm</button>
                              <button className="mini" onClick={() => setDecided((d) => ({ ...d, [i]: 'not_stated' }))}>Not stated</button>
                            </div>
                      )}
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
            <p className="source">Accepted fields, plus the ones a person confirmed.{pending > 0 && ` ${pending} field${pending > 1 ? 's' : ''} still waiting for confirmation.`}</p>
            <RecordView record={finalRecord} profile={resultProfile} />
            <details className="json"><summary>Show as JSON</summary><pre>{JSON.stringify(finalRecord, null, 2)}</pre></details>
          </section>
        </>
      )}

      <footer>
        Powered by NVIDIA Nemotron on Nebius Token Factory · Apache-2.0 · Built on the TRACE engine
      </footer>
    </div>
  );
}
