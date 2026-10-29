import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../src/App';

describe('Intelligent P2P Edge Frontend - Phase 1', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders the project name and primary heading', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise(() => {}) // pending promise
    );

    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: /intelligent p2p edge file distribution system with adaptive network/i,
      })
    ).toBeInTheDocument();

    expect(screen.getByText(/phase 1: environment readiness/i)).toBeInTheDocument();
  });

  it('displays "Connected" when health check succeeds', async () => {
    const mockHealthResponse = {
      status: 'ok',
      service: 'intelligent-p2p-edge-backend',
      version: '0.1.0',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHealthResponse,
    });

    render(<App />);

    // Initially displays checking or loading
    expect(screen.getByRole('status')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    expect(screen.getByText('intelligent-p2p-edge-backend')).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
  });

  it('displays "Disconnected" when health check fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    expect(screen.getByText(/Connection refused/i)).toBeInTheDocument();
  });
});
