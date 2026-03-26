import React, { useEffect, useState } from 'react';
import { getPolicies, createPolicy } from '../api';

const FW_COLORS = {
  eu_ai_act: 'var(--accent)',
  nist_ai_rmf: 'var(--teal)',
  owasp_llm: 'var(--high)',
  iso_42001: 'var(--gold)',
  gdpr: 'var(--medium)',
};

function PolicyCard({ policy }) {
  const color = FW_COLORS[policy.framework] || 'var(--text-muted)';
  return (
    <div className="card" style={{ borderTop: `2px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14, marginBottom: 4 }}>{policy.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{policy.description}</div>
        </div>
        <span className={`badge badge-${policy.status}`}>{policy.status}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20, color }}>{policy.controls}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Controls</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20, color: 'var(--text-secondary)' }}>{policy.version}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Version</div>
        </div>
        <div style={{ flex: 2, display: 'flex', alignItems: 'center' }}>
          <span style={{ padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}40` }}>
            {policy.framework?.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

function AddPolicyModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', description: '', framework: 'eu_ai_act', controls: 0 });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name) return alert('Name required');
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch(e) { alert('Error saving policy'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 520 }}>
        <div className="modal-title">Create Policy Pack <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group"><label>Policy Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Corporate AI Acceptable Use Policy v3" /></div>
          <div className="form-group"><label>Description</label><textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div className="form-row">
            <div className="form-group"><label>Framework</label>
              <select value={form.framework} onChange={e => set('framework', e.target.value)}>
                {['eu_ai_act','nist_ai_rmf','owasp_llm','iso_42001','gdpr','custom'].map(f => <option key={f} value={f}>{f.replace(/_/g,' ').toUpperCase()}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Number of Controls</label><input type="number" value={form.controls} onChange={e => set('controls', parseInt(e.target.value) || 0)} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Create Policy'}</button>
        </div>
      </div>
    </div>
  );
}

const PREBUILT = [
  { id: 'eu_ai_act', label: 'EU AI Act Pack', desc: 'Art. 9, 10, 11, 13, 14 — full lifecycle controls', controls: 24 },
  { id: 'nist_ai_rmf', label: 'NIST AI RMF Pack', desc: 'GOVERN, MAP, MEASURE, MANAGE functions', controls: 18 },
  { id: 'owasp_llm', label: 'OWASP LLM Security Pack', desc: 'All 10 LLM Top 10 2025 categories + probes', controls: 30 },
  { id: 'iso_42001', label: 'ISO 42001 Pack', desc: 'AI Management System certification controls', controls: 15 },
  { id: 'responsible_ai', label: 'Responsible AI Template', desc: 'Internal RAI policy starting template', controls: 12 },
];

export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    setLoading(true);
    getPolicies().then(d => setPolicies(d.policies || [])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (form) => { await createPolicy(form); load(); };

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
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Available Pre-Built Policy Packs</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {PREBUILT.map((pack, i) => (
            <div key={pack.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: i < PREBUILT.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{pack.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{pack.desc} — {pack.controls} controls</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={async () => { await createPolicy({ name: pack.label, description: pack.desc, framework: pack.id, controls: pack.controls }); load(); }}>
                Load Pack
              </button>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
      ) : (
        <div className="grid-2">
          {policies.map(p => <PolicyCard key={p.id} policy={p} />)}
          {policies.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <p>No policies loaded — load a pre-built pack above or create a custom policy</p>
            </div>
          )}
        </div>
      )}

      {showAdd && <AddPolicyModal onClose={() => setShowAdd(false)} onSave={handleCreate} />}
    </div>
  );
}
