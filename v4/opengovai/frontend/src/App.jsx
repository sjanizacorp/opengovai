import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import './index.css';
import Dashboard   from './pages/Dashboard';
import Assets      from './pages/Assets';
import Scans       from './pages/Scans';
import Findings    from './pages/Findings';
import Compliance  from './pages/Compliance';
import Policies    from './pages/Policies';
import Workflows   from './pages/Workflows';

const NAV = [
  { group: 'Overview', items: [
    { path: '/',           label: 'Dashboard',      icon: '⊞' },
  ]},
  { group: 'Govern', items: [
    { path: '/assets',     label: 'Asset Registry', icon: '◈' },
    { path: '/workflows',  label: 'Workflows',      icon: '⬡' },
    { path: '/policies',   label: 'Policies',       icon: '⊟' },
  ]},
  { group: 'Assess', items: [
    { path: '/scans',      label: 'Scans',          icon: '⟳' },
    { path: '/findings',   label: 'Findings',       icon: '⚑' },
    { path: '/compliance', label: 'Compliance',     icon: '✔' },
  ]},
];

const PAGE_META = {
  '/':           { title: 'Dashboard',      sub: 'AI governance posture overview' },
  '/assets':     { title: 'Asset Registry', sub: 'Discover and manage AI systems' },
  '/scans':      { title: 'Scans',          sub: 'Security assessments and scan history' },
  '/findings':   { title: 'Findings',       sub: 'Vulnerabilities and compliance gaps' },
  '/compliance': { title: 'Compliance',     sub: 'Framework posture and evidence packs' },
  '/policies':   { title: 'Policies',       sub: 'Governance policy packs and controls' },
  '/workflows':  { title: 'Workflows',      sub: 'Deployment approvals and risk reviews' },
};

function Sidebar() {
  const navigate  = useNavigate();
  const location  = useLocation();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">G</div>
        <div className="logo-text">
          <div className="logo-mark">OpenGovAI</div>
          <div className="logo-sub">AI Governance</div>
        </div>
      </div>

      {/* Nav */}
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
                <span className="nav-item-icon">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="version-badge">v3.0.0 · OpenGovAI</div>
      </div>
    </aside>
  );
}

function Topbar({ title, sub }) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <div>
          <div className="topbar-title">{title}</div>
          {sub && <div className="topbar-sub">{sub}</div>}
        </div>
      </div>
      <div className="topbar-right">
        <div className="status-indicator">
          <span className="status-dot" />
          System Operational
        </div>
        <div className="user-avatar" title="AI Governance Admin">A</div>
      </div>
    </div>
  );
}

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
            <Route path="/"           element={<Dashboard />} />
            <Route path="/assets"     element={<Assets />} />
            <Route path="/scans"      element={<Scans />} />
            <Route path="/findings"   element={<Findings />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/policies"   element={<Policies />} />
            <Route path="/workflows"  element={<Workflows />} />
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
