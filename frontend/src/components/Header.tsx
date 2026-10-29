import React from 'react';
import type { ConnectionState, HealthStatus, ScreenId } from '../types';
import { MenuIcon, RefreshIcon } from './icons/Icons';

interface HeaderProps {
  currentScreen: ScreenId;
  screenTitle: string;
  screenSubtitle?: string;
  connectionState: ConnectionState;
  healthData: HealthStatus | null;
  onToggleSidebar: () => void;
  onRefreshHealth: () => void;
  onNavigate: (screen: ScreenId) => void;
}

export const Header: React.FC<HeaderProps> = ({
  screenTitle,
  screenSubtitle,
  connectionState,
  healthData,
  onToggleSidebar,
  onRefreshHealth,
  onNavigate,
}) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <MenuIcon size={20} />
        </button>
        <div className="header-title-box">
          <h1 className="header-main-title">{screenTitle}</h1>
          {screenSubtitle && <p className="header-sub-title">{screenSubtitle}</p>}
        </div>
      </div>

      <div className="header-right">
        {/* Backend health status pill */}
        <button
          type="button"
          className="header-backend-pill"
          onClick={() => onNavigate('readiness')}
          title="Click to view Backend Tier Readiness Details"
        >
          <span className="pill-label">FastAPI API:</span>
          <span className={`peer-status-dot ${connectionState}`} />
          <span className="backend-text-status">
            {connectionState === 'connected' ? 'API Online' : connectionState === 'disconnected' ? 'Offline' : 'Probing...'}
          </span>
          {connectionState === 'connected' && healthData && (
            <span className="backend-version-tag">v{healthData.version}</span>
          )}
        </button>

        <button
          type="button"
          className="header-refresh-btn"
          onClick={onRefreshHealth}
          title="Refresh backend health and simulated edge telemetry"
          aria-label="Refresh telemetry"
        >
          <RefreshIcon size={16} />
        </button>

        <div className="header-sim-badge" title="No real WebRTC or live peer connections are active.">
          <span>SIMULATED DEMO</span>
        </div>
      </div>
    </header>
  );
};
