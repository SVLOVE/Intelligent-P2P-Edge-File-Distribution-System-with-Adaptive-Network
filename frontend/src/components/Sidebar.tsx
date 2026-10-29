import React from 'react';
import type { ScreenId } from '../types';
import {
  DashboardIcon,
  FolderIcon,
  UploadIcon,
  FileTextIcon,
  ActivityIcon,
  NetworkIcon,
  TopologyIcon,
  CpuIcon,
  BarChartIcon,
  TerminalIcon,
  SettingsIcon,
  InfoIcon,
  CheckCircleIcon,
} from './icons/Icons';

interface SidebarProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: ScreenId;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
}

interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onNavigate,
  isOpen,
  onCloseMobile,
}) => {
  const navGroups: NavGroup[] = [
    {
      groupLabel: 'Core Operations',
      items: [
        { id: 'overview', label: 'Overview Dashboard', icon: <DashboardIcon size={18} /> },
        { id: 'files', label: 'File Library', icon: <FolderIcon size={18} />, badge: 5 },
        { id: 'upload', label: 'Upload File', icon: <UploadIcon size={18} /> },
        { id: 'file-details', label: 'File Details', icon: <FileTextIcon size={18} /> },
      ],
    },
    {
      groupLabel: 'Transfers & Streams',
      items: [
        { id: 'transfers', label: 'Transfer Monitor', icon: <ActivityIcon size={18} />, badge: '2 Active' },
        { id: 'transfer-details', label: 'Transfer Details', icon: <FileTextIcon size={18} /> },
      ],
    },
    {
      groupLabel: 'Edge Swarm Network',
      items: [
        { id: 'peers', label: 'Peer Network', icon: <NetworkIcon size={18} />, badge: 8 },
        { id: 'topology', label: 'Network Topology', icon: <TopologyIcon size={18} /> },
        { id: 'adaptive-engine', label: 'Adaptive Engine', icon: <CpuIcon size={18} /> },
      ],
    },
    {
      groupLabel: 'Observability & Analytics',
      items: [
        { id: 'analytics', label: 'Analytics', icon: <BarChartIcon size={18} /> },
        { id: 'activity-logs', label: 'Activity Logs', icon: <TerminalIcon size={18} />, badge: 10 },
      ],
    },
    {
      groupLabel: 'System & Reference',
      items: [
        { id: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
        { id: 'help', label: 'Help and About', icon: <InfoIcon size={18} /> },
        { id: 'readiness', label: 'Environment Readiness', icon: <CheckCircleIcon size={18} /> },
      ],
    },
  ];

  return (
    <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-dot" />
        <div className="brand-titles">
          <span className="brand-main">P2P Edge System</span>
          <span className="brand-sub">Adaptive Network</span>
        </div>
      </div>

      <div className="simulation-pill-box">
        <span className="sim-dot" />
        <span className="sim-text">Simulated Telemetry Mode</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main Navigation">
        {navGroups.map((group) => (
          <div key={group.groupLabel} className="nav-group">
            <div className="nav-group-title">{group.groupLabel}</div>
            <ul className="nav-list">
              {group.items.map((item) => {
                const isActive = currentScreen === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`nav-button ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        onNavigate(item.id);
                        onCloseMobile();
                      }}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-text">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="nav-badge">{item.badge}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="tier-info">
          <span>Frontend: React 19 + TS</span>
          <span>Phase 3 UI/UX</span>
        </div>
      </div>
    </aside>
  );
};
