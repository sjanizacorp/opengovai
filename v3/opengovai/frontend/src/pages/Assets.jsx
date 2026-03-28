import React, { useEffect, useState, useCallback } from 'react';
import { getAssets, createAsset, deleteAsset, startScan } from '../api';

function SortTh({ col, label, sort, onSort, style={} }) {
  const active = sort.col === col;
  return <th className={`sortable ${active ? sort.dir : ''}`} onClick={() => onSort(col)} style={style}>{label}</th>;
}

const RISK_COLORS = { high:'var(--critical)', limited:'var(--high)', minimal:'var(--low)' };
function riskColor(score) {
  if (!score) return 'var(--text-muted)';
  if (score >= 7) return 'var(--critical)';
  if (score >= 4) return 'var(--medium)';
  return 'var(--low)';
}

function AddAssetModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name:'', model:'', provider:'OpenAI', environment:'staging',
    owner:'', use_case:'', data_classification:'internal', autonomy_level:'human_in_loop',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name || !form.model || !form.owner) return alert('Name, model and owner are required');
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch { alert('Error saving asset'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 560 }}>
        <div className="modal-title">
          Register AI Asset
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="form-row">
            <div className="form-group"><label>Asset Name *</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Customer Support Chatbot"/></div>
            <div className="form-group"><label>Model *</label><input value={form.model} onChange={e=>set('model',e.target.value)} placeholder="gpt-4o, claude-3-5-sonnet…"/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Provider</label>
              <select value={form.provider} onChange={e=>set('provider',e.target.value)}>
                {['OpenAI','Anthropic','Google','Azure','AWS','Mistral','Meta','Internal','Other'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Environment</label>
              <select value={form.environment} onChange={e=>set('environment',e.target.value)}>
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Owner *</label><input value={form.owner} onChange={e=>set('owner',e.target.value)} placeholder="Team or person responsible"/></div>
          <div className="form-group"><label>Use Case</label><textarea rows={2} value={form.use_case} onChange={e=>set('use_case',e.target.value)} placeholder="Describe what this AI system does"/></div>
          <div className="form-row">
            <div className="form-group"><label>Data Classification</label>
              <select value={form.data_classification} onChange={e=>set('data_classification',e.target.value)}>
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="confidential">Confidential</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>
            <div className="form-group"><label>Autonomy Level</label>
              <select value={form.autonomy_level} onChange={e=>set('autonomy_level',e.target.value)}>
                <option value="human_in_loop">Human-in-the-Loop</option>
                <option value="semi_autonomous">Semi-Autonomous</option>
                <option value="fully_autonomous">Fully Autonomous</option>
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving…':'Register Asset'}</button>
        </div>
      </div>
    </div>
  );
}

function ScanModal({ asset, onClose, onScan }) {
  const [engines, setEngines] = useState(['garak','promptfoo','opengovai_native']);
  const [frameworks, setFw]   = useState(['eu_ai_act','owasp_llm']);
  const [scanning, setScan]   = useState(false);
  const toggle = (arr,setArr,val) => setArr(arr.includes(val)?arr.filter(x=>x!==val):[...arr,val]);

  const ENGINE_COLORS = { garak:'#6366F1', promptfoo:'#0ABFBC', pyrit:'#F59E0B', deepteam:'#10B981', fuzzyai:'#EF4444', opengovai_native:'#1B9BE0' };
  const ALL_ENGINES = ['garak','promptfoo','pyrit','deepteam','fuzzyai','opengovai_native'];
  const ALL_FW = ['eu_ai_act','nist_ai_rmf','owasp_llm','iso_42001','gdpr'];

  const Chip = ({val, arr, setArr, color, label}) => {
    const on = arr.includes(val);
    return <button onClick={()=>toggle(arr,setArr,val)} style={{ padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:600,cursor:'pointer',border:`1px solid ${on?(color||'var(--accent)'):'var(--border)'}`,background:on?`${color||'var(--accent)'}18`:'transparent',color:on?(color||'var(--accent)'):'var(--text-muted)',transition:'all 0.15s',fontFamily:'var(--font-mono)' }}>{label||val}</button>;
  };

  const run = async () => {
    setScan(true);
    try { await onScan({ asset_id:asset.id, target:asset.name, engines, compliance_frameworks:frameworks }); onClose(); }
    catch { setScan(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{width:480}}>
        <div className="modal-title">Scan — {asset.name}<button className="btn btn-outline btn-sm" onClick={onClose}>✕</button></div>
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          <div>
            <div style={{fontSize:12,color:'var(--text-secondary)',fontWeight:600,marginBottom:8}}>SCAN ENGINES</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {ALL_ENGINES.map(e=><Chip key={e} val={e} arr={engines} setArr={setEngines} color={ENGINE_COLORS[e]} label={e}/>)}
            </div>
          </div>
          <div>
            <div style={{fontSize:12,color:'var(--text-secondary)',fontWeight:600,marginBottom:8}}>COMPLIANCE FRAMEWORKS</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {ALL_FW.map(f=><Chip key={f} val={f} arr={frameworks} setArr={setFw} label={f.replace(/_/g,' ').toUpperCase()}/>)}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={run} disabled={scanning||engines.length===0}>{scanning?'Queuing…':'⟳ Start Scan'}</button>
        </div>
      </div>
    </div>
  );
}

const ALL_COLS = ['id','name','model','environment','risk_tier','risk_score','status','last_scanned'];
const COL_LABELS = { id:'Asset ID', name:'Name / Owner', model:'Model', environment:'Env', risk_tier:'Risk Tier', risk_score:'Score', status:'Status', last_scanned:'Last Scanned' };

export default function Assets() {
  const [assets, setAssets]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [scanTarget, setScan] = useState(null);
  const [sort, setSort]       = useState({ col:'risk_score', dir:'desc' });
  const [search, setSearch]   = useState('');
  const [envFilter, setEnv]   = useState('all');
  const [tierFilter, setTier] = useState('all');
  const [visibleCols, setVC]  = useState(new Set(ALL_COLS));
  const [showColPicker, setSCP] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const load = () => {
    setLoading(true);
    getAssets().then(d => setAssets(d.assets || [])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async form => { await createAsset(form); load(); };
  const handleScan   = async data => { const { startScan: s } = await import('../api'); await s(data); };
  const handleDelete = async id => {
    if (!window.confirm('Remove this asset from the registry?')) return;
    await deleteAsset(id); load();
  };
  const handleDeleteSelected = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} selected assets?`)) return;
    await Promise.all([...selectedIds].map(id => deleteAsset(id)));
    setSelectedIds(new Set()); load();
  };

  const handleSort = col => setSort(prev => ({ col, dir: prev.col===col && prev.dir==='asc'?'desc':'asc' }));
  const toggleCol  = col => setVC(prev => { const n=new Set(prev); n.has(col)?n.delete(col):n.add(col); return n; });
  const toggleId   = id  => setSelectedIds(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  const filtered = assets
    .filter(a => envFilter==='all' || a.environment===envFilter)
    .filter(a => tierFilter==='all' || a.risk_tier===tierFilter)
    .filter(a => !search ||
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.id?.toLowerCase().includes(search.toLowerCase()) ||
      a.owner?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => {
      let av = a[sort.col], bv = b[sort.col];
      if (sort.col==='risk_score') { av=av??-1; bv=bv??-1; }
      if (sort.col==='last_scanned') { av=new Date(av||0); bv=new Date(bv||0); }
      if (av<bv) return sort.dir==='asc'?-1:1;
      if (av>bv) return sort.dir==='asc'?1:-1;
      return 0;
    });

  const shadowCount = assets.filter(a => a.status==='shadow').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Asset Registry</div>
          <div className="page-sub">{assets.length} AI systems · {shadowCount > 0 ? `${shadowCount} shadow AI detected` : 'no shadow AI'}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <div style={{position:'relative'}}>
            <button className="btn btn-outline btn-sm" onClick={()=>setSCP(v=>!v)}>⊞ Columns</button>
            {showColPicker && (
              <div style={{position:'absolute',right:0,top:'110%',background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:8,padding:12,zIndex:100,width:180,boxShadow:'0 8px 30px rgba(0,0,0,0.4)'}}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',marginBottom:8,textTransform:'uppercase'}}>Visible Columns</div>
                {ALL_COLS.map(col=>(
                  <label key={col} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',cursor:'pointer',fontSize:12,color:'var(--text-secondary)'}}>
                    <input type="checkbox" checked={visibleCols.has(col)} onChange={()=>toggleCol(col)} style={{accentColor:'var(--accent)'}}/>
                    {COL_LABELS[col]}
                  </label>
                ))}
              </div>
            )}
          </div>
          {selectedIds.size > 0 && <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑 Delete {selectedIds.size}</button>}
          <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Register Asset</button>
        </div>
      </div>

      {shadowCount > 0 && (
        <div className="alert alert-critical" style={{marginBottom:16}}>
          ⚑ {shadowCount} ungoverned Shadow AI system{shadowCount>1?'s':''} detected — review and register or remove.
        </div>
      )}

      <div className="toolbar">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assets…" style={{width:200,padding:'6px 10px',fontSize:12}}/>
        <div className="toolbar-sep"/>
        <span className="toolbar-label">Environment</span>
        {['all','production','staging','development'].map(e=>(
          <button key={e} className={`filter-chip ${envFilter===e?'active':''}`} onClick={()=>setEnv(e)}>{e==='all'?'All':e}</button>
        ))}
        <div className="toolbar-sep"/>
        <span className="toolbar-label">Risk Tier</span>
        {['all','high','limited','minimal'].map(t=>(
          <button key={t} className={`filter-chip ${tierFilter===t?'active':''}`} onClick={()=>setTier(t)}>{t==='all'?'All':t}</button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{width:32}}>
                <input type="checkbox" className="row-check"
                  checked={filtered.length>0 && filtered.every(a=>selectedIds.has(a.id))}
                  onChange={()=>{const allSel=filtered.every(a=>selectedIds.has(a.id));setSelectedIds(allSel?new Set():new Set(filtered.map(a=>a.id)));}}/>
              </th>
              {visibleCols.has('id')           && <SortTh col="id"           label="Asset ID"     sort={sort} onSort={handleSort}/>}
              {visibleCols.has('name')         && <SortTh col="name"         label="Name / Owner" sort={sort} onSort={handleSort}/>}
              {visibleCols.has('model')        && <SortTh col="model"        label="Model"        sort={sort} onSort={handleSort}/>}
              {visibleCols.has('environment')  && <SortTh col="environment"  label="Env"          sort={sort} onSort={handleSort}/>}
              {visibleCols.has('risk_tier')    && <SortTh col="risk_tier"    label="Risk Tier"    sort={sort} onSort={handleSort}/>}
              {visibleCols.has('risk_score')   && <SortTh col="risk_score"   label="Score"        sort={sort} onSort={handleSort} style={{width:70}}/>}
              {visibleCols.has('status')       && <SortTh col="status"       label="Status"       sort={sort} onSort={handleSort}/>}
              {visibleCols.has('last_scanned') && <SortTh col="last_scanned" label="Last Scanned" sort={sort} onSort={handleSort}/>}
              <th style={{width:100}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10}><div style={{display:'flex',justifyContent:'center',padding:32}}><div className="spinner"/></div></td></tr>
            ) : filtered.map(asset => (
              <tr key={asset.id} className="finding-row">
                <td onClick={e=>e.stopPropagation()}><input type="checkbox" className="row-check" checked={selectedIds.has(asset.id)} onChange={()=>toggleId(asset.id)}/></td>
                {visibleCols.has('id')           && <td><code style={{fontSize:10}}>{asset.id}</code></td>}
                {visibleCols.has('name')         && <td><div style={{color:'var(--text-primary)',fontWeight:600,fontSize:13}}>{asset.name}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{asset.owner}</div></td>}
                {visibleCols.has('model')        && <td><div style={{fontSize:13}}>{asset.model}</div><div style={{fontSize:11,color:'var(--text-muted)'}}>{asset.provider}</div></td>}
                {visibleCols.has('environment')  && <td><span className={`badge badge-${asset.environment}`}>{asset.environment}</span></td>}
                {visibleCols.has('risk_tier')    && <td><span style={{color:RISK_COLORS[asset.risk_tier]||'var(--text-muted)',fontWeight:700,fontSize:11,textTransform:'uppercase'}}>{asset.risk_tier||'—'}</span></td>}
                {visibleCols.has('risk_score')   && <td><span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:14,color:riskColor(asset.risk_score)}}>{asset.risk_score?.toFixed(1)??'—'}</span></td>}
                {visibleCols.has('status')       && <td><span className={`badge badge-${asset.status}`}>{asset.status}</span></td>}
                {visibleCols.has('last_scanned') && <td style={{fontSize:11,color:'var(--text-muted)'}}>{asset.last_scanned?new Date(asset.last_scanned).toLocaleDateString():'Never'}</td>}
                <td onClick={e=>e.stopPropagation()}>
                  <div style={{display:'flex',gap:5}}>
                    <button className="btn btn-outline btn-sm" onClick={()=>setScan(asset)}>⟳</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(asset.id)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length===0 && (
              <tr><td colSpan={10}><div className="empty-state"><p>No assets match filters</p></div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd   && <AddAssetModal onClose={()=>setShowAdd(false)} onSave={handleCreate}/>}
      {scanTarget && <ScanModal asset={scanTarget} onClose={()=>setScan(null)} onScan={async data=>{const{startScan:s}=await import('../api');await s(data);}}/>}
    </div>
  );
}
