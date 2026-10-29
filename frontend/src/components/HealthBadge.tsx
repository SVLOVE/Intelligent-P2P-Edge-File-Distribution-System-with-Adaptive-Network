import React from 'react';
import type { ConnectionState } from '../types';

interface HealthBadgeProps {
  status: ConnectionState;
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          label: 'Connected',
          className: 'badge badge-connected',
          indicatorClass: 'indicator-connected',
        };
      case 'disconnected':
        return {
          label: 'Disconnected',
          className: 'badge badge-disconnected',
          indicatorClass: 'indicator-disconnected',
        };
      case 'loading':
      default:
        return {
          label: 'Checking...',
          className: 'badge badge-loading',
          indicatorClass: 'indicator-loading',
        };
    }
  };

  const { label, className, indicatorClass } = getStatusConfig();

  return (
    <span className={className} data-testid="health-badge" role="status">
      <span className={`status-dot ${indicatorClass}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};
