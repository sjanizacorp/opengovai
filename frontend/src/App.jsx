import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import './index.css';
import Dashboard from './pages/Dashboard.jsx';
import Assets from './pages/Assets.jsx';
import Scans from './pages/Scans.jsx';
import Findings from './pages/Findings.jsx';
import Compliance from './pages/Compliance.jsx';
import Policies from './pages/Policies.jsx';
import Workflows from './pages/Workflows.jsx';

const NAV = [
  { group: 'Overview', items: [
    { path: '/', label: 'Dashboard', icon: '▦' },
  ]},
  { group: 'Govern', items: [
    { path: '/assets', label: 'Asset Registry', icon: '◈' },
    { path: '/workflows', label: 'Workflows', icon: '⬡' },
    { path: '/policies', label: 'Policies', icon: '⊞' },
  ]},
  { group: 'Assess', items: [
    { path: '/scans', label: 'Scans', icon: '⟳' },
    { path: '/findings', label: 'Findings', icon: '⚑' },
    { path: '/compliance', label: 'Compliance', icon: '✔' },
  ]},
];

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">OpenGovAI</div>
        <div className="logo-sub">AI Governance Platform</div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(group => (
          <div key={group.group}>
            <div className="nav-section">{group.group}</div>
            {group.items.map(item => (
              <div
                key={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span style={{ fontSize: 16, fontFamily: 'monospace', width: 16, textAlign: 'center' }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="version-badge">v1.0.0 • OpenGovAI</div>
      </div>
    </aside>
  );
}

function Topbar({ title, sub }) {
  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div className="topbar-right">
        <div className="status-dot" title="System operational" />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>System Operational</span>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff'
        }}>AI</div>
      </div>
    </div>
  );
}

const PAGE_META = {
  '/':           { title: 'Dashboard', sub: 'AI governance posture overview' },
  '/assets':     { title: 'Asset Registry', sub: 'Discover and manage AI systems' },
  '/scans':      { title: 'Scans', sub: 'Security assessments and scan history' },
  '/findings':   { title: 'Findings', sub: 'Vulnerabilities and compliance gaps' },
  '/compliance': { title: 'Compliance', sub: 'Framework posture and evidence packs' },
  '/policies':   { title: 'Policies', sub: 'Governance policy packs and controls' },
  '/workflows':  { title: 'Workflows', sub: 'Deployment approvals and risk reviews' },
};

function Layout() {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] || { title: 'OpenGovAI' };

  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <Topbar title={meta.title} sub={meta.sub} />
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/scans" element={<Scans />} />
            <Route path="/findings" element={<Findings />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/workflows" element={<Workflows />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
