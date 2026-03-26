import React, { useEffect, useState, useCallback } from 'react';
import { getFindings, updateFinding } from '../api';

const SEV_ORDER = { critical:0, high:1, medium:2, low:3, info:4 };
const SEV_COLORS = { critical:'var(--critical)', high:'var(--high)', medium:'var(--medium)', low:'var(--low)', info:'var(--info)' };

function SortTh({ col, label, sort, onSort, style={} }) {
  const active = sort.col === col;
  return (
    <th className={`sortable ${active ? sort.dir : ''}`} onClick={() => onSort(col)} style={style}>
      {label}
    </th>
  );
}

function FindingDetail({ finding, onClose, onUpdate }) {
  const [status, setStatus] = useState(finding.status);
  const [notes, setNotes]   = useState(finding.notes || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onUpdate(finding.id, { status, notes }); onClose(); }
    catch { setSaving(false); }
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    const sev = finding.severity;
    const col = { critical:'#EF4444', high:'#F97316', medium:'#EAB308', low:'#22C55E', info:'#64748B' }[sev] || '#64748B';
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Finding ${finding.id}</title>
<style>
  body{font-family:'Courier New',monospace;padding:32px;color:#1a1a2e;font-size:12px;max-width:800px;margin:0 auto}
  h1{font-size:18px;color:#0D2137;margin-bottom:4px}
  .badge{display:inline-block;padding:3px 10px;border-radius:4px;font-weight:700;font-size:11px;background:${col}18;color:${col};border:1px solid ${col}40}
  .field{margin:16px 0}
  .label{font-size:10px;text-transform:uppercase;font-weight:700;color:#6B7280;letter-spacing:0.6px;margin-bottom:4px}
  .val{font-size:12px;color:#2C3E50;line-height:1.7;background:#F4F8FC;padding:10px 12px;border-radius:4px;border:1px solid #C8DCF0}
  .refs{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
  .ref{font-size:9px;padding:2px 7px;background:#EBF4FF;border:1px solid #C8DCF0;border-radius:3px;color:#1B6CA8}
  .footer{margin-top:32px;padding-top:12px;border-top:1px solid #E0EAF4;font-size:10px;color:#6B7280;display:flex;justify-content:space-between}
</style></head><body>
<h1>Security Finding Report</h1>
<div style="margin-bottom:16px"><span class="badge">${sev?.toUpperCase()} — ${finding.risk_score?.toFixed(1)}/10</span> &nbsp; <code style="font-size:10px;color:#6B7280">${finding.id}</code></div>
<div style="font-size:15px;font-weight:700;color:#0D2137;margin-bottom:16px">${finding.title}</div>
<div class="field"><div class="label">Category</div><div class="val">${finding.category}</div></div>
<div class="field"><div class="label">Description</div><div class="val">${finding.description}</div></div>
<div class="field"><div class="label">Evidence</div><div class="val">${finding.evidence}</div></div>
<div class="field"><div class="label">Impact</div><div class="val">${finding.impact}</div></div>
<div class="field"><div class="label">Remediation</div><div class="val">${finding.remediation}</div></div>
<div class="field"><div class="label">Status</div><div class="val">${finding.status}${finding.notes ? ' — ' + finding.notes : ''}</div></div>
<div class="field"><div class="label">Framework References</div><div class="refs">${(finding.references||[]).map(r=>`<span class="ref">${r}</span>`).join('')}</div></div>
<div class="footer"><span>OpenGovAI · ${finding.scan_id}</span><span>${new Date().toLocaleString()}</span></div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="scan-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="scan-detail-panel">
        <div className="scan-detail-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className={`badge badge-${finding.severity}`}>{finding.severity?.toUpperCase()}</span>
              <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{finding.id}</code>
              <span style={{ fontSize: 11, padding: '2px 7px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)' }}>{finding.category}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{finding.title}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20, color: SEV_COLORS[finding.severity] }}>{finding.risk_score?.toFixed(1)}</div>
            <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="scan-detail-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Description', val: finding.description },
              { label: 'Evidence',    val: finding.evidence },
              { label: 'Impact',      val: finding.impact },
              { label: 'Remediation', val: finding.remediation },
            ].map(({ label, val }) => val ? (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 4, border: '1px solid var(--border)' }}>{val}</div>
              </div>
            ) : null)}

            {(finding.frameworks||[]).length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>Frameworks</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {finding.frameworks.map(f => <span key={f} className="badge badge-info">{f.replace(/_/g,' ').toUpperCase()}</span>)}
                </div>
              </div>
            )}

            {(finding.references||[]).length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>References</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {finding.references.map(r => (
                    <span key={r} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)', borderRadius: 3, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{r}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="open">Open</option>
                  <option value="in_remediation">In Remediation</option>
                  <option value="resolved">Resolved</option>
                  <option value="accepted">Risk Accepted</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Scan: <code style={{ fontSize: 11 }}>{finding.scan_id}</code></span>
              </div>
            </div>
            <div className="form-group">
              <label>Notes / Rationale</label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Remediation notes or risk acceptance rationale…" />
            </div>
          </div>
        </div>

        <div className="scan-detail-footer">
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          <button className="btn btn-outline" onClick={handlePrint}>⬇ Print PDF</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// Column visibility options
const ALL_COLS = ['id','severity','title','category','asset','score','frameworks','status','date'];
const COL_LABELS = { id:'ID', severity:'Severity', title:'Title', category:'Category', asset:'Asset', score:'Risk', frameworks:'Frameworks', status:'Status', date:'Date' };

export default function Findings() {
  const [findings,  setFindings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null);
  const [sort,      setSort]      = useState({ col: 'severity', dir: 'asc' });
  const [search,    setSearch]    = useState('');
  const [visibleCols, setVisibleCols] = useState(new Set(ALL_COLS));
  const [showColPicker, setShowColPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Filters
  const [sevFilter,    setSevFilter]    = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fwFilter,     setFwFilter]     = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (sevFilter)    params.severity  = sevFilter;
    if (statusFilter) params.status    = statusFilter;
    if (fwFilter)     params.framework = fwFilter;
    getFindings(params).then(d => setFindings(d.findings || [])).finally(() => setLoading(false));
  }, [sevFilter, statusFilter, fwFilter]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (id, data) => { await updateFinding(id, data); load(); };

  const handleSort = col => setSort(prev => ({ col, dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc' }));

  const toggleId = id => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleCol = col => setVisibleCols(prev => { const n = new Set(prev); n.has(col) ? n.delete(col) : n.add(col); return n; });

  const filtered = findings
    .filter(f => !search ||
      f.title?.toLowerCase().includes(search.toLowerCase()) ||
      f.id?.toLowerCase().includes(search.toLowerCase()) ||
      f.category?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av, bv;
      if (sort.col === 'severity')   { av = SEV_ORDER[a.severity]??5; bv = SEV_ORDER[b.severity]??5; }
      else if (sort.col === 'score') { av = a.risk_score??0; bv = b.risk_score??0; }
      else if (sort.col === 'date')  { av = new Date(a.created_at||0); bv = new Date(b.created_at||0); }
      else { av = (a[sort.col]||'').toString().toLowerCase(); bv = (b[sort.col]||'').toString().toLowerCase(); }
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1  : -1;
      return 0;
    });

  const counts = { critical:0, high:0, medium:0, low:0, info:0 };
  findings.forEach(f => { counts[f.severity] = (counts[f.severity]||0) + 1; });
  const openCount = findings.filter(f => f.status === 'open').length;

  const selectedFinding = selected ? findings.find(f => f.id === selected) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Findings</div>
          <div className="page-sub">{findings.length} total · {openCount} open</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setShowColPicker(v => !v)}>
              ⊞ Columns
            </button>
            {showColPicker && (
              <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, zIndex: 100, width: 180, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Visible Columns</div>
                {ALL_COLS.map(col => (
                  <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={visibleCols.has(col)} onChange={() => toggleCol(col)} style={{ accentColor: 'var(--accent)' }} />
                    {COL_LABELS[col]}
                  </label>
                ))}
              </div>
            )}
          </div>
          {selectedIds.size > 0 && (
            <button className="btn btn-outline btn-sm" onClick={() => {
              const blob = new Blob([JSON.stringify(findings.filter(f => selectedIds.has(f.id)), null, 2)], { type: 'application/json' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = 'findings-export.json'; a.click();
            }}>⬇ Export {selectedIds.size}</button>
          )}
        </div>
      </div>

      {/* Severity tiles */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {['critical','high','medium','low','info'].map(sev => {
          const n = counts[sev] || 0;
          const active = sevFilter === sev;
          return (
            <div key={sev}
              onClick={() => setSevFilter(v => v === sev ? '' : sev)}
              style={{ flex: 1, padding: '12px 14px', borderRadius: 8,
                background: active ? `${SEV_COLORS[sev]}18` : 'var(--bg-card)',
                border: `1px solid ${active ? SEV_COLORS[sev] : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: SEV_COLORS[sev] }}>{n}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>{sev}</div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search findings…" style={{ width: 200, padding: '6px 10px', fontSize: 12 }} />
        <div className="toolbar-sep" />
        <span className="toolbar-label">Status</span>
        {['','open','in_remediation','resolved','accepted'].map(s => (
          <button key={s} className={`filter-chip ${statusFilter===s?'active':''}`} onClick={() => setStatusFilter(s)}>
            {s === '' ? 'All' : s.replace('_',' ')}
          </button>
        ))}
        <div className="toolbar-sep" />
        <span className="toolbar-label">Framework</span>
        <select value={fwFilter} onChange={e => setFwFilter(e.target.value)} style={{ width: 'auto', padding: '4px 8px', fontSize: 11 }}>
          <option value="">All</option>
          {['eu_ai_act','nist_ai_rmf','owasp_llm','iso_42001','gdpr'].map(f => <option key={f} value={f}>{f.replace(/_/g,' ').toUpperCase()}</option>)}
        </select>
        {selectedIds.size > 0 && (
          <>
            <div className="toolbar-sep" />
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{selectedIds.size} selected</span>
          </>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" className="row-check"
                  checked={filtered.length > 0 && filtered.every(f => selectedIds.has(f.id))}
                  onChange={() => {
                    const allSel = filtered.every(f => selectedIds.has(f.id));
                    setSelectedIds(allSel ? new Set() : new Set(filtered.map(f => f.id)));
                  }} />
              </th>
              {visibleCols.has('id')         && <SortTh col="id"       label="ID"         sort={sort} onSort={handleSort} />}
              {visibleCols.has('severity')   && <SortTh col="severity" label="Severity"   sort={sort} onSort={handleSort} />}
              {visibleCols.has('title')      && <SortTh col="title"    label="Title"      sort={sort} onSort={handleSort} />}
              {visibleCols.has('category')   && <th>Category</th>}
              {visibleCols.has('asset')      && <th>Asset</th>}
              {visibleCols.has('score')      && <SortTh col="score"    label="Risk Score" sort={sort} onSort={handleSort} style={{ width: 80 }} />}
              {visibleCols.has('frameworks') && <th>Frameworks</th>}
              {visibleCols.has('status')     && <SortTh col="status"   label="Status"     sort={sort} onSort={handleSort} />}
              {visibleCols.has('date')       && <SortTh col="date"     label="Date"       sort={sort} onSort={handleSort} />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={ALL_COLS.length + 1}>
                <div style={{ display:'flex',justifyContent:'center',padding:32 }}><div className="spinner"/></div>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={ALL_COLS.length + 1}><div className="empty-state"><p>No findings match the current filters</p></div></td></tr>
            ) : filtered.map(f => (
              <tr key={f.id} className="finding-row" onClick={() => setSelected(f.id)}>
                <td onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className="row-check" checked={selectedIds.has(f.id)} onChange={() => toggleId(f.id)} />
                </td>
                {visibleCols.has('id')         && <td><code style={{ fontSize: 10 }}>{f.id}</code></td>}
                {visibleCols.has('severity')   && <td><span className={`badge badge-${f.severity}`}>{f.severity}</span></td>}
                {visibleCols.has('title')      && <td style={{ color:'var(--text-primary)', maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:500 }}>{f.title}</td>}
                {visibleCols.has('category')   && <td style={{ fontSize:12 }}>{f.category}</td>}
                {visibleCols.has('asset')      && <td><code style={{ fontSize:10 }}>{f.asset_id}</code></td>}
                {visibleCols.has('score')      && (
                  <td>
                    <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:SEV_COLORS[f.severity]||'var(--text-muted)' }}>
                      {f.risk_score?.toFixed(1) ?? '—'}
                    </span>
                  </td>
                )}
                {visibleCols.has('frameworks') && (
                  <td>
                    <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                      {(f.frameworks||[]).slice(0,2).map(fw => (
                        <span key={fw} style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-muted)' }}>
                          {fw.replace(/_/g,' ').toUpperCase()}
                        </span>
                      ))}
                      {(f.frameworks||[]).length > 2 && <span style={{ fontSize:9, color:'var(--text-muted)' }}>+{f.frameworks.length-2}</span>}
                    </div>
                  </td>
                )}
                {visibleCols.has('status')  && <td><span className={`badge badge-${f.status}`}>{f.status?.replace('_',' ')}</span></td>}
                {visibleCols.has('date')    && <td style={{ fontSize:11, color:'var(--text-muted)' }}>{new Date(f.created_at).toLocaleDateString()}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedFinding && (
        <FindingDetail
          finding={selectedFinding}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
