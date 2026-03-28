import React, { useEffect, useState } from 'react';
import { getWorkflows, createWorkflow, approveWorkflowStage } from '../api';

const STAGE_LABELS = {
  security_review: 'Security Review',
  risk_assessment: 'Risk Assessment',
  compliance_check: 'Compliance Check',
  governance_approval: 'Governance Approval',
};

function StageTrack({ stages, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '14px 0' }}>
      {stages.map((stage, i) => {
        const isActive = stage.name === current && stage.status !== 'approved';
        const isDone = stage.status === 'approved';
        const color = isDone ? 'var(--low)' : isActive ? 'var(--accent)' : 'var(--border-light)';
        return (
          <React.Fragment key={stage.name}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: isDone ? 'rgba(34,197,94,0.15)' : isActive ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color,
              }}>
                {isDone ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 10, color: isDone ? 'var(--low)' : isActive ? 'var(--accent)' : 'var(--text-muted)', marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap' }}>
                {stage.label}
              </div>
            </div>
            {i < stages.length - 1 && (
              <div style={{ flex: 2, height: 2, background: isDone ? 'var(--low)' : 'var(--border)', marginBottom: 18, opacity: 0.4 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function WorkflowDetail({ wf, onClose, onApprove }) {
  const [approver, setApprover] = useState('');
  const [notes, setNotes] = useState('');
  const [approving, setApproving] = useState(false);

  const currentStage = wf.stages?.find(s => s.name === wf.current_stage);
  const canApprove = wf.status === 'pending' && currentStage?.status !== 'approved';

  const approve = async () => {
    if (!approver) return alert('Enter approver email');
    setApproving(true);
    try { await onApprove(wf.id, approver, notes); onClose(); }
    catch(e) { alert('Approval failed'); }
    finally { setApproving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 680 }}>
        <div className="modal-title">
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{wf.id}</span>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{wf.title}</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span className={`badge badge-${wf.status}`}>{wf.status}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Asset: <code>{wf.asset_id}</code></span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Type: {wf.type?.replace(/_/g,' ')}</span>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 4, border: '1px solid var(--border)' }}>
            {wf.description}
          </div>

          <StageTrack stages={wf.stages || []} current={wf.current_stage} />

          {/* Stage history */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>Stage History</div>
            {wf.stages?.map(stage => (
              <div key={stage.name} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{stage.label}</div>
                  {stage.approver && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Approved by {stage.approver}</div>}
                  {stage.notes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontStyle: 'italic' }}>{stage.notes}</div>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: stage.status === 'approved' ? 'var(--low)' : stage.status === 'in_progress' ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {stage.status?.replace('_',' ').toUpperCase()}
                </span>
              </div>
            ))}
          </div>

          {canApprove && (
            <div style={{ padding: '16px', background: 'var(--accent-glow)', borderRadius: 6, border: '1px solid var(--accent-dim)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 12 }}>
                ◎ Pending Action: {STAGE_LABELS[wf.current_stage] || wf.current_stage}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="form-group"><label>Approver Email *</label><input value={approver} onChange={e => setApprover(e.target.value)} placeholder="your@email.com" /></div>
                <div className="form-group"><label>Notes (optional)</label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Approval rationale or conditions…" /></div>
              </div>
            </div>
          )}

          {wf.status === 'approved' && (
            <div className="alert alert-success">✓ Workflow fully approved — deployment authorised.</div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          {canApprove && (
            <button className="btn btn-primary" onClick={approve} disabled={approving}>
              {approving ? 'Approving…' : '✓ Approve Stage'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewWorkflowModal({ onClose, onSave }) {
  const [form, setForm] = useState({ asset_id: '', type: 'deployment_approval', title: '', description: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.asset_id || !form.title) return alert('Asset ID and title required');
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch(e) { alert('Error creating workflow'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 520 }}>
        <div className="modal-title">New Governance Workflow <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row">
            <div className="form-group"><label>Asset ID *</label><input value={form.asset_id} onChange={e => set('asset_id', e.target.value)} placeholder="ASSET-XXXXX" /></div>
            <div className="form-group"><label>Workflow Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="deployment_approval">Deployment Approval</option>
                <option value="risk_review">Risk Review</option>
                <option value="compliance_review">Compliance Review</option>
                <option value="incident_response">Incident Response</option>
                <option value="retirement_approval">Retirement Approval</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Title *</label><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Production Deployment Request — Fraud Model v4" /></div>
          <div className="form-group"><label>Description</label><textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the request and any relevant context…" /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create Workflow'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState('');

  const load = () => {
    setLoading(true);
    getWorkflows().then(d => setWorkflows(d.workflows || [])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = async (form) => { await createWorkflow(form); load(); };
  const handleApprove = async (id, approver, notes) => { await approveWorkflowStage(id, approver, notes); load(); };

  const filtered = filter ? workflows.filter(w => w.status === filter) : workflows;
  const pendingCount = workflows.filter(w => w.status === 'pending').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Governance Workflows</div>
          <div className="page-sub">{pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All Workflows</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Workflow</button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          ⚑ {pendingCount} workflow{pendingCount !== 1 ? 's' : ''} awaiting your approval
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(wf => {
            const stagesApproved = (wf.stages || []).filter(s => s.status === 'approved').length;
            const totalStages = (wf.stages || []).length;
            return (
              <div key={wf.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelected(wf)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{wf.id}</code>
                      <span className={`badge badge-${wf.status}`}>{wf.status}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{wf.type?.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{wf.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Asset: <code>{wf.asset_id}</code> • Created {new Date(wf.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: 20 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>{stagesApproved}/{totalStages} stages</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {wf.status === 'pending' ? `Pending: ${STAGE_LABELS[wf.current_stage] || wf.current_stage}` : wf.status}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(stagesApproved / totalStages) * 100}%`, background: wf.status === 'approved' ? 'var(--low)' : 'var(--accent)' }} />
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="empty-state"><p>No workflows found</p></div>}
        </div>
      )}

      {selected && <WorkflowDetail wf={selected} onClose={() => setSelected(null)} onApprove={handleApprove} />}
      {showNew && <NewWorkflowModal onClose={() => setShowNew(false)} onSave={handleCreate} />}
    </div>
  );
}
