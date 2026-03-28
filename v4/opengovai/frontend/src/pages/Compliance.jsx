import React, { useEffect, useState, useCallback } from 'react';
import {
  getCompliance, generateEvidence, listFrameworks, registerFramework,
  getFrameworkControls, checkFrameworkUpdates, applyFrameworkUpdates,
} from '../api';

// No hardcoded BUILTIN_FRAMEWORKS — all framework data fetched from API
// GET /api/v1/frameworks returns live counts from FRAMEWORK_CONTROLS

const SEV_COLORS = { Critical:'var(--critical)', High:'var(--high)', Medium:'var(--medium)', Low:'var(--low)', Info:'var(--info)' };
const SEV_BG     = { Critical:'var(--critical-bg)', High:'var(--high-bg)', Medium:'var(--medium-bg)', Low:'var(--low-bg)' };

// ── Controls panel ────────────────────────────────────────────────────────────
function ControlsPanel({ fw, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    setLoading(true);
    getFrameworkControls(fw.id)
      .then(d => setData(d))
      .catch(() => setData({ controls: [], total: 0, passing: 0, failing: 0, error: true }))
      .finally(() => setLoading(false));
  }, [fw.id]);

  const list    = data?.controls || [];
  const passing = list.filter(c => c.status === 'pass').length;
  const failing = list.filter(c => c.status === 'fail').length;

  const filtered = list
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (c.name||'').toLowerCase().includes(q) ||
             (c.id||'').toLowerCase().includes(q) ||
             (c.article||'').toLowerCase().includes(q);
    });

  return (
    <div className="scan-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="scan-detail-panel" style={{ width:720 }}>
        <div className="scan-detail-header">
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
              <div style={{ width:12, height:12, borderRadius:'50%', background:fw.color, boxShadow:`0 0 6px ${fw.color}` }}/>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{fw.label}</div>
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
              {data?.version || fw.desc}
              {data?.source_url && (
                <> · <a href={data.source_url} target="_blank" rel="noreferrer"
                  style={{ color:'var(--accent-light)', textDecoration:'none' }}>
                  {fw.source} ↗
                </a></>
              )}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Stats strip — counts from API, not hardcoded */}
        {!loading && data && (
          <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            {[
              { label:'Total Controls', val: data.total,   color:'var(--text-secondary)' },
              { label:'Passing',        val: passing,       color:'var(--low)' },
              { label:'Failing',        val: failing,       color:'var(--critical)' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ flex:1, textAlign:'center', padding:'12px 0', borderRight:'1px solid var(--border)' }}>
                <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:20, color }}>{val ?? '—'}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.4px', marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div style={{ padding:'10px 22px', display:'flex', gap:8, alignItems:'center', borderBottom:'1px solid var(--border)', flexShrink:0, flexWrap:'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search controls…" style={{ width:180, padding:'5px 10px', fontSize:12 }}/>
          <div style={{ display:'flex', gap:4 }}>
            {['all','pass','fail'].map(f => (
              <button key={f} className={`filter-chip ${filter===f?'active':''}`} onClick={() => setFilter(f)}
                style={f==='fail'&&filter===f?{background:'var(--critical-bg)',borderColor:'var(--critical)',color:'var(--critical)'}:{}}>
                {f==='all' ? `All (${data?.total||0})` : f==='pass' ? `Passing (${passing})` : `Failing (${failing})`}
              </button>
            ))}
          </div>
        </div>

        {/* Controls list */}
        <div className="scan-detail-body" style={{ padding:0 }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:48 }}><div className="spinner"/></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>No controls match the filter</p></div>
          ) : filtered.map((ctrl, i) => {
            const sev  = ctrl.severity || 'Medium';
            const pass = ctrl.status === 'pass';
            return (
              <div key={ctrl.id || i} style={{
                display:'flex', alignItems:'flex-start', gap:14,
                padding:'11px 22px', borderBottom:'1px solid var(--border)',
                background: i%2===1 ? 'rgba(0,0,0,0.10)' : 'transparent',
              }}>
                <div style={{
                  width:22, height:22, borderRadius:'50%', flexShrink:0, marginTop:3,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:700,
                  background: pass ? 'rgba(22,198,12,0.12)' : 'rgba(231,72,86,0.12)',
                  border:     `1px solid ${pass ? 'rgba(22,198,12,0.3)' : 'rgba(231,72,86,0.3)'}`,
                  color:      pass ? 'var(--low)' : 'var(--critical)',
                }}>{pass ? '✓' : '✗'}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                    <code style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text-muted)', flexShrink:0 }}>{ctrl.id}</code>
                    <span style={{
                      fontSize:9, padding:'1px 6px', borderRadius:3, fontWeight:700,
                      background: SEV_BG[sev]   || 'rgba(96,205,255,0.10)',
                      color:      SEV_COLORS[sev] || 'var(--info)',
                      border:    `1px solid ${SEV_COLORS[sev]||'var(--info)'}30`,
                      textTransform:'uppercase', letterSpacing:'0.3px',
                    }}>{sev}</span>
                  </div>
                  <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', marginBottom:2 }}>{ctrl.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{ctrl.article}</div>
                </div>
                {ctrl.open_findings > 0 && (
                  <div style={{ flexShrink:0, padding:'2px 8px', borderRadius:10,
                    background:'var(--critical-bg)', color:'var(--critical)',
                    border:'1px solid rgba(231,72,86,0.3)', fontSize:10, fontWeight:700, fontFamily:'var(--font-mono)' }}>
                    {ctrl.open_findings} open
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="scan-detail-footer">
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{data?.version && `Version: ${data.version}`}</div>
          <div style={{ flex:1 }}/>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Updates panel ─────────────────────────────────────────────────────────────
function UpdatesPanel({ fw, onClose, onApply }) {
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    checkFrameworkUpdates(fw.id)
      .then(d  => setResult(d))
      .catch(() => setResult({ has_updates:false, error:true,
        message:`No upstream definition for "${fw.label}".`,
        summary:{added:0,removed:0,modified:0},
        current_local_count: fw.controls, current_upstream_count: fw.controls,
        added:[], removed:[], modified:[] }))
      .finally(() => setLoading(false));
  }, [fw.id]);

  const handleApply = async () => {
    setApplying(true);
    try {
      await applyFrameworkUpdates(fw.id);
      onApply();   // triggers refetch of frameworks + compliance data
      onClose();
    } catch { alert('Failed to apply updates'); setApplying(false); }
  };

  const ChangeSection = ({ icon, label, items, accent }) =>
    items?.length > 0 ? (
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <span style={{ fontSize:16 }}>{icon}</span>
          <div style={{ fontSize:12, fontWeight:700, color:accent, textTransform:'uppercase', letterSpacing:'0.4px' }}>
            {label} ({items.length})
          </div>
        </div>
        {items.map(item => (
          <div key={item.id} style={{ padding:'10px 14px', borderRadius:6, marginBottom:6,
            background:`${accent}0D`, border:`1px solid ${accent}30` }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <code style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{item.id}</code>
              <span style={{ fontSize:12, fontWeight:500, color:'var(--text-primary)' }}>
                {item.upstream?.name || item.name}
              </span>
            </div>
            {item.article && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{item.article}</div>}
            {item.changes && Object.entries(item.changes).map(([field, change]) => (
              <div key={field} style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>
                <span style={{ textTransform:'capitalize' }}>{field}</span>: &nbsp;
                <span style={{ color:'var(--critical)', textDecoration:'line-through' }}>{change.from}</span>
                <span style={{ color:'var(--text-muted)' }}> → </span>
                <span style={{ color:'var(--low)' }}>{change.to}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div className="scan-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="scan-detail-panel" style={{ width:660 }}>
        <div className="scan-detail-header">
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:fw.color }}/>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>
                Check for Updates — {fw.label}
              </div>
            </div>
            {result && (
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                Source: {fw.source_url
                  ? <a href={fw.source_url} target="_blank" rel="noreferrer"
                      style={{ color:'var(--accent-light)', textDecoration:'none' }}>{fw.source} ↗</a>
                  : fw.source}
                {result.last_checked && ` · Last checked: ${result.last_checked}`}
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="scan-detail-body">
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:48, gap:14 }}>
              <div className="spinner" style={{ width:28, height:28 }}/>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Comparing controls against upstream…</div>
            </div>
          ) : result?.error && !result?.has_updates ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:48, gap:12, textAlign:'center' }}>
              <span style={{ fontSize:36 }}>ℹ</span>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)' }}>Locally Maintained</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', maxWidth:380, lineHeight:1.7 }}>{result.message}</div>
            </div>
          ) : !result?.has_updates ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:48, gap:12, textAlign:'center' }}>
              <span style={{ fontSize:40 }}>✓</span>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--low)' }}>Controls are up to date</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', maxWidth:380, lineHeight:1.7 }}>
                Local ({result.current_local_count}) matches upstream ({result.current_upstream_count}).
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>Version: {result.version}</div>
            </div>
          ) : (
            <div>
              <div style={{ padding:'12px 16px', borderRadius:8, marginBottom:20,
                background:'rgba(252,209,22,0.08)', border:'1px solid rgba(252,209,22,0.25)',
                display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:20 }}>⚠</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--medium)' }}>Updates available</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                    {result.summary.added > 0    && `${result.summary.added} new · `}
                    {result.summary.removed > 0  && `${result.summary.removed} removed · `}
                    {result.summary.modified > 0 && `${result.summary.modified} modified`}
                    {' '} · Upstream: {result.version}
                  </div>
                </div>
                <div style={{ marginLeft:'auto', textAlign:'right', fontSize:11, color:'var(--text-muted)' }}>
                  <div>Local: {result.current_local_count}</div>
                  <div>Upstream: {result.current_upstream_count}</div>
                </div>
              </div>
              <ChangeSection icon="✚" label="New Controls" items={result.added}    accent="#16C60C" />
              <ChangeSection icon="✕" label="Removed"      items={result.removed}  accent="#E74856" />
              <ChangeSection icon="✎" label="Modified"     items={result.modified} accent="#FFB900" />
            </div>
          )}
        </div>

        <div className="scan-detail-footer">
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', display:'inline-block',
              background: loading ? 'var(--text-muted)' : result?.has_updates ? 'var(--medium)' : 'var(--low)' }}/>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>
              {loading ? 'Checking…' : result?.has_updates ? 'Updates available' : 'Up to date'}
            </span>
          </div>
          <div style={{ flex:1 }}/>
          {result?.has_updates && !loading && (
            <button className="btn btn-primary" onClick={handleApply} disabled={applying}>
              {applying ? '⟳ Applying…' : `⟳ Apply ${(result.summary.added + result.summary.modified)} Update${(result.summary.added + result.summary.modified)!==1?'s':''}`}
            </button>
          )}
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Framework modal ───────────────────────────────────────────────────────
function AddFrameworkModal({ onClose, onSave }) {
  const [form,   setForm]   = useState({ label:'', desc:'', color:'#0078D4', source:'', controls:[{id:'',name:'',article:'',severity:'Medium'}] });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const addCtrl    = () => setForm(f=>({...f, controls:[...f.controls,{id:'',name:'',article:'',severity:'Medium'}]}));
  const updCtrl    = (i,k,v) => setForm(f=>{const c=[...f.controls];c[i]={...c[i],[k]:v};return{...f,controls:c};});
  const removeCtrl = i => setForm(f=>({...f, controls:f.controls.filter((_,j)=>j!==i)}));

  const save = async () => {
    if (!form.label.trim()) return alert('Framework name required');
    setSaving(true);
    try {
      await onSave({ label:form.label, desc:form.desc, color:form.color, source:form.source,
                     controls:form.controls.filter(c=>c.id&&c.name) });
      onClose();
    } catch { alert('Error saving framework'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width:640 }}>
        <div className="modal-title">+ Add Compliance Framework
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div className="form-row">
            <div className="form-group"><label>Framework Name *</label>
              <input value={form.label} onChange={e=>set('label',e.target.value)} placeholder="e.g. SOC 2 Type II"/></div>
            <div className="form-group"><label>Accent Colour</label>
              <div style={{ display:'flex', gap:8 }}>
                <input type="color" value={form.color} onChange={e=>set('color',e.target.value)} style={{ width:44,padding:2,height:34,cursor:'pointer' }}/>
                <input value={form.color} onChange={e=>set('color',e.target.value)} style={{ flex:1,fontFamily:'var(--font-mono)',fontSize:12 }}/>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Description</label>
              <input value={form.desc} onChange={e=>set('desc',e.target.value)} placeholder="Brief description"/></div>
            <div className="form-group"><label>Source URL</label>
              <input value={form.source} onChange={e=>set('source',e.target.value)} placeholder="https://..."/></div>
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <label>Controls</label>
              <button className="btn btn-outline btn-xs" onClick={addCtrl}>+ Add Control</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:240, overflowY:'auto' }}>
              {form.controls.map((ctrl,i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'110px 1fr 130px 90px 28px', gap:6, alignItems:'center' }}>
                  <input value={ctrl.id} onChange={e=>updCtrl(i,'id',e.target.value)} placeholder="ID"
                    style={{ fontFamily:'var(--font-mono)',fontSize:11 }}/>
                  <input value={ctrl.name} onChange={e=>updCtrl(i,'name',e.target.value)} placeholder="Control name"/>
                  <input value={ctrl.article} onChange={e=>updCtrl(i,'article',e.target.value)} placeholder="Section"/>
                  <select value={ctrl.severity} onChange={e=>updCtrl(i,'severity',e.target.value)}>
                    {['Critical','High','Medium','Low'].map(s=><option key={s}>{s}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-xs" onClick={()=>removeCtrl(i)} style={{ color:'var(--critical)' }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving…':'Add Framework'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Compliance card ───────────────────────────────────────────────────────────
// fw comes from API (GET /api/v1/frameworks) — counts are always live
function ComplianceCard({ fw, posture, onEvidence, onViewControls, onCheckUpdates }) {
  const scoreColor = !posture ? 'var(--text-muted)'
    : posture.score >= 90 ? 'var(--low)' : posture.score >= 70 ? 'var(--medium)' : 'var(--critical)';

  const previewControls = (posture?.controls || []).slice(0, 3);

  return (
    <div className="card" style={{ borderTop:`3px solid ${fw.color||'var(--accent)'}`, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div>
          <div style={{ fontWeight:700, color:'var(--text-primary)', fontSize:14, marginBottom:2 }}>{fw.label}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{fw.desc}</div>
        </div>
        {posture && <span className={`badge badge-${posture.status}`}>{posture.status?.toUpperCase()}</span>}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:12 }}>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:32, fontWeight:700, color:scoreColor, flexShrink:0 }}>
          {posture ? `${posture.score?.toFixed(0)}%` : '—'}
        </div>
        <div style={{ flex:1 }}>
          <div className="progress-bar" style={{ height:5, marginBottom:5 }}>
            <div className="progress-fill" style={{ width:`${posture?.score||0}%`, background:scoreColor }}/>
          </div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
            {posture
              ? `${posture.controls_passed}/${posture.controls_total} controls passing`
              : 'Run a scan to assess'}
          </div>
        </div>
      </div>

      {posture && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:12 }}>
          {[
            { label:'Passing',   val:posture.controls_passed, color:'var(--low)' },
            { label:'Failing',   val:posture.controls_failed, color:'var(--critical)' },
            { label:'Open Gaps', val:posture.open_findings,   color:'var(--high)' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ textAlign:'center', padding:8, background:'rgba(0,0,0,0.2)', borderRadius:6, border:'1px solid var(--border)' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:16, color }}>{val}</div>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:1 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {previewControls.length > 0 && (
        <div style={{ flex:1 }}>
          {previewControls.map(ctrl => (
            <div key={ctrl.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text-muted)' }}>{ctrl.id}</span>
                <span style={{ fontSize:12, color:'var(--text-secondary)' }}>{ctrl.name}</span>
              </div>
              <span style={{ fontSize:12, color:ctrl.status==='pass'?'var(--low)':'var(--critical)', fontWeight:700 }}>
                {ctrl.status==='pass'?'✓':'✗'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:12 }}>
        <button className="btn btn-outline" style={{ width:'100%', justifyContent:'space-between' }} onClick={() => onViewControls(fw)}>
          <span>☰ View All Controls</span>
          {/* Live count from API — fw.controls is always from FRAMEWORK_CONTROLS */}
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>{fw.controls} total</span>
        </button>
        <button className="btn btn-outline" style={{ width:'100%', justifyContent:'space-between' }} onClick={() => onCheckUpdates(fw)}>
          <span>⟳ Check for Updates</span>
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>{fw.source}</span>
        </button>
        <button className="btn btn-outline" style={{ width:'100%', justifyContent:'center' }} onClick={() => onEvidence(fw.id)}>
          ⬇ Generate Evidence Pack
        </button>
      </div>
    </div>
  );
}

// ── Main Compliance page ──────────────────────────────────────────────────────
export default function Compliance() {
  const [frameworks, setFrameworks] = useState([]);  // from GET /api/v1/frameworks (live)
  const [postures,   setPostures]   = useState({});  // from GET /api/v1/compliance/{fw}
  const [loading,    setLoading]    = useState(true);
  const [evidence,   setEvidence]   = useState(null);
  const [showAdd,    setShowAdd]    = useState(false);
  const [viewCtrlsFw, setViewCtrlsFw] = useState(null);
  const [updatesFw,   setUpdatesFw]   = useState(null);

  // Fetch frameworks from API — counts always live from FRAMEWORK_CONTROLS
  const loadFrameworks = useCallback(async () => {
    try {
      const d = await listFrameworks();
      return d.frameworks || [];
    } catch { return []; }
  }, []);

  // Fetch posture for all frameworks
  const loadAll = useCallback(async () => {
    setLoading(true);
    const fws = await loadFrameworks();
    setFrameworks(fws);
    const entries = await Promise.all(
      fws.map(fw => getCompliance(fw.id).then(d => [fw.id, d]).catch(() => [fw.id, null]))
    );
    setPostures(Object.fromEntries(entries));
    setLoading(false);
  }, [loadFrameworks]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleEvidence = async fwId => {
    try { setEvidence(await generateEvidence(fwId)); }
    catch { alert('Failed to generate evidence pack'); }
  };

  const handleAddFramework = async form => {
    try { await registerFramework(form); await loadAll(); }
    catch { alert('Failed to register framework'); }
  };

  // Called after Apply Updates — reloads everything so counts refresh
  const handleUpdatesApplied = () => loadAll();

  const overallScore   = frameworks.length
    ? Math.round(frameworks.reduce((s, fw) => s + (postures[fw.id]?.score || 0), 0) / frameworks.length)
    : 0;
  const totalControls  = frameworks.reduce((n, fw) => n + fw.controls, 0);
  const failingControls = Object.values(postures).reduce((n, p) => n + (p?.controls_failed || 0), 0);

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:48 }}><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Compliance Posture</div>
          <div className="page-sub">{frameworks.length} frameworks · {totalControls} total controls · {failingControls} failing</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-outline" onClick={() => frameworks[0] && setUpdatesFw(frameworks[0])}>
            ⟳ Check All Updates
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Framework</button>
        </div>
      </div>

      {/* Summary strip — counts from live API */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Overall Score',    val:`${overallScore}%`, color: overallScore>=90?'var(--low)':overallScore>=70?'var(--medium)':'var(--critical)' },
          { label:'Frameworks',       val:frameworks.length,  color:'var(--accent-light)' },
          { label:'Total Controls',   val:totalControls,      color:'var(--text-secondary)' },
          { label:'Failing Controls', val:failingControls,    color:failingControls>0?'var(--critical)':'var(--low)' },
        ].map(({ label, val, color }) => (
          <div key={label} className="stat-tile">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Framework cards */}
      <div className="grid-2" style={{ marginBottom:20 }}>
        {frameworks.map(fw => (
          <ComplianceCard key={fw.id} fw={fw} posture={postures[fw.id]}
            onEvidence={handleEvidence}
            onViewControls={fw => setViewCtrlsFw(fw)}
            onCheckUpdates={fw => setUpdatesFw(fw)} />
        ))}
        <div className="add-card" onClick={() => setShowAdd(true)}>
          <span style={{ fontSize:24 }}>+</span>
          <div>
            <div style={{ fontWeight:600, fontSize:13 }}>Add Framework</div>
            <div style={{ fontSize:11, marginTop:2 }}>Register a custom compliance framework</div>
          </div>
        </div>
      </div>

      {/* Evidence modal */}
      {evidence && (
        <div className="modal-overlay">
          <div className="modal" style={{ width:660 }}>
            <div className="modal-title">Evidence Pack — {evidence.label}
              <button className="btn btn-ghost btn-sm" onClick={() => setEvidence(null)}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="alert alert-info">Pack ID: <code>{evidence.pack_id}</code> · {new Date(evidence.generated_at).toLocaleString()}</div>
              <div className="grid-3">
                {[
                  { label:'Total Findings', val:evidence.executive_summary?.total_findings },
                  { label:'Open',           val:evidence.executive_summary?.open },
                  { label:'Critical',       val:evidence.executive_summary?.critical },
                ].map(({ label, val }) => (
                  <div key={label} style={{ textAlign:'center', padding:12, background:'rgba(0,0,0,0.2)', borderRadius:6, border:'1px solid var(--border)' }}>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:22, fontWeight:700, color:'var(--text-primary)' }}>{val}</div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div className="alert alert-warning" style={{ fontSize:12 }}>{evidence.attestation?.note}</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEvidence(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => {
                const b=new Blob([JSON.stringify(evidence,null,2)],{type:'application/json'});
                const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`${evidence.pack_id}.json`;a.click();
              }}>⬇ Export JSON</button>
            </div>
          </div>
        </div>
      )}

      {viewCtrlsFw && <ControlsPanel fw={viewCtrlsFw} onClose={() => setViewCtrlsFw(null)} />}
      {updatesFw   && <UpdatesPanel  fw={updatesFw}   onClose={() => setUpdatesFw(null)} onApply={handleUpdatesApplied} />}
      {showAdd     && <AddFrameworkModal onClose={() => setShowAdd(false)} onSave={handleAddFramework} />}
    </div>
  );
}
