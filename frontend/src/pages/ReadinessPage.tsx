import React from 'react';
import type { ConnectionState, HealthStatus } from '../types';
import { InitStatusCard } from '../components/InitStatusCard';

interface ReadinessPageProps {
  connectionState: ConnectionState;
  healthData: HealthStatus | null;
  errorMessage: string | null;
  apiUrl: string;
  onRefresh: () => void;
}

export const ReadinessPage: React.FC<ReadinessPageProps> = ({
  connectionState,
  healthData,
  errorMessage,
  apiUrl,
  onRefresh,
}) => {
  return (
    <div className="page-container readiness-page">
      <div className="readiness-wrapper">
        <InitStatusCard
          connectionState={connectionState}
          healthData={healthData}
          errorMessage={errorMessage}
          apiUrl={apiUrl}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
};
