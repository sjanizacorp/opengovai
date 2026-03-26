import React, { useEffect, useState } from 'react';
import { getCompliance, generateEvidence } from '../api';

const FRAMEWORKS = [
  { id: 'eu_ai_act', label: 'EU AI Act', desc: 'European Union Artificial Intelligence Act (2024, enforced 2026)' },
  { id: 'nist_ai_rmf', label: 'NIST AI RMF', desc: 'NIST AI Risk Management Framework 1.0' },
  { id: 'owasp_llm', label: 'OWASP LLM Top 10', desc: 'OWASP Top 10 for Large Language Models (2025)' },
  { id: 'iso_42001', label: 'ISO 42001', desc: 'ISO/IEC 42001 AI Management Systems' },
];

function ComplianceCard({ fw, data, onEvidence }) {
  const scoreColor = data?.score >= 90 ? 'var(--low)' : data?.score >= 70 ? 'var(--medium)' : 'var(--critical)';

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{fw.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{fw.desc}</div>
        </div>
        <span className={`badge badge-${data?.status || 'info'}`}>{data?.status?.toUpperCase() || '—'}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 700, color: scoreColor }}>
          {data?.score?.toFixed(0) || '—'}%
        </div>
        <div style={{ flex: 1 }}>
          <div className="progress-bar" style={{ height: 8, marginBottom: 6 }}>
            <div className="progress-fill" style={{ width: `${data?.score || 0}%`, background: scoreColor }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {data?.controls_passed || 0}/{data?.controls_total || 0} controls passing
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'rgba(34,197,94,0.08)', borderRadius: 4, border: '1px solid rgba(34,197,94,0.2)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--low)', fontSize: 18 }}>{data?.controls_passed || 0}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>PASSING</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'rgba(239,68,68,0.08)', borderRadius: 4, border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--critical)', fontSize: 18 }}>{data?.controls_failed || 0}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>FAILING</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'rgba(249,115,22,0.08)', borderRadius: 4, border: '1px solid rgba(249,115,22,0.2)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--high)', fontSize: 18 }}>{data?.open_findings || 0}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>OPEN GAPS</div>
        </div>
      </div>

      {/* Controls list */}
      <div style={{ marginBottom: 12 }}>
        {(data?.controls || []).slice(0, 4).map(ctrl => (
          <div key={ctrl.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginRight: 8 }}>{ctrl.id}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ctrl.name}</span>
            </div>
            <span style={{ fontSize: 11, color: ctrl.status === 'pass' ? 'var(--low)' : 'var(--critical)' }}>
              {ctrl.status === 'pass' ? '✓' : '✗'}
            </span>
          </div>
        ))}
      </div>

      <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onEvidence(fw.id)}>
        ⬇ Generate Evidence Pack
      </button>
    </div>
  );
}

export default function Compliance() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [evidence, setEvidence] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all(FRAMEWORKS.map(fw => getCompliance(fw.id).then(d => [fw.id, d])))
      .then(results => setData(Object.fromEntries(results)))
      .finally(() => setLoading(false));
  }, []);

  const handleEvidence = async (fw) => {
    try {
      const pack = await generateEvidence(fw);
      setEvidence(pack);
    } catch(e) { alert('Failed to generate evidence pack'); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Compliance Posture</div>
          <div className="page-sub">Framework coverage across {FRAMEWORKS.length} active standards</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {FRAMEWORKS.map(fw => (
          <ComplianceCard key={fw.id} fw={fw} data={data[fw.id]} onEvidence={handleEvidence} />
        ))}
      </div>

      {evidence && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: 700 }}>
            <div className="modal-title">
              Evidence Pack — {evidence.label}
              <button className="btn btn-outline btn-sm" onClick={() => setEvidence(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="alert alert-info">Pack ID: <code>{evidence.pack_id}</code> • Generated: {new Date(evidence.generated_at).toLocaleString()}</div>
              <div className="grid-3">
                {[
                  { label: 'Total Findings', val: evidence.executive_summary?.total_findings },
                  { label: 'Open', val: evidence.executive_summary?.open },
                  { label: 'Critical', val: evidence.executive_summary?.critical },
                ].map(({ label, val }) => (
                  <div key={label} style={{ textAlign: 'center', padding: 12, background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Scope</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 4, border: '1px solid var(--border)' }}>
                  Assets: {evidence.scope?.assets?.join(', ')}<br />
                  Period: {evidence.scope?.period}
                </div>
              </div>
              <div className="alert alert-warning">{evidence.attestation?.note}</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEvidence(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => { const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${evidence.pack_id}.json`; a.click(); }}>
                ⬇ Export JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
