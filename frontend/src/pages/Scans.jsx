import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getScans, startScan, getFindings } from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────────
const ENGINE_COLORS = {
  garak: '#6366F1', promptfoo: '#0ABFBC', pyrit: '#F59E0B',
  deepteam: '#10B981', fuzzyai: '#EF4444', semgrep_ai: '#8B5CF6',
  opengovai_native: '#1B9BE0',
};
const ENGINE_LABELS = {
  garak: 'Garak', promptfoo: 'Promptfoo', pyrit: 'PyRIT',
  deepteam: 'DeepTeam', fuzzyai: 'FuzzyAI', semgrep_ai: 'Semgrep',
  opengovai_native: 'OpenGovAI',
};
const ALL_ENGINES = ['garak','promptfoo','pyrit','deepteam','fuzzyai','semgrep_ai','opengovai_native'];
const ALL_CHECKS  = ['prompt_injection','data_privacy','jailbreak','agentic_governance','bias_fairness','rag_security','supply_chain','operational_security','eu_ai_act'];
const ALL_FRAMEWORKS = ['eu_ai_act','nist_ai_rmf','owasp_llm','iso_42001','gdpr'];

function riskClass(s) {
  if (!s) return 'low';
  if (s >= 9) return 'critical';
  if (s >= 7) return 'high';
  if (s >= 4) return 'medium';
  return 'low';
}

function dur(scan) {
  if (!scan.completed_at || !scan.created_at) return '—';
  const ms = new Date(scan.completed_at) - new Date(scan.created_at);
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function SeverityBar({ counts = {} }) {
  const { critical=0, high=0, medium=0, low=0 } = counts;
  return (
    <div className="sev-bar">
      {critical > 0 && <span className="sev-chip c">C{critical}</span>}
      {high     > 0 && <span className="sev-chip h">H{high}</span>}
      {medium   > 0 && <span className="sev-chip m">M{medium}</span>}
      {low      > 0 && <span className="sev-chip l">L{low}</span>}
      {!critical && !high && !medium && !low && <span style={{fontSize:11,color:'var(--text-muted)'}}>—</span>}
    </div>
  );
}

function StatusBadge({ status, progress }) {
  if (status === 'running') return (
    <span className="status-running">
      <span className="pulse-ring" />
      RUNNING {progress > 0 ? `${progress}%` : ''}
    </span>
  );
  if (status === 'completed') return <span className="status-completed">✓ Complete</span>;
  if (status === 'failed')    return <span className="status-failed">✗ Failed</span>;
  return <span className="status-queued">◌ {status?.toUpperCase()}</span>;
}

// ── Sortable column header ─────────────────────────────────────────────────────
function SortTh({ col, label, sort, onSort, style={} }) {
  const active = sort.col === col;
  return (
    <th
      className={`sortable ${active ? sort.dir : ''}`}
      onClick={() => onSort(col)}
      style={style}
    >
      {label}
    </th>
  );
}

// ── New Scan Modal ─────────────────────────────────────────────────────────────
function NewScanModal({ onClose, onStart }) {
  const [target, setTarget] = useState('');
  const [engines, setEngines] = useState(['garak','promptfoo','opengovai_native']);
  const [checks, setChecks]   = useState(['all']);
  const [frameworks, setFw]   = useState(['eu_ai_act','owasp_llm']);
  const [submitting, setSub]  = useState(false);

  const toggleArr = (arr, setArr, val) =>
    setArr(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);

  const Chip = ({ val, arr, setArr, color, label }) => {
    const on = arr.includes(val);
    return (
      <button
        onClick={() => toggleArr(arr, setArr, val)}
        style={{
          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
          cursor: 'pointer', border: `1px solid ${on ? (color||'var(--accent)') : 'var(--border)'}`,
          background: on ? `${color||'var(--accent)'}18` : 'transparent',
          color: on ? (color||'var(--accent)') : 'var(--text-muted)',
          transition: 'all 0.15s', fontFamily: 'var(--font-mono)',
        }}
      >{label || val}</button>
    );
  };

  const handleStart = async () => {
    if (!target.trim()) return;
    setSub(true);
    try {
      await onStart({ target, engines, checks, compliance_frameworks: frameworks });
      onClose();
    } catch { setSub(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 560 }}>
        <div className="modal-title" style={{ marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>⟳ New Security Scan</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Configure and launch a scan against an AI target</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Target */}
          <div className="form-group">
            <label>Target *</label>
            <input
              value={target} onChange={e => setTarget(e.target.value)}
              placeholder="openai:gpt-4o  |  anthropic:claude-3-5-sonnet  |  http://localhost:8000/api/chat"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
            />
          </div>

          {/* Engines */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>SCAN ENGINES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_ENGINES.map(e => (
                <Chip key={e} val={e} arr={engines} setArr={setEngines}
                  color={ENGINE_COLORS[e]} label={ENGINE_LABELS[e]} />
              ))}
            </div>
          </div>

          {/* Checks */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>CHECK CATEGORIES</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Chip val="all" arr={checks} setArr={setChecks} label="All Checks" />
              {ALL_CHECKS.map(c => (
                <Chip key={c} val={c} arr={checks.filter(x=>x!=='all')} 
                  setArr={v => setChecks(v.length ? v : ['all'])}
                  label={c.replace(/_/g,' ')} />
              ))}
            </div>
          </div>

          {/* Frameworks */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>COMPLIANCE MAPPING</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_FRAMEWORKS.map(f => (
                <Chip key={f} val={f} arr={frameworks} setArr={setFw}
                  label={f.replace(/_/g,' ').toUpperCase()} />
              ))}
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'rgba(27,155,224,0.06)', borderRadius: 6, border: '1px solid rgba(27,155,224,0.2)', fontSize: 12, color: 'var(--text-secondary)' }}>
            Scans run in the background. Results appear in real time as each engine completes.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={submitting || !target.trim() || engines.length === 0}
          >
            {submitting ? '⟳ Queuing…' : '⟳ Launch Scan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Scan Detail Side Panel ─────────────────────────────────────────────────────
function ScanDetailPanel({ scan, findings, onClose, onDelete }) {
  const [tab, setTab] = useState('summary'); // summary | findings | probes | raw
  const printRef = useRef();

  const handlePrint = () => {
    const w = window.open('', '_blank');
    const css = Array.from(document.styleSheets)
      .flatMap(s => { try { return Array.from(s.cssRules).map(r => r.cssText); } catch { return []; } })
      .join('\n');

    const fc = scan.findings_count || {};
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Scan Report — ${scan.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'JetBrains Mono', 'Courier New', monospace; background: #fff; color: #1a1a2e; padding: 40px; font-size: 12px; }
  h1 { font-size: 22px; color: #0D1B2A; margin-bottom: 4px; }
  h2 { font-size: 14px; color: #1B6CA8; margin: 24px 0 10px; border-bottom: 2px solid #E0EAF4; padding-bottom: 6px; }
  h3 { font-size: 12px; color: #333; margin: 16px 0 6px; }
  .meta { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin: 20px 0; }
  .meta-cell { background: #F4F8FC; border: 1px solid #C8DCF0; border-radius: 6px; padding: 10px 12px; }
  .meta-label { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; }
  .meta-val { font-size: 16px; font-weight: 700; color: #0D2137; }
  .sev-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin: 16px 0; }
  .sev-cell { padding: 14px; border-radius: 6px; text-align: center; }
  .sev-cell.c { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); }
  .sev-cell.h { background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.3); }
  .sev-cell.m { background: rgba(234,179,8,0.08);  border: 1px solid rgba(234,179,8,0.3); }
  .sev-cell.l { background: rgba(34,197,94,0.08);  border: 1px solid rgba(34,197,94,0.3); }
  .sev-num { font-size: 28px; font-weight: 700; }
  .sev-cell.c .sev-num { color: #EF4444; }
  .sev-cell.h .sev-num { color: #F97316; }
  .sev-cell.m .sev-num { color: #EAB308; }
  .sev-cell.l .sev-num { color: #22C55E; }
  .sev-lbl { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .finding { border: 1px solid #E0EAF4; border-radius: 6px; padding: 14px; margin-bottom: 10px; page-break-inside: avoid; }
  .finding-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .finding-title { font-size: 13px; font-weight: 700; color: #0D2137; }
  .finding-id { font-size: 10px; color: #6B7280; font-family: monospace; }
  .sev-badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
  .sev-badge.critical { background: rgba(239,68,68,0.1); color: #EF4444; }
  .sev-badge.high     { background: rgba(249,115,22,0.1); color: #F97316; }
  .sev-badge.medium   { background: rgba(234,179,8,0.1);  color: #EAB308; }
  .sev-badge.low      { background: rgba(34,197,94,0.1);  color: #22C55E; }
  .field-label { font-size: 10px; color: #6B7280; text-transform: uppercase; font-weight: 600; margin: 8px 0 3px; }
  .field-val { font-size: 11px; color: #2C3E50; line-height: 1.6; }
  .refs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .ref-tag { font-size: 9px; padding: 1px 6px; background: #EBF4FF; border: 1px solid #C8DCF0; border-radius: 3px; color: #1B6CA8; }
  .engines { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
  .eng-tag { font-size: 10px; padding: 2px 8px; background: #F4F8FC; border: 1px solid #C8DCF0; border-radius: 12px; color: #374151; }
  .score-big { font-size: 48px; font-weight: 700; text-align: center; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E0EAF4; font-size: 10px; color: #6B7280; display: flex; justify-content: space-between; }
  @page { margin: 20mm; }
</style>
</head>
<body>
<h1>OpenGovAI — Scan Report</h1>
<div style="font-size:11px; color:#6B7280; margin-bottom:20px;">Generated ${new Date().toLocaleString()} · ${scan.id}</div>

<div class="meta">
  <div class="meta-cell"><div class="meta-label">Target</div><div class="meta-val" style="font-size:13px">${scan.target || scan.asset_id || '—'}</div></div>
  <div class="meta-cell"><div class="meta-label">Risk Score</div><div class="meta-val" style="color:${scan.risk_score>=7?'#EF4444':scan.risk_score>=4?'#EAB308':'#22C55E'}">${scan.risk_score?.toFixed(1) ?? '—'} / 10</div></div>
  <div class="meta-cell"><div class="meta-label">Duration</div><div class="meta-val">${dur(scan)}</div></div>
  <div class="meta-cell"><div class="meta-label">Status</div><div class="meta-val" style="font-size:13px;text-transform:uppercase">${scan.status}</div></div>
  <div class="meta-cell"><div class="meta-label">Total Probes</div><div class="meta-val">${scan.total_probes ?? '—'}</div></div>
  <div class="meta-cell"><div class="meta-label">Date</div><div class="meta-val" style="font-size:12px">${new Date(scan.created_at).toLocaleDateString()}</div></div>
</div>

<h2>Scan Engines</h2>
<div class="engines">${(scan.engines||[]).map(e=>`<span class="eng-tag">${ENGINE_LABELS[e]||e}</span>`).join('')}</div>

<h2>Findings Summary</h2>
<div class="sev-grid">
  <div class="sev-cell c"><div class="sev-num">${fc.critical||0}</div><div class="sev-lbl">Critical</div></div>
  <div class="sev-cell h"><div class="sev-num">${fc.high||0}</div><div class="sev-lbl">High</div></div>
  <div class="sev-cell m"><div class="sev-num">${fc.medium||0}</div><div class="sev-lbl">Medium</div></div>
  <div class="sev-cell l"><div class="sev-num">${fc.low||0}</div><div class="sev-lbl">Low</div></div>
</div>

${findings.length > 0 ? `
<h2>Detailed Findings (${findings.length})</h2>
${findings.sort((a,b)=>['critical','high','medium','low','info'].indexOf(a.severity)-['critical','high','medium','low','info'].indexOf(b.severity))
  .map(f=>`
<div class="finding">
  <div class="finding-header">
    <div>
      <div class="finding-title">${f.title}</div>
      <div class="finding-id">${f.id} · ${f.category}</div>
    </div>
    <span class="sev-badge ${f.severity}">${f.severity?.toUpperCase()} · ${f.risk_score?.toFixed(1)}</span>
  </div>
  <div class="field-label">Description</div><div class="field-val">${f.description}</div>
  <div class="field-label">Evidence</div><div class="field-val">${f.evidence}</div>
  <div class="field-label">Impact</div><div class="field-val">${f.impact}</div>
  <div class="field-label">Remediation</div><div class="field-val">${f.remediation}</div>
  <div class="refs">${(f.references||[]).map(r=>`<span class="ref-tag">${r}</span>`).join('')}</div>
</div>`).join('')}` : '<p style="color:#6B7280;font-size:12px">No findings for this scan.</p>'}

<div class="footer">
  <span>OpenGovAI Security Platform · ${scan.id}</span>
  <span>Confidential — For internal use only</span>
</div>
</body>
</html>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  const tabs = [
    { id: 'summary',  label: 'Summary' },
    { id: 'findings', label: `Findings (${findings.length})` },
    { id: 'probes',   label: 'Probe Results' },
    { id: 'raw',      label: 'Raw Data' },
  ];

  const fc = scan.findings_count || {};
  const sortedFindings = [...findings].sort((a,b) =>
    ['critical','high','medium','low','info'].indexOf(a.severity) -
    ['critical','high','medium','low','info'].indexOf(b.severity)
  );

  // Simulated probe results (in production these come from scan engine output)
  const probeResults = [
    { engine:'garak',   probe:'PromptInjection.Direct',    result:'PASS', count:5 },
    { engine:'garak',   probe:'PromptInjection.Indirect',  result:'FAIL', count:3 },
    { engine:'garak',   probe:'DAN.Jailbreak',             result:'PASS', count:8 },
    { engine:'garak',   probe:'Encoding.Base64',           result:'PASS', count:4 },
    { engine:'garak',   probe:'DataExtraction.PII',        result:'FAIL', count:2 },
    { engine:'promptfoo',probe:'RAG.IndirectInjection',    result:'FAIL', count:6 },
    { engine:'promptfoo',probe:'Agent.ToolMisuse',         result:'PASS', count:3 },
    { engine:'promptfoo',probe:'PII.Leakage',              result:'FAIL', count:4 },
    { engine:'promptfoo',probe:'Jailbreak.ManyShot',       result:'PASS', count:10 },
    { engine:'opengovai_native',probe:'ASI-02.ExcessiveAgency',result:'WARN', count:1 },
    { engine:'opengovai_native',probe:'ASI-03.MemoryPoison',   result:'PASS', count:2 },
    { engine:'opengovai_native',probe:'Bias.DemographicParity', result:'WARN', count:1 },
    { engine:'opengovai_native',probe:'ModelCard.Completeness', result:'FAIL', count:1 },
  ].filter(p => (scan.engines||[]).some(e => e === p.engine || p.engine.includes(e)));

  return (
    <div className="scan-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="scan-detail-panel">
        {/* Header */}
        <div className="scan-detail-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div className={`risk-ring ${riskClass(scan.risk_score)}`}>
                {scan.risk_score?.toFixed(1) ?? '?'}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                  {scan.id}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {scan.target || scan.asset_id}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge status={scan.status} progress={scan.progress} />
              <span style={{ color: 'var(--border)', fontSize: 12 }}>·</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(scan.created_at).toLocaleString()}</span>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', flexShrink: 0 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: 'none', border: 'none',
                color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
                transition: 'all 0.15s', marginBottom: -1,
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div className="scan-detail-body" ref={printRef}>

          {/* SUMMARY TAB */}
          {tab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { label: 'Risk Score', val: scan.risk_score?.toFixed(1) ?? '—', color: `var(--${riskClass(scan.risk_score)})` },
                  { label: 'Total Probes', val: scan.total_probes ?? '—', color: 'var(--accent)' },
                  { label: 'Duration', val: dur(scan), color: 'var(--text-secondary)' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 22, color, marginBottom: 4 }}>{val}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Severity breakdown */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Findings by Severity</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {['critical','high','medium','low'].map(s => {
                    const n = (scan.findings_count||{})[s] || 0;
                    const colors = { critical:'var(--critical)', high:'var(--high)', medium:'var(--medium)', low:'var(--low)' };
                    return (
                      <div key={s} style={{ padding: '12px', textAlign: 'center', background: `${colors[s]}10`, border: `1px solid ${colors[s]}30`, borderRadius: 6 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 24, color: colors[s] }}>{n}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{s}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Engines */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Scan Engines Used</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(scan.engines||[]).map(e => (
                    <span key={e} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)',
                      background: `${ENGINE_COLORS[e]||'#888'}18`, border: `1px solid ${ENGINE_COLORS[e]||'#888'}40`,
                      color: ENGINE_COLORS[e]||'var(--text-secondary)' }}>
                      {ENGINE_LABELS[e] || e}
                    </span>
                  ))}
                </div>
              </div>

              {/* Compliance */}
              {(scan.compliance_frameworks||[]).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Compliance Frameworks Mapped</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(scan.compliance_frameworks||[]).map(f => (
                      <span key={f} className="badge badge-info">{f.replace(/_/g,' ').toUpperCase()}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress (if still running) */}
              {scan.status === 'running' && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    Scan in Progress — {scan.progress || 0}%
                  </div>
                  <div className="progress-bar" style={{ height: 6 }}>
                    <div className="progress-fill" style={{ width: `${scan.progress || 0}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FINDINGS TAB */}
          {tab === 'findings' && (
            <div>
              {sortedFindings.length === 0 ? (
                <div className="empty-state"><p>No findings for this scan</p></div>
              ) : sortedFindings.map(f => (
                <div key={f.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span className={`badge badge-${f.severity}`}>{f.severity}</span>
                        <code style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.id}</code>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: 3, border: '1px solid var(--border)' }}>{f.category}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{f.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 6 }}>{f.description}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: `var(--${riskClass(f.risk_score)})`, marginLeft: 12, flexShrink: 0 }}>
                      {f.risk_score?.toFixed(1)}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>Remediation</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--border)' }}>
                    {f.remediation}
                  </div>
                  {(f.references||[]).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {f.references.map(r => <span key={r} style={{ fontSize: 10, padding: '1px 6px', background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)', borderRadius: 3, color: 'var(--accent)' }}>{r}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* PROBES TAB */}
          {tab === 'probes' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Individual probe execution results from each scan engine. PASS = no vulnerability found, FAIL = vulnerability confirmed, WARN = partial or inconclusive.
              </div>
              {probeResults.length === 0 ? (
                <div className="empty-state"><p>Probe-level results not available for this scan</p></div>
              ) : probeResults.map((p, i) => {
                const colors = { PASS: 'var(--low)', FAIL: 'var(--critical)', WARN: 'var(--medium)' };
                const col = colors[p.result] || 'var(--text-muted)';
                return (
                  <div key={i} className="probe-row">
                    <div className="probe-dot" style={{ background: col }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{p.probe}</span>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3,
                          background: `${ENGINE_COLORS[p.engine]||'#888'}18`,
                          border: `1px solid ${ENGINE_COLORS[p.engine]||'#888'}40`,
                          color: ENGINE_COLORS[p.engine]||'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {ENGINE_LABELS[p.engine] || p.engine}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {p.count} {p.count === 1 ? 'attempt' : 'attempts'}
                      </div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: col }}>{p.result}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* RAW TAB */}
          {tab === 'raw' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Complete scan record as returned by the API.
              </div>
              <pre style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: 16, fontSize: 11, color: '#A8D8FF', overflow: 'auto', fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
                {JSON.stringify({ ...scan, _findings: findings }, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="scan-detail-footer">
          <button className="btn btn-primary" onClick={handlePrint}>
            ⬇ Print PDF Report
          </button>
          <button className="btn btn-outline" onClick={() => {
            const blob = new Blob([JSON.stringify({ ...scan, findings }, null, 2)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `${scan.id}.json`; a.click();
          }}>
            ⬇ Export JSON
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-danger btn-sm" onClick={() => { onDelete(scan.id); onClose(); }}>
            🗑 Delete Scan
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN SCANS PAGE ────────────────────────────────────────────────────────────
export default function Scans() {
  const [scans,    setScans]    = useState([]);
  const [findings, setFindings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showNew,  setShowNew]  = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Filters & sorting
  const [statusFilter, setStatusFilter] = useState('all');
  const [engineFilter, setEngineFilter] = useState('all');
  const [sevFilter,    setSevFilter]    = useState('all'); // all | critical | high | medium | low
  const [sort, setSort] = useState({ col: 'created_at', dir: 'desc' });
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // cards | table

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getScans().then(d => d.scans || []),
      getFindings().then(d => d.findings || []),
    ]).then(([s, f]) => {
      setScans(s);
      setFindings(f);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  // Delete
  const handleDelete = (id) => {
    setScans(prev => prev.filter(s => s.id !== id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };
  const handleDeleteSelected = () => {
    setScans(prev => prev.filter(s => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
  };

  // Sort
  const handleSort = (col) => {
    setSort(prev => ({ col, dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  // Select all
  const allIds = scans.map(s => s.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(allIds));
  const toggleId = id => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Filter & sort pipeline
  const filtered = scans
    .filter(s => statusFilter === 'all' || s.status === statusFilter)
    .filter(s => engineFilter === 'all' || (s.engines||[]).includes(engineFilter))
    .filter(s => {
      if (sevFilter === 'all') return true;
      const fc = s.findings_count || {};
      if (sevFilter === 'critical') return (fc.critical || 0) > 0;
      if (sevFilter === 'high')     return (fc.high || 0) > 0;
      return true;
    })
    .filter(s => !search || s.id.toLowerCase().includes(search.toLowerCase()) || (s.target||'').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av = a[sort.col], bv = b[sort.col];
      if (sort.col === 'risk_score') { av = av ?? -1; bv = bv ?? -1; }
      if (sort.col === 'created_at') { av = new Date(av||0); bv = new Date(bv||0); }
      if (sort.col === 'findings') { av = (a.findings_count?.critical||0)*1000 + (a.findings_count?.high||0); bv = (b.findings_count?.critical||0)*1000 + (b.findings_count?.high||0); }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });

  const running = filtered.filter(s => s.status === 'running' || s.status === 'queued');
  const done    = filtered.filter(s => s.status !== 'running' && s.status !== 'queued');

  const selectedScan = selected ? scans.find(s => s.id === selected) : null;
  const scanFindings = selectedScan ? findings.filter(f => f.scan_id === selectedScan.id) : [];

  const stats = {
    total: scans.length,
    completed: scans.filter(s => s.status === 'completed').length,
    running: scans.filter(s => s.status === 'running').length,
    critical: scans.reduce((n, s) => n + ((s.findings_count||{}).critical||0), 0),
  };

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Security Scans</div>
          <div className="page-sub">{stats.total} scans · {stats.completed} completed · {stats.running > 0 ? `${stats.running} running` : 'none running'}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn btn-outline btn-sm`}
            onClick={() => setViewMode(v => v === 'cards' ? 'table' : 'cards')}
          >
            {viewMode === 'cards' ? '☰ Table' : '⊞ Cards'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            + New Scan
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Scans',      val: stats.total,     accent: 'var(--accent)',   tile: 'var(--accent)' },
          { label: 'Completed',        val: stats.completed, accent: 'var(--low)',      tile: 'var(--teal)' },
          { label: 'Active',           val: stats.running,   accent: 'var(--accent)',   tile: 'var(--accent)' },
          { label: 'Critical Findings',val: stats.critical,  accent: 'var(--critical)', tile: 'var(--critical)' },
        ].map(({ label, val, accent, tile }) => (
          <div key={label} className="stat-tile" style={{ '--tile-accent': tile }}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color: accent }}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="toolbar">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search scans…"
          style={{ width: 200, padding: '6px 10px', fontSize: 12 }}
        />

        <div className="toolbar-sep" />
        <span className="toolbar-label">Status</span>
        {['all','completed','running','queued','failed'].map(s => (
          <button key={s} className={`filter-chip ${statusFilter===s?'active':''}`}
            onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}

        <div className="toolbar-sep" />
        <span className="toolbar-label">Has</span>
        <button className={`filter-chip danger ${sevFilter==='critical'?'active':''}`} onClick={() => setSevFilter(v => v==='critical'?'all':'critical')}>Critical</button>
        <button className={`filter-chip ${sevFilter==='high'?'active':''}`} onClick={() => setSevFilter(v => v==='high'?'all':'high')} style={{ '--active-color': 'var(--high)' }}>High</button>

        {selectedIds.size > 0 && (
          <>
            <div className="toolbar-sep" />
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{selectedIds.size} selected</span>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>
              🗑 Delete Selected
            </button>
          </>
        )}
      </div>

      {/* ── Running scans ── */}
      {running.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            ◎ Active Scans
          </div>
          {running.map(scan => (
            <div key={scan.id} className="scan-card running" style={{ marginBottom: 8 }} onClick={() => setSelected(scan.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span className="pulse-ring" />
                    <code style={{ fontSize: 11, color: 'var(--accent)' }}>{scan.id}</code>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{scan.target}</span>
                  </div>
                  <div className="progress-bar" style={{ height: 5 }}>
                    <div className="progress-fill" style={{ width: `${scan.progress || 0}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                    {scan.progress || 0}% · {(scan.engines||[]).join(', ')}
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', minWidth: 40, textAlign: 'right' }}>
                  {scan.progress || 0}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Completed scans ── */}
      {loading && done.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
      ) : done.length === 0 ? (
        <div className="empty-state">
          <p>No scans match the current filters</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* CARD VIEW */
        <div className="scan-grid">
          {done.map(scan => {
            const fc = scan.findings_count || {};
            const isSelected = selectedIds.has(scan.id);
            return (
              <div key={scan.id} className={`scan-card ${scan.status}`}
                style={{ display: 'flex', alignItems: 'center', gap: 16,
                  outline: isSelected ? '2px solid var(--accent)' : 'none',
                  outlineOffset: -1 }}>
                {/* Checkbox */}
                <input
                  type="checkbox" className="row-check"
                  checked={isSelected}
                  onChange={e => { e.stopPropagation(); toggleId(scan.id); }}
                  onClick={e => e.stopPropagation()}
                />
                {/* Risk ring */}
                <div className={`risk-ring ${riskClass(scan.risk_score)}`}
                  style={{ cursor: 'pointer' }} onClick={() => setSelected(scan.id)}>
                  {scan.risk_score?.toFixed(1) ?? '—'}
                </div>
                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setSelected(scan.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <code style={{ fontSize: 10, color: 'var(--text-muted)' }}>{scan.id}</code>
                    <StatusBadge status={scan.status} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                    {scan.target || scan.asset_id}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <SeverityBar counts={fc} />
                    <span style={{ color: 'var(--border)', fontSize: 10 }}>·</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(scan.engines||[]).map(e => (
                        <span key={e} className="engine-pill" style={{ background: `${ENGINE_COLORS[e]||'#888'}18`, borderColor: `${ENGINE_COLORS[e]||'#888'}40`, color: ENGINE_COLORS[e]||'var(--text-muted)' }}>
                          {ENGINE_LABELS[e]||e}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Right meta */}
                <div style={{ textAlign: 'right', flexShrink: 0, cursor: 'pointer' }} onClick={() => setSelected(scan.id)}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {new Date(scan.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dur(scan)}</div>
                </div>
                {/* Actions */}
                <div className="row-actions" style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setSelected(scan.id); }}>View</button>
                  <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(scan.id); }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" className="row-check" checked={allSelected} onChange={toggleAll} />
                </th>
                <SortTh col="id"         label="Scan ID"    sort={sort} onSort={handleSort} />
                <SortTh col="target"     label="Target"     sort={sort} onSort={handleSort} />
                <th>Engines</th>
                <th>Status</th>
                <SortTh col="findings"   label="Findings"   sort={sort} onSort={handleSort} />
                <SortTh col="risk_score" label="Risk"       sort={sort} onSort={handleSort} />
                <SortTh col="created_at" label="Date"       sort={sort} onSort={handleSort} />
                <th>Duration</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {done.map(scan => (
                <tr key={scan.id} className="finding-row" onClick={() => setSelected(scan.id)}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="row-check"
                      checked={selectedIds.has(scan.id)}
                      onChange={() => toggleId(scan.id)} />
                  </td>
                  <td><code style={{ fontSize: 10 }}>{scan.id}</code></td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.target || scan.asset_id}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {(scan.engines||[]).slice(0,3).map(e => (
                        <span key={e} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)',
                          background: `${ENGINE_COLORS[e]||'#888'}18`, color: ENGINE_COLORS[e]||'var(--text-muted)', border: `1px solid ${ENGINE_COLORS[e]||'#888'}30` }}>
                          {ENGINE_LABELS[e]||e}
                        </span>
                      ))}
                      {(scan.engines||[]).length > 3 && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{scan.engines.length-3}</span>}
                    </div>
                  </td>
                  <td><StatusBadge status={scan.status} progress={scan.progress} /></td>
                  <td><SeverityBar counts={scan.findings_count} /></td>
                  <td>
                    {scan.risk_score != null && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: `var(--${riskClass(scan.risk_score)})` }}>
                        {scan.risk_score.toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(scan.created_at).toLocaleDateString()}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{dur(scan)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setSelected(scan.id)}>↗</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(scan.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      {showNew && (
        <NewScanModal
          onClose={() => setShowNew(false)}
          onStart={async data => { await startScan(data); load(); }}
        />
      )}

      {selectedScan && (
        <ScanDetailPanel
          scan={selectedScan}
          findings={scanFindings}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
