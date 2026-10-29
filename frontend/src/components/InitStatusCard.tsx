import React from 'react';
import type { ConnectionState, HealthStatus } from '../types';
import { HealthBadge } from './HealthBadge';

interface InitStatusCardProps {
  connectionState: ConnectionState;
  healthData: HealthStatus | null;
  errorMessage: string | null;
  apiUrl: string;
  onRefresh: () => void;
}

export const InitStatusCard: React.FC<InitStatusCardProps> = ({
  connectionState,
  healthData,
  errorMessage,
  apiUrl,
  onRefresh,
}) => {
  return (
    <div className="init-card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Phase 1: Environment Readiness</h2>
          <p className="card-subtitle">
            System initialization and cross-tier connectivity validation
          </p>
        </div>
        <HealthBadge status={connectionState} />
      </div>

      <div className="status-grid">
        <div className="status-item">
          <span className="status-label">Frontend Tier</span>
          <span className="status-value highlight">React 19 + TypeScript + Vite</span>
        </div>

        <div className="status-item">
          <span className="status-label">Backend Tier</span>
          <span className="status-value highlight">FastAPI + Uvicorn (Python 3.14)</span>
        </div>

        <div className="status-item">
          <span className="status-label">Backend Target URL</span>
          <code className="status-code">{apiUrl}</code>
        </div>

        <div className="status-item">
          <span className="status-label">Health Endpoint</span>
          <code className="status-code">/api/v1/health</code>
        </div>
      </div>

      {connectionState === 'connected' && healthData && (
        <div className="details-box success-box">
          <h3 className="details-heading">Active Backend Telemetry</h3>
          <div className="details-grid">
            <div>
              <strong>Service:</strong> <span>{healthData.service}</span>
            </div>
            <div>
              <strong>Reported Version:</strong> <span>{healthData.version}</span>
            </div>
            <div>
              <strong>Readiness Status:</strong> <span className="status-text-ok">{healthData.status.toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}

      {connectionState === 'disconnected' && (
        <div className="details-box error-box">
          <h3 className="details-heading">Backend Connection Unavailable</h3>
          <p className="error-text">
            {errorMessage || 'Could not establish connection to the FastAPI backend.'}
          </p>
          <p className="troubleshoot-hint">
            To start the backend, run: <code>uvicorn app.main:app --reload --host 127.0.0.1 --port 8000</code> in the <code>backend/</code> directory.
          </p>
        </div>
      )}

      <div className="card-footer">
        <button
          type="button"
          className="refresh-btn"
          onClick={onRefresh}
          disabled={connectionState === 'loading'}
        >
          {connectionState === 'loading' ? 'Verifying...' : 'Recheck Health Endpoint'}
        </button>
      </div>
    </div>
  );
};
