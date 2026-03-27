import React, { useEffect, useState } from 'react';
import { getCompliance, generateEvidence, listFrameworks, registerFramework } from '../api';

const BUILTIN_FRAMEWORKS = [
  { id:'eu_ai_act',   label:'EU AI Act',         desc:'European Union AI Act (2024, enforced 2026)', color:'#0078D4' },
  { id:'nist_ai_rmf', label:'NIST AI RMF',        desc:'NIST AI Risk Management Framework 1.0',       color:'#00B7C3' },
  { id:'owasp_llm',   label:'OWASP LLM Top 10',   desc:'OWASP Top 10 for LLM Applications (2025)',    color:'#16C60C' },
  { id:'iso_42001',   label:'ISO/IEC 42001',       desc:'AI Management Systems Standard',              color:'#FFB900' },
];

function ComplianceCard({ fw, data, onEvidence }) {
  const scoreColor = !data ? 'var(--text-muted)'
    : data.score >= 90 ? 'var(--low)' : data.score >= 70 ? 'var(--medium)' : 'var(--critical)';

  return (
    <div className="card" style={{borderTop:`3px solid ${fw.color||'var(--accent)'}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
        <div>
          <div style={{fontWeight:700,color:'var(--text-primary)',fontSize:14,marginBottom:3}}>{fw.label}</div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>{fw.desc}</div>
        </div>
        {data && <span className={`badge badge-${data.status}`}>{data.status?.toUpperCase()}</span>}
      </div>

      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:14}}>
        <div style={{fontFamily:'var(--font-mono)',fontSize:34,fontWeight:700,color:scoreColor}}>
          {data ? `${data.score?.toFixed(0)}%` : '—'}
        </div>
        <div style={{flex:1}}>
          <div className="progress-bar" style={{height:6,marginBottom:5}}>
            <div className="progress-fill" style={{width:`${data?.score||0}%`,background:scoreColor}}/>
          </div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>
            {data ? `${data.controls_passed}/${data.controls_total} controls passing` : 'Run a scan to assess'}
          </div>
        </div>
      </div>

      {data && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
          {[
            {label:'Passing',   val:data.controls_passed, color:'var(--low)'},
            {label:'Failing',   val:data.controls_failed, color:'var(--critical)'},
            {label:'Open Gaps', val:data.open_findings,   color:'var(--high)'},
          ].map(({label,val,color})=>(
            <div key={label} style={{textAlign:'center',padding:'8px',background:'rgba(0,0,0,0.2)',borderRadius:6,border:'1px solid var(--border)'}}>
              <div style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:18,color}}>{val}</div>
              <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {data && (data.controls||[]).slice(0,4).map(ctrl => (
        <div key={ctrl.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
          <div>
            <span style={{fontSize:10,fontFamily:'var(--font-mono)',color:'var(--text-muted)',marginRight:6}}>{ctrl.id}</span>
            <span style={{fontSize:12,color:'var(--text-secondary)'}}>{ctrl.name}</span>
          </div>
          <span style={{fontSize:12,color:ctrl.status==='pass'?'var(--low)':'var(--critical)',fontWeight:700}}>
            {ctrl.status==='pass'?'✓':'✗'}
          </span>
        </div>
      ))}

      <button className="btn btn-outline" style={{width:'100%',justifyContent:'center',marginTop:12}} onClick={() => onEvidence(fw.id)}>
        ⬇ Generate Evidence Pack
      </button>
    </div>
  );
}

function AddFrameworkModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    label: '', desc: '', color: '#0078D4',
    controls: [{ id:'', name:'', article:'' }],
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const addControl = () => setForm(f=>({...f, controls:[...f.controls, {id:'',name:'',article:''}]}));
  const updateControl = (i,k,v) => setForm(f=>{
    const c=[...f.controls]; c[i]={...c[i],[k]:v}; return {...f,controls:c};
  });
  const removeControl = i => setForm(f=>({...f, controls:f.controls.filter((_,j)=>j!==i)}));

  const save = async () => {
    if (!form.label.trim()) return alert('Framework name required');
    setSaving(true);
    try {
      await onSave({
        label: form.label,
        desc: form.desc,
        color: form.color,
        controls: form.controls.filter(c=>c.id&&c.name),
      });
      onClose();
    } catch { alert('Error saving framework'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{width:620}}>
        <div className="modal-title">
          + Add Compliance Framework
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="form-row">
            <div className="form-group">
              <label>Framework Name *</label>
              <input value={form.label} onChange={e=>set('label',e.target.value)} placeholder="e.g. SOC 2 Type II" />
            </div>
            <div className="form-group">
              <label>Accent Colour</label>
              <div style={{display:'flex',gap:8}}>
                <input type="color" value={form.color} onChange={e=>set('color',e.target.value)} style={{width:44,padding:2,height:34,cursor:'pointer'}}/>
                <input value={form.color} onChange={e=>set('color',e.target.value)} style={{flex:1,fontFamily:'var(--font-mono)',fontSize:12}}/>
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input value={form.desc} onChange={e=>set('desc',e.target.value)} placeholder="Brief description of this framework"/>
          </div>

          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <label>Controls</label>
              <button className="btn btn-outline btn-xs" onClick={addControl}>+ Add Control</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:220,overflowY:'auto'}}>
              {form.controls.map((ctrl,i) => (
                <div key={i} style={{display:'grid',gridTemplateColumns:'120px 1fr 140px 28px',gap:6,alignItems:'center'}}>
                  <input value={ctrl.id} onChange={e=>updateControl(i,'id',e.target.value)} placeholder="Control ID" style={{fontFamily:'var(--font-mono)',fontSize:11}}/>
                  <input value={ctrl.name} onChange={e=>updateControl(i,'name',e.target.value)} placeholder="Control name"/>
                  <input value={ctrl.article} onChange={e=>updateControl(i,'article',e.target.value)} placeholder="Article / Section"/>
                  <button className="btn btn-ghost btn-xs" onClick={()=>removeControl(i)} style={{color:'var(--critical)'}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:6}}>
              Add the controls (requirements) this framework mandates. OpenGovAI will map findings to these controls automatically.
            </div>
          </div>

          <div className="alert alert-info" style={{fontSize:12}}>
            After adding, run a scan with this framework selected to generate compliance posture data.
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

export default function Compliance() {
  const [data,        setData]       = useState({});
  const [loading,     setLoading]    = useState(true);
  const [evidence,    setEvidence]   = useState(null);
  const [showAdd,     setShowAdd]    = useState(false);
  const [customFws,   setCustomFws]  = useState([]);

  const allFws = [...BUILTIN_FRAMEWORKS, ...customFws];

  useEffect(() => {
    setLoading(true);
    Promise.all(allFws.map(fw => getCompliance(fw.id).then(d=>[fw.id,d]).catch(()=>[fw.id,null])))
      .then(r => setData(Object.fromEntries(r)))
      .finally(() => setLoading(false));
  }, [customFws.length]);

  const handleEvidence = async fw => {
    try { setEvidence(await generateEvidence(fw)); }
    catch { alert('Failed to generate evidence pack'); }
  };

  const handleAddFramework = async form => {
    try {
      await registerFramework(form);
      setCustomFws(prev => [...prev, { id: form.label.toLowerCase().replace(/\s+/g,'_'), label: form.label, desc: form.desc, color: form.color }]);
    } catch { alert('Failed to register framework'); }
  };

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:48}}><div className="spinner"/></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Compliance Posture</div>
          <div className="page-sub">{allFws.length} frameworks · {customFws.length} custom</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Framework</button>
      </div>

      <div className="grid-2" style={{marginBottom:20}}>
        {allFws.map(fw => (
          <ComplianceCard key={fw.id} fw={fw} data={data[fw.id]} onEvidence={handleEvidence}/>
        ))}
        {/* Add Framework card */}
        <div className="add-card" onClick={() => setShowAdd(true)}>
          <span style={{fontSize:24}}>+</span>
          <div>
            <div style={{fontWeight:600,fontSize:13}}>Add Framework</div>
            <div style={{fontSize:11,marginTop:2}}>Register a custom compliance framework</div>
          </div>
        </div>
      </div>

      {/* Evidence pack modal */}
      {evidence && (
        <div className="modal-overlay">
          <div className="modal" style={{width:660}}>
            <div className="modal-title">
              Evidence Pack — {evidence.label}
              <button className="btn btn-ghost btn-sm" onClick={() => setEvidence(null)}>✕</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div className="alert alert-info">Pack ID: <code>{evidence.pack_id}</code> · Generated: {new Date(evidence.generated_at).toLocaleString()}</div>
              <div className="grid-3">
                {[
                  {label:'Total Findings', val:evidence.executive_summary?.total_findings},
                  {label:'Open',           val:evidence.executive_summary?.open},
                  {label:'Critical',       val:evidence.executive_summary?.critical},
                ].map(({label,val})=>(
                  <div key={label} style={{textAlign:'center',padding:12,background:'rgba(0,0,0,0.2)',borderRadius:6,border:'1px solid var(--border)'}}>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:22,fontWeight:700,color:'var(--text-primary)'}}>{val}</div>
                    <div style={{fontSize:10,color:'var(--text-muted)',marginTop:2}}>{label}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',marginBottom:6}}>Scope</div>
                <div style={{fontSize:12,color:'var(--text-secondary)',background:'rgba(0,0,0,0.2)',padding:'10px 12px',borderRadius:4,border:'1px solid var(--border)'}}>
                  Assets: {evidence.scope?.assets?.join(', ')}<br/>Period: {evidence.scope?.period}
                </div>
              </div>
              <div className="alert alert-warning" style={{fontSize:12}}>{evidence.attestation?.note}</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEvidence(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => {
                const blob=new Blob([JSON.stringify(evidence,null,2)],{type:'application/json'});
                const a=document.createElement('a');a.href=URL.createObjectURL(blob);
                a.download=`${evidence.pack_id}.json`;a.click();
              }}>⬇ Export JSON</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && <AddFrameworkModal onClose={() => setShowAdd(false)} onSave={handleAddFramework}/>}
    </div>
  );
}
