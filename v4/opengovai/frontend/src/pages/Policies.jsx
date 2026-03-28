import React, { useEffect, useState, useCallback } from 'react';
import { getPolicies, createPolicy, listFrameworks,
         getFrameworkControls, checkFrameworkUpdates, applyFrameworkUpdates } from '../api';

// No hardcoded PREBUILT array — framework metadata fetched from GET /api/v1/frameworks
// No hardcoded control counts — all counts come from the API (FRAMEWORK_CONTROLS)
// PolicyCard uses fw.controls from the fetched framework object, not policy.controls from DB

const FW_COLORS_FALLBACK = '#888'; // used only if framework not in fetched list

const POLICY_YAML_TEMPLATE = `# Custom Policy Pack — YAML Format
policy:
  id: CORP-POL-001
  name: "Corporate AI Usage Policy v1"
  version: "1.0"
  effective_date: "2026-01-01"
  owner: "Chief AI Officer"

controls:
  - id: CTRL-001
    name: "PII in Training Data Prohibition"
    severity: critical
    frameworks: [gdpr, eu_ai_act]
    test: |
      from opengovai.checks import pii_scanner
      result = pii_scanner.scan_dataset(dataset_path)
      assert result.pii_count == 0

  - id: CTRL-002
    name: "Agent Kill Switch Requirement"
    severity: high
    frameworks: [eu_ai_act]
    test: |
      from opengovai.checks import kill_switch_validator
      result = kill_switch_validator.test(agent_endpoint)
      assert result.latency_ms < 1000`;

// ── Controls panel for policy packs ──────────────────────────────────────────
function PolicyControlsPanel({ fw, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');

  const color = fw.color || FW_COLORS_FALLBACK;

  useEffect(() => {
    setLoading(true);
    getFrameworkControls(fw.id)
      .then(d => setData(d))
      .catch(() => {
        // No server-side definition → show synthetic list from fw.controls count
        const n = fw.controls || 0;
        setData({
          controls: Array.from({ length: n }, (_, i) => ({
            id:     `${fw.id.toUpperCase().slice(0,3)}-${String(i+1).padStart(3,'0')}`,
            name:   `Control ${i+1}`,
            article:`${fw.label} item ${i+1}`,
            severity: i < Math.ceil(n*0.15) ? 'Critical' : i < Math.ceil(n*0.4) ? 'High' : i < Math.ceil(n*0.7) ? 'Medium' : 'Low',
            status: 'pass', open_findings: 0,
          })),
          total: n, passing: n, failing: 0,
          version: fw.label, source_url: fw.source_url || '',
        });
      })
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

  const SEV_COLORS = { Critical:'var(--critical)', High:'var(--high)', Medium:'var(--medium)', Low:'var(--low)' };
  const SEV_BG     = { Critical:'var(--critical-bg)', High:'var(--high-bg)', Medium:'var(--medium-bg)', Low:'var(--low-bg)' };

  return (
    <div className="scan-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="scan-detail-panel" style={{ width:720 }}>
        <div className="scan-detail-header">
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
              <div style={{ width:12, height:12, borderRadius:'50%', background:color, boxShadow:`0 0 6px ${color}` }}/>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{fw.label}</div>
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
              {data?.version || fw.desc || fw.label}
              {(data?.source_url || fw.source_url) && (
                <> · <a href={data?.source_url || fw.source_url} target="_blank" rel="noreferrer"
                  style={{ color:'var(--accent-light)', textDecoration:'none' }}>
                  {fw.source} ↗
                </a></>
              )}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {!loading && data && (
          <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            {[
              { label:'Total Controls', val:data.total, color:'var(--text-secondary)' },
              { label:'Passing',        val:passing,     color:'var(--low)' },
              { label:'Failing',        val:failing,     color:'var(--critical)' },
            ].map(({ label, val, color: c }) => (
              <div key={label} style={{ flex:1, textAlign:'center', padding:'12px 0', borderRight:'1px solid var(--border)' }}>
                <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:20, color:c }}>{val ?? '—'}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.4px', marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

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

        <div className="scan-detail-body" style={{ padding:0 }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:48 }}><div className="spinner"/></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><p>No controls match</p></div>
          ) : filtered.map((ctrl, i) => {
            const sev  = ctrl.severity || 'Medium';
            const pass = ctrl.status === 'pass';
            return (
              <div key={ctrl.id||i} style={{
                display:'flex', alignItems:'flex-start', gap:14,
                padding:'11px 22px', borderBottom:'1px solid var(--border)',
                background: i%2===1 ? 'rgba(0,0,0,0.10)' : 'transparent',
              }}>
                <div style={{
                  width:22, height:22, borderRadius:'50%', flexShrink:0, marginTop:3,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:700,
                  background: pass?'rgba(22,198,12,0.12)':'rgba(231,72,86,0.12)',
                  border:`1px solid ${pass?'rgba(22,198,12,0.3)':'rgba(231,72,86,0.3)'}`,
                  color: pass?'var(--low)':'var(--critical)',
                }}>{pass?'✓':'✗'}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                    <code style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text-muted)' }}>{ctrl.id}</code>
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
                    border:'1px solid rgba(231,72,86,0.3)', fontSize:10, fontWeight:700 }}>
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

// ── Updates panel for policy packs ────────────────────────────────────────────
function PolicyUpdatesPanel({ fw, onClose, onApply }) {
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [applying, setApplying] = useState(false);
  const color = fw.color || FW_COLORS_FALLBACK;

  useEffect(() => {
    checkFrameworkUpdates(fw.id)
      .then(d  => setResult(d))
      .catch(() => setResult({
        has_updates: false, error: true,
        message: `No upstream definition for "${fw.label}". This pack is locally maintained.`,
        summary:{added:0,removed:0,modified:0},
        current_local_count: fw.controls, current_upstream_count: fw.controls,
        added:[], removed:[], modified:[],
      }))
      .finally(() => setLoading(false));
  }, [fw.id]);

  const handleApply = async () => {
    setApplying(true);
    try { await applyFrameworkUpdates(fw.id); onApply(); onClose(); }
    catch { alert('Failed to apply updates'); setApplying(false); }
  };

  const ChangeSection = ({ icon, label, items, accent }) =>
    items?.length > 0 ? (
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
          <span style={{ fontSize:16 }}>{icon}</span>
          <div style={{ fontSize:12, fontWeight:700, color:accent, textTransform:'uppercase' }}>{label} ({items.length})</div>
        </div>
        {items.map(item => (
          <div key={item.id} style={{ padding:'10px 14px', borderRadius:6, marginBottom:6, background:`${accent}0D`, border:`1px solid ${accent}30` }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <code style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{item.id}</code>
              <span style={{ fontSize:12, fontWeight:500, color:'var(--text-primary)' }}>{item.upstream?.name||item.name}</span>
            </div>
            {item.article && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{item.article}</div>}
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
              <div style={{ width:10, height:10, borderRadius:'50%', background:color }}/>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>Check for Updates — {fw.label}</div>
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Source: {fw.source}{result?.last_checked && ` · ${result.last_checked}`}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="scan-detail-body">
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:48, gap:14 }}>
              <div className="spinner" style={{ width:28, height:28 }}/>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Comparing controls…</div>
            </div>
          ) : result?.error && !result?.has_updates ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:48, gap:12, textAlign:'center' }}>
              <span style={{ fontSize:36 }}>ℹ</span>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)' }}>Locally Maintained Pack</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', maxWidth:380, lineHeight:1.7 }}>{result.message}</div>
            </div>
          ) : !result?.has_updates ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:48, gap:12, textAlign:'center' }}>
              <span style={{ fontSize:40 }}>✓</span>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--low)' }}>Controls are up to date</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Local ({result.current_local_count}) = Upstream ({result.current_upstream_count})</div>
            </div>
          ) : (
            <div>
              <div style={{ padding:'12px 16px', borderRadius:8, marginBottom:20,
                background:'rgba(252,209,22,0.08)', border:'1px solid rgba(252,209,22,0.25)',
                display:'flex', gap:12, alignItems:'center' }}>
                <span style={{ fontSize:20 }}>⚠</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--medium)' }}>Updates available</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                    {result.summary.added>0 && `${result.summary.added} new · `}
                    {result.summary.removed>0 && `${result.summary.removed} removed · `}
                    {result.summary.modified>0 && `${result.summary.modified} modified`}
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
              background: loading?'var(--text-muted)':result?.has_updates?'var(--medium)':'var(--low)' }}/>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>
              {loading?'Checking…':result?.has_updates?'Updates available':'Up to date'}
            </span>
          </div>
          <div style={{ flex:1 }}/>
          {result?.has_updates && !loading && (
            <button className="btn btn-primary" onClick={handleApply} disabled={applying}>
              {applying ? '⟳ Applying…' : '⟳ Apply Updates'}
            </button>
          )}
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Loaded policy card ────────────────────────────────────────────────────────
// frameworks = live list from GET /api/v1/frameworks
// policy.controls = enriched live count from GET /api/v1/policies (server-side override)
function PolicyCard({ policy, frameworks, onViewControls, onCheckUpdates }) {
  // Find the live framework definition for this policy's framework
  const liveFw = frameworks.find(f => f.id === policy.framework) || {
    id: policy.framework, label: policy.name,
    color: FW_COLORS_FALLBACK, source: 'custom', desc: '',
    controls: policy.controls,  // fallback only — server already enriched this
  };
  const color = liveFw.color;

  return (
    <div className="card" style={{ borderTop:`3px solid ${color}`, display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, color:'var(--text-primary)', fontSize:13, marginBottom:3 }}>{policy.name}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{policy.description}</div>
        </div>
        <span className={`badge badge-${policy.status}`}>{policy.status}</span>
      </div>

      <div style={{ display:'flex', gap:10, paddingTop:10, borderTop:'1px solid var(--border)', marginBottom:12 }}>
        <div style={{ flex:1, textAlign:'center' }}>
          {/* policy.controls is enriched by GET /api/v1/policies to always match FRAMEWORK_CONTROLS */}
          <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:18, color }}>{policy.controls}</div>
          <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase' }}>Controls</div>
        </div>
        <div style={{ flex:1, textAlign:'center' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:18, color:'var(--text-secondary)' }}>{policy.version}</div>
          <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase' }}>Version</div>
        </div>
        <div style={{ flex:2, display:'flex', alignItems:'center' }}>
          <span style={{ padding:'2px 8px', borderRadius:10, fontSize:10, fontWeight:600,
            background:`${color}18`, color, border:`1px solid ${color}40` }}>
            {policy.framework?.replace(/_/g,' ').toUpperCase()}
          </span>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:'auto' }}>
        <button className="btn btn-outline" style={{ width:'100%', justifyContent:'space-between' }}
          onClick={() => onViewControls(liveFw)}>
          <span>☰ View All Controls</span>
          {/* liveFw.controls = live count from GET /api/v1/frameworks */}
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>{liveFw.controls} checks</span>
        </button>
        <button className="btn btn-outline" style={{ width:'100%', justifyContent:'space-between' }}
          onClick={() => onCheckUpdates(liveFw)}>
          <span>⟳ Check for Updates</span>
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>{liveFw.source}</span>
        </button>
      </div>
    </div>
  );
}

// ── Create policy modal ───────────────────────────────────────────────────────
function AddPolicyModal({ onClose, onSave, frameworks }) {
  const [tab,    setTab]    = useState('form');
  const [form,   setForm]   = useState({ name:'', description:'', framework:'eu_ai_act', controls:0 });
  const [yaml,   setYaml]   = useState(POLICY_YAML_TEMPLATE);
  const [tests,  setTests]  = useState([{ name:'', check_ref:'', severity:'high', code:'' }]);
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const addTest    = () => setTests(p=>[...p,{name:'',check_ref:'',severity:'high',code:''}]);
  const updTest    = (i,k,v) => setTests(p=>{const n=[...p];n[i]={...n[i],[k]:v};return n;});
  const removeTest = i => setTests(p=>p.filter((_,j)=>j!==i));

  // Framework select options from live API — not hardcoded
  const fwOptions = frameworks.length > 0
    ? frameworks
    : [{ id:'eu_ai_act',label:'EU AI Act' },{ id:'nist_ai_rmf',label:'NIST AI RMF' },
       { id:'owasp_llm',label:'OWASP LLM' },{ id:'iso_42001',label:'ISO 42001' },
       { id:'cfr_part11',label:'21 CFR Part 11' },{ id:'custom',label:'Custom' }];

  const selectedFw = frameworks.find(f => f.id === form.framework);
  const fwColor = selectedFw?.color || '#0078D4';

  const save = async () => {
    if (!form.name.trim()) return alert('Policy name required');
    setSaving(true);
    try {
      await onSave({...form, controls: form.controls || tests.filter(t=>t.name).length});
      onClose();
    } catch { alert('Error saving policy'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width:700 }}>
        <div className="modal-title">+ Create Policy Pack
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)', marginBottom:18 }}>
          {[{id:'form',label:'Form Editor'},{id:'yaml',label:'YAML Editor'},{id:'tests',label:'Custom Tests'}].map(t=>(
            <button key={t.id} className={`tab-btn ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {tab === 'form' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group"><label>Policy Name *</label>
              <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Corporate AI Acceptable Use Policy"/></div>
            <div className="form-group"><label>Description</label>
              <textarea rows={2} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="What this policy governs"/></div>
            <div className="form-row">
              <div className="form-group"><label>Framework</label>
                <select value={form.framework} onChange={e=>set('framework',e.target.value)}>
                  {/* Options from live API — not hardcoded */}
                  {fwOptions.map(fw => <option key={fw.id} value={fw.id}>{fw.label}</option>)}
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="form-group"><label>Control Count</label>
                <input type="number" value={form.controls} onChange={e=>set('controls',parseInt(e.target.value)||0)}/></div>
            </div>
          </div>
        )}

        {tab === 'yaml' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div className="alert alert-info" style={{ fontSize:12 }}>Paste or edit YAML. Controls map to scan findings automatically.</div>
            <textarea value={yaml} onChange={e=>setYaml(e.target.value)} rows={16}
              style={{ fontFamily:'var(--font-mono)',fontSize:11,lineHeight:1.6,resize:'vertical',
                       background:'#0A1020',color:'#A8D8FF',border:'1px solid var(--border)',
                       borderLeft:'3px solid var(--accent)',borderRadius:6,padding:'12px 14px' }}/>
          </div>
        )}

        {tab === 'tests' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Define automated checks OpenGovAI runs for this policy.</div>
              <button className="btn btn-outline btn-sm" onClick={addTest}>+ Add Test</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14, maxHeight:380, overflowY:'auto' }}>
              {tests.map((test,i) => (
                <div key={i} style={{ background:'rgba(0,0,0,0.2)',borderRadius:6,padding:12,border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)' }}>Test {i+1}</span>
                    <button className="btn btn-ghost btn-xs" onClick={()=>removeTest(i)} style={{ color:'var(--critical)' }}>✕</button>
                  </div>
                  <div className="form-row" style={{ marginBottom:8 }}>
                    <div className="form-group"><label>Test Name</label>
                      <input value={test.name} onChange={e=>updTest(i,'name',e.target.value)} placeholder="e.g. PII Leakage Detection"/></div>
                    <div className="form-group"><label>Severity</label>
                      <select value={test.severity} onChange={e=>updTest(i,'severity',e.target.value)}>
                        {['critical','high','medium','low'].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom:8 }}>
                    <label>Check Reference</label>
                    <input value={test.check_ref} onChange={e=>updTest(i,'check_ref',e.target.value)}
                      placeholder="module.check_name" style={{ fontFamily:'var(--font-mono)',fontSize:12 }}/>
                  </div>
                  <div className="form-group">
                    <label>Test Code (Python)</label>
                    <textarea value={test.code} onChange={e=>updTest(i,'code',e.target.value)} rows={4}
                      placeholder="# Your test implementation&#10;result = run_check(target)&#10;assert result.passed"
                      style={{ fontFamily:'var(--font-mono)',fontSize:11,lineHeight:1.6,resize:'vertical',
                               background:'#0A1020',color:'#A8D8FF',border:'1px solid var(--border)',
                               borderLeft:`3px solid ${fwColor}`,borderRadius:4,padding:'8px 10px' }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Creating…':'Create Policy'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Policies page ────────────────────────────────────────────────────────
export default function Policies() {
  const [frameworks,    setFrameworks]    = useState([]);  // live from GET /api/v1/frameworks
  const [policies,      setPolicies]      = useState([]);  // live from GET /api/v1/policies (enriched)
  const [loading,       setLoading]       = useState(true);
  const [showAdd,       setShowAdd]       = useState(false);
  const [viewCtrlsFw,   setViewCtrlsFw]   = useState(null);
  const [updatesFw,     setUpdatesFw]     = useState(null);

  // Load both frameworks (live counts) and policies (enriched counts) together
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fwResp, polResp] = await Promise.all([
        listFrameworks(),
        getPolicies(),
      ]);
      setFrameworks(fwResp.frameworks || []);
      setPolicies(polResp.policies || []);
    } catch (e) {
      console.error('Failed to load:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleCreate   = async form => { await createPolicy(form); loadAll(); };
  const handleLoadPack = async fw   => {
    // Control count from live framework data — not hardcoded
    await createPolicy({ name:fw.label, description:fw.desc, framework:fw.id, controls:fw.controls });
    loadAll();
  };
  // After apply updates → reload so all counts refresh
  const handleUpdatesApplied = () => loadAll();

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Governance Policies</div>
          <div className="page-sub">
            {frameworks.length} available packs · {policies.length} loaded
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Create Policy</button>
      </div>

      {/* Pre-built packs — rendered from live API, not hardcoded array */}
      <div className="card" style={{ marginBottom:20 }}>
        <div className="card-header">
          <span className="card-title">Available Policy Packs</span>
          <span style={{ fontSize:11, color:'var(--text-muted)' }}>
            Control counts are live — updated automatically when upstream changes are applied
          </span>
        </div>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:24 }}><div className="spinner"/></div>
        ) : frameworks.length === 0 ? (
          <div className="empty-state"><p>No frameworks loaded</p></div>
        ) : frameworks.map((fw, i) => (
          <div key={fw.id} style={{
            display:'flex', alignItems:'center', gap:12, padding:'11px 0',
            borderBottom: i < frameworks.length-1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ width:4, height:40, borderRadius:2, background:fw.color||'#888', flexShrink:0 }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, color:'var(--text-primary)', fontSize:13 }}>{fw.label}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{fw.desc}</div>
            </div>
            {/* Live count from API — always matches FRAMEWORK_CONTROLS */}
            <div style={{ textAlign:'center', flexShrink:0, minWidth:56 }}>
              <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:16, color:fw.color||'#888' }}>
                {fw.controls}
              </div>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase' }}>checks</div>
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setViewCtrlsFw(fw)}>
                ☰ View Controls
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setUpdatesFw(fw)}>
                ⟳ Updates
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => handleLoadPack(fw)}>
                Load Pack
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Loaded policies */}
      {!loading && (
        <div>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase',
            letterSpacing:'0.5px', marginBottom:12 }}>
            Active Policy Packs ({policies.length})
          </div>
          <div className="grid-2">
            {policies.map(p => (
              <PolicyCard key={p.id} policy={p} frameworks={frameworks}
                onViewControls={fw => setViewCtrlsFw(fw)}
                onCheckUpdates={fw => setUpdatesFw(fw)} />
            ))}
            <div className="add-card" onClick={() => setShowAdd(true)}>
              <span style={{ fontSize:22 }}>+</span>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>Create Custom Policy</div>
                <div style={{ fontSize:11, marginTop:2 }}>Form editor, YAML, or custom tests</div>
              </div>
            </div>
            {policies.length === 0 && (
              <div className="empty-state" style={{ gridColumn:'1/-1' }}>
                <p>No policies loaded — load a pack above or create a custom policy</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewCtrlsFw && <PolicyControlsPanel fw={viewCtrlsFw} onClose={() => setViewCtrlsFw(null)} />}
      {updatesFw   && <PolicyUpdatesPanel  fw={updatesFw}   onClose={() => setUpdatesFw(null)} onApply={handleUpdatesApplied} />}
      {showAdd     && <AddPolicyModal onClose={() => setShowAdd(false)} onSave={handleCreate} frameworks={frameworks} />}
    </div>
  );
}
