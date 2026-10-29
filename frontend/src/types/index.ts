export interface HealthStatus {
  status: string;
  service: string;
  version: string;
}

export type ConnectionState = 'loading' | 'connected' | 'disconnected';

export * from './dashboard';
