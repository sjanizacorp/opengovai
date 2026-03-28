import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';
import { getDashboard } from '../api';

const SEVERITY_COLORS = { critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#22C55E', info: '#64748B' };

function StatTile({ label, value, sub, accent, prefix }) {
  return (
    <div className="stat-tile" style={{ '--tile-accent': accent }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{prefix}{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function ComplianceBar({ label, score }) {
  const color = score >= 90 ? '#22C55E' : score >= 70 ? '#EAB308' : '#EF4444';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>{score?.toFixed(1)}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

const FW_LABELS = {
  eu_ai_act: 'EU AI Act',
  nist_ai_rmf: 'NIST AI RMF',
  owasp_llm: 'OWASP LLM',
  iso_42001: 'ISO 42001',
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}><div className="spinner" /></div>;
  if (!data) return <div className="alert alert-critical">Failed to load dashboard data.</div>;

  const radarData = Object.entries(data.compliance_scores || {}).map(([k, v]) => ({
    subject: FW_LABELS[k] || k, score: v
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* KPI tiles */}
      <div className="grid-4">
        <StatTile label="Total AI Assets" value={data.total_assets} sub={`${data.active_assets} active`} accent="var(--accent)" />
        <StatTile label="Open Findings" value={data.open_findings} sub={`${data.critical_findings} critical`} accent="var(--critical)" />
        <StatTile label="Shadow AI Detected" value={data.shadow_ai_detected} sub="Ungoverned systems" accent="var(--high)" />
        <StatTile label="Total Scans Run" value={data.total_scans} sub="All time" accent="var(--teal)" />
      </div>

      <div className="grid-2">
        {/* Risk trend */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Risk Score Trend (7d)</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.risk_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}
                labelStyle={{ color: 'var(--text-primary)' }}
                itemStyle={{ color: 'var(--accent)' }}
              />
              <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Compliance radar */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Compliance Coverage</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
              <Radar name="Score" dataKey="score" stroke="var(--teal)" fill="var(--teal)" fillOpacity={0.15} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}
                formatter={(v) => [`${v}%`, 'Score']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2">
        {/* Compliance scores */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Framework Compliance Scores</span>
          </div>
          {Object.entries(data.compliance_scores || {}).map(([fw, score]) => (
            <ComplianceBar key={fw} label={FW_LABELS[fw] || fw} score={score} />
          ))}
        </div>

        {/* Recent scans */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Scans</span>
          </div>
          {data.recent_scans?.length === 0 && <div className="empty-state"><p>No scans yet</p></div>}
          {data.recent_scans?.map(scan => (
            <div key={scan.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{scan.id}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{scan.target || scan.asset_id}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge badge-${scan.status}`}>{scan.status}</span>
                {scan.risk_score && (
                  <div style={{ fontSize: 11, marginTop: 4, fontFamily: 'var(--font-mono)', color: scan.risk_score >= 7 ? 'var(--high)' : 'var(--medium)' }}>
                    Risk: {scan.risk_score}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Finding severity summary */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Open Findings by Severity</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {['critical','high','medium','low','info'].map(sev => (
            <div key={sev} style={{
              flex: 1, padding: '14px 12px', borderRadius: 6,
              background: `${SEVERITY_COLORS[sev]}10`,
              border: `1px solid ${SEVERITY_COLORS[sev]}30`,
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: SEVERITY_COLORS[sev] }}>
                {sev === 'critical' ? data.critical_findings : sev === 'high' ? data.high_findings : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {sev}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
