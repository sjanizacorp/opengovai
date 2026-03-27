import React, { useEffect, useState } from 'react';
import { getPolicies, createPolicy } from '../api';

const FW_COLORS = {
  eu_ai_act:'#0078D4', nist_ai_rmf:'#00B7C3', owasp_llm:'#16C60C',
  iso_42001:'#FFB900', gdpr:'#7C6AFF', custom:'#FF8C00',
};

const PREBUILT = [
  { id:'eu_ai_act',  label:'EU AI Act Pack',                 desc:'Articles 9,10,11,13,14 — full lifecycle',     controls:24 },
  { id:'nist_ai_rmf',label:'NIST AI RMF Pack',               desc:'GOVERN, MAP, MEASURE, MANAGE functions',       controls:18 },
  { id:'owasp_llm',  label:'OWASP LLM Security Pack',        desc:'All 10 LLM Top 10 2025 categories + probes',   controls:30 },
  { id:'iso_42001',  label:'ISO 42001 Management System',     desc:'AI management system certification controls',  controls:15 },
  { id:'responsible',label:'Responsible AI Template',        desc:'Internal RAI policy starting template',        controls:12 },
];

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
    description: "No production PII may be used in model training without DPO sign-off"
    check_ref: "data_privacy.pii_training_data"
    severity: critical
    frameworks: [gdpr, eu_ai_act]
    test: |
      # Automated check: scan training dataset for PII fields
      from opengovai.checks import pii_scanner
      result = pii_scanner.scan_dataset(dataset_path)
      assert result.pii_count == 0, f"PII found: {result.pii_fields}"

  - id: CTRL-002
    name: "Agent Kill Switch Requirement"
    description: "All autonomous agents must implement and test a human override"
    check_ref: "agentic_governance.kill_switch_validation"
    severity: high
    frameworks: [eu_ai_act]
    test: |
      from opengovai.checks import kill_switch_validator
      result = kill_switch_validator.test(agent_endpoint)
      assert result.latency_ms < 1000, "Kill switch latency exceeds 1s"`;

function PolicyCard({ policy }) {
  const color = FW_COLORS[policy.framework] || FW_COLORS.custom;
  return (
    <div className="card" style={{borderTop:`3px solid ${color}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
        <div>
          <div style={{fontWeight:700,color:'var(--text-primary)',fontSize:13,marginBottom:3}}>{policy.name}</div>
          <div style={{fontSize:11,color:'var(--text-muted)'}}>{policy.description}</div>
        </div>
        <span className={`badge badge-${policy.status}`}>{policy.status}</span>
      </div>
      <div style={{display:'flex',gap:10,marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}}>
        <div style={{flex:1,textAlign:'center'}}>
          <div style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:18,color}}>{policy.controls}</div>
          <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase'}}>Controls</div>
        </div>
        <div style={{flex:1,textAlign:'center'}}>
          <div style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:18,color:'var(--text-secondary)'}}>{policy.version}</div>
          <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase'}}>Version</div>
        </div>
        <div style={{flex:2,display:'flex',alignItems:'center'}}>
          <span style={{padding:'2px 8px',borderRadius:10,fontSize:10,fontWeight:600,background:`${color}18`,color,border:`1px solid ${color}40`}}>
            {policy.framework?.replace(/_/g,' ').toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

function AddPolicyModal({ onClose, onSave }) {
  const [tab, setTab] = useState('form'); // form | yaml
  const [form, setForm] = useState({ name:'', description:'', framework:'eu_ai_act', controls:0 });
  const [yaml, setYaml] = useState(POLICY_YAML_TEMPLATE);
  const [tests, setTests] = useState([{ name:'', check_ref:'', severity:'high', code:'' }]);
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const addTest = () => setTests(p=>[...p, {name:'',check_ref:'',severity:'high',code:''}]);
  const updateTest = (i,k,v) => setTests(p=>{const n=[...p];n[i]={...n[i],[k]:v};return n;});
  const removeTest = i => setTests(p=>p.filter((_,j)=>j!==i));

  const save = async () => {
    if (!form.name.trim()) return alert('Policy name required');
    setSaving(true);
    try {
      await onSave({ ...form, controls: form.controls || tests.filter(t=>t.name).length });
      onClose();
    } catch { alert('Error saving policy'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{width:700}}>
        <div className="modal-title">
          + Create Policy Pack
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Mini tab strip */}
        <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',marginBottom:18}}>
          {[{id:'form',label:'Form Editor'},{id:'yaml',label:'YAML Editor'},{id:'tests',label:'Custom Tests'}].map(t=>(
            <button key={t.id} className={`tab-btn ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'form' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div className="form-group"><label>Policy Name *</label>
              <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Corporate AI Acceptable Use Policy v3"/>
            </div>
            <div className="form-group"><label>Description</label>
              <textarea rows={2} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="What this policy governs"/>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Framework</label>
                <select value={form.framework} onChange={e=>set('framework',e.target.value)}>
                  {['eu_ai_act','nist_ai_rmf','owasp_llm','iso_42001','gdpr','custom'].map(f=>
                    <option key={f} value={f}>{f.replace(/_/g,' ').toUpperCase()}</option>
                  )}
                </select>
              </div>
              <div className="form-group"><label>Control Count</label>
                <input type="number" value={form.controls} onChange={e=>set('controls',parseInt(e.target.value)||0)} placeholder="0"/>
              </div>
            </div>
          </div>
        )}

        {tab === 'yaml' && (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div className="alert alert-info" style={{fontSize:12}}>
              Paste or edit a policy definition in YAML format. Controls and tests will be parsed automatically.
            </div>
            <textarea
              value={yaml} onChange={e=>setYaml(e.target.value)}
              rows={16}
              style={{fontFamily:'var(--font-mono)',fontSize:11,lineHeight:1.6,resize:'vertical',background:'#0A1020',color:'#A8D8FF',border:'1px solid var(--border)',borderLeft:'3px solid var(--accent)',borderRadius:6,padding:'12px 14px'}}
            />
            <div style={{fontSize:11,color:'var(--text-muted)'}}>
              The policy name will be extracted from the YAML. Controls defined here will be mapped against scan findings automatically.
            </div>
          </div>
        )}

        {tab === 'tests' && (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontSize:12,color:'var(--text-muted)'}}>Define automated checks that OpenGovAI will run as part of this policy.</div>
              <button className="btn btn-outline btn-sm" onClick={addTest}>+ Add Test</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14,maxHeight:380,overflowY:'auto'}}>
              {tests.map((test,i) => (
                <div key={i} style={{background:'rgba(0,0,0,0.2)',borderRadius:6,padding:12,border:'1px solid var(--border)'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <span style={{fontSize:12,fontWeight:600,color:'var(--text-secondary)'}}>Test {i+1}</span>
                    <button className="btn btn-ghost btn-xs" onClick={()=>removeTest(i)} style={{color:'var(--critical)'}}>✕ Remove</button>
                  </div>
                  <div className="form-row" style={{marginBottom:8}}>
                    <div className="form-group"><label>Test Name</label>
                      <input value={test.name} onChange={e=>updateTest(i,'name',e.target.value)} placeholder="e.g. PII Leakage Detection"/>
                    </div>
                    <div className="form-group"><label>Severity</label>
                      <select value={test.severity} onChange={e=>updateTest(i,'severity',e.target.value)}>
                        {['critical','high','medium','low'].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{marginBottom:8}}>
                    <label>Check Reference (e.g. data_privacy.pii_scan)</label>
                    <input value={test.check_ref} onChange={e=>updateTest(i,'check_ref',e.target.value)} placeholder="module.check_name" style={{fontFamily:'var(--font-mono)',fontSize:12}}/>
                  </div>
                  <div className="form-group">
                    <label>Test Code (Python)</label>
                    <textarea value={test.code} onChange={e=>updateTest(i,'code',e.target.value)}
                      rows={4} placeholder="# Your test implementation here&#10;result = run_check(target)&#10;assert result.passed, result.message"
                      style={{fontFamily:'var(--font-mono)',fontSize:11,lineHeight:1.6,resize:'vertical',background:'#0A1020',color:'#A8D8FF',border:'1px solid var(--border)',borderLeft:`3px solid ${FW_COLORS[form.framework]||'var(--accent)'}`,borderRadius:4,padding:'8px 10px'}}
                    />
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

export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);

  const load = () => {
    setLoading(true);
    getPolicies().then(d=>setPolicies(d.policies||[])).finally(()=>setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async form => { await createPolicy(form); load(); };
  const loadPack = async pack => {
    await createPolicy({ name:pack.label, description:pack.desc, framework:pack.id, controls:pack.controls });
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Governance Policies</div>
          <div className="page-sub">{policies.length} active policy packs</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Create Policy</button>
      </div>

      {/* Pre-built packs */}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-header">
          <span className="card-title">Pre-Built Policy Packs</span>
          <span style={{fontSize:11,color:'var(--text-muted)'}}>Load a pack to activate its controls</span>
        </div>
        {PREBUILT.map((pack,i) => (
          <div key={pack.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:i<PREBUILT.length-1?'1px solid var(--border)':'none'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:4,height:36,borderRadius:2,background:FW_COLORS[pack.id]||FW_COLORS.custom,flexShrink:0}}/>
              <div>
                <div style={{fontWeight:600,color:'var(--text-primary)',fontSize:13}}>{pack.label}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:1}}>{pack.desc} — {pack.controls} controls</div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => loadPack(pack)}>Load Pack</button>
          </div>
        ))}
      </div>

      {/* Loaded policies */}
      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:48}}><div className="spinner"/></div>
      ) : (
        <div>
          <div style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:12}}>
            Active Policy Packs ({policies.length})
          </div>
          <div className="grid-2">
            {policies.map(p => <PolicyCard key={p.id} policy={p}/>)}
            <div className="add-card" onClick={() => setShowAdd(true)}>
              <span style={{fontSize:22}}>+</span>
              <div>
                <div style={{fontWeight:600,fontSize:13}}>Create Custom Policy</div>
                <div style={{fontSize:11,marginTop:2}}>Form editor, YAML, or custom tests</div>
              </div>
            </div>
            {policies.length === 0 && (
              <div className="empty-state" style={{gridColumn:'1/-1'}}>
                <p>No policies loaded — load a pre-built pack above or create a custom policy</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showAdd && <AddPolicyModal onClose={() => setShowAdd(false)} onSave={handleCreate}/>}
    </div>
  );
}
