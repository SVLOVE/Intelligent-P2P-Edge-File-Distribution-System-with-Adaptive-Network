import React, { useState, useEffect, useCallback } from 'react';
import type { ConnectionState, HealthStatus } from '../types';
import { checkBackendHealth, API_BASE_URL } from '../services/api';
import { formatErrorMessage } from '../utils';
import { InitStatusCard } from '../components/InitStatusCard';

export const LandingPage: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading');
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setConnectionState('loading');
    setErrorMessage(null);
    try {
      const data = await checkBackendHealth();
      setHealthData(data);
      setConnectionState('connected');
    } catch (err) {
      setHealthData(null);
      setErrorMessage(formatErrorMessage(err));
      setConnectionState('disconnected');
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return (
    <main className="landing-container">
      <header className="hero-section">
        <div className="badge-tag">Phase 1: Project Initialization</div>
        <h1 className="hero-title">
          Intelligent P2P Edge File Distribution System with Adaptive Network
        </h1>
        <p className="hero-description">
          A high-performance peer-to-peer decentralized file distribution system
          optimized with edge telemetry and adaptive network scheduling.
        </p>
      </header>

      <section className="content-section">
        <InitStatusCard
          connectionState={connectionState}
          healthData={healthData}
          errorMessage={errorMessage}
          apiUrl={API_BASE_URL}
          onRefresh={fetchHealth}
        />
      </section>
    </main>
  );
};
