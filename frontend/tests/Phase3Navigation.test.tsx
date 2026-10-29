import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../src/App';

describe('Intelligent P2P Edge Frontend - Phase 3 Navigation & UI', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        service: 'intelligent-p2p-edge-backend',
        version: '0.1.0',
      }),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.location.hash = '';
  });

  it('renders the Overview Dashboard with key KPI cards', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(screen.getAllByText('Overview Dashboard').length).toBeGreaterThan(0);
    expect(screen.getByText('Swarm Offload Ratio')).toBeInTheDocument();
    expect(screen.getByText('78.4%')).toBeInTheDocument();
    expect(screen.getByText('Connected Edge Peers')).toBeInTheDocument();
    expect(screen.getByText(/Simulated Network Telemetry/i)).toBeInTheDocument();
  });

  it('navigates to File Library and filters files by search query', async () => {
    await act(async () => {
      render(<App />);
    });

    const fileLibBtn = screen.getByRole('button', { name: /file library/i });
    await act(async () => {
      fireEvent.click(fileLibBtn);
    });

    expect(screen.getByText('edge_firmware_arm64_v1.4.img')).toBeInTheDocument();
    expect(screen.getByText('telemetry_dataset_2026_q3.parquet')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/search by filename/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'firmware' } });
    });

    expect(screen.getByText('edge_firmware_arm64_v1.4.img')).toBeInTheDocument();
    expect(screen.queryByText('telemetry_dataset_2026_q3.parquet')).not.toBeInTheDocument();
  });

  it('navigates to Upload File and shows chunk calculation', async () => {
    await act(async () => {
      render(<App />);
    });

    const uploadBtn = screen.getByRole('button', { name: /upload file/i });
    await act(async () => {
      fireEvent.click(uploadBtn);
    });

    expect(screen.getByText(/Select File for Edge Partitioning/i)).toBeInTheDocument();
    expect(screen.getByText(/Client-Side Preparation Only/i)).toBeInTheDocument();

    // Click sample PCAP preset
    const sampleBtn = screen.getByText(/Sample PCAP/i);
    await act(async () => {
      fireEvent.click(sampleBtn);
    });

    expect(screen.getByText('autonomous_drone_lidar_dataset.pcap')).toBeInTheDocument();
    expect(screen.getByText('850 chunks')).toBeInTheDocument();
  });

  it('navigates to Adaptive Scheduling Engine and verifies formula', async () => {
    await act(async () => {
      render(<App />);
    });

    const engineBtn = screen.getByRole('button', { name: /adaptive engine/i });
    await act(async () => {
      fireEvent.click(engineBtn);
    });

    expect(screen.getByText(/Composite Peer Utility Scoring Formulation/i)).toBeInTheDocument();
    expect(screen.getByText(/Score\(p_i, c_k\) = A_\{i,k\} · \[ w_T · T̂_i \+ w_L · L̂_i \+ w_S · S_i - w_F · F̂_i \]/i)).toBeInTheDocument();
    expect(screen.getByText(/ε-Greedy Exploration Policy/i)).toBeInTheDocument();
  });

  it('navigates to Network Topology and renders SVG graph', async () => {
    await act(async () => {
      render(<App />);
    });

    const topoBtn = screen.getByRole('button', { name: /network topology/i });
    await act(async () => {
      fireEvent.click(topoBtn);
    });

    expect(screen.getByText('Swarm Mesh Connectivity Graph')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /network topology diagram/i })).toBeInTheDocument();
  });

  it('navigates to Analytics and displays throughput timeline', async () => {
    await act(async () => {
      render(<App />);
    });

    const analyticsBtn = screen.getByRole('button', { name: /analytics/i });
    await act(async () => {
      fireEvent.click(analyticsBtn);
    });

    expect(screen.getByText(/Throughput Timeline: P2P Swarm vs. Origin Ingest/i)).toBeInTheDocument();
    expect(screen.getByText('Total Bandwidth Offloaded')).toBeInTheDocument();
    expect(screen.getByText('Latency Percentiles (RTT)')).toBeInTheDocument();
  });

  it('navigates to Activity Logs and filters by severity', async () => {
    await act(async () => {
      render(<App />);
    });

    const logsBtn = screen.getByRole('button', { name: /activity logs/i });
    await act(async () => {
      fireEvent.click(logsBtn);
    });

    expect(screen.getAllByText('CHUNK_HASH_VERIFIED').length).toBeGreaterThan(0);
    expect(screen.getByText('ADAPTIVE_ALLOCATION')).toBeInTheDocument();

    const sevSelect = screen.getByLabelText(/severity/i);
    await act(async () => {
      fireEvent.change(sevSelect, { target: { value: 'WARN' } });
    });

    expect(screen.getByText('CHUNK_DEADLINE_TIMEOUT')).toBeInTheDocument();
    expect(screen.queryByText('ADAPTIVE_ALLOCATION')).not.toBeInTheDocument();
  });

  it('navigates to Settings and toggles theme and chunk size', async () => {
    await act(async () => {
      render(<App />);
    });

    const settingsBtn = screen.getByRole('button', { name: /settings/i });
    await act(async () => {
      fireEvent.click(settingsBtn);
    });

    expect(screen.getByText('Edge Chunk Transport Defaults')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Presentation')).toBeInTheDocument();

    const chunkSizeSelect = screen.getByLabelText(/default chunk boundary size/i);
    await act(async () => {
      fireEvent.change(chunkSizeSelect, { target: { value: '2097152' } });
    });

    expect(chunkSizeSelect).toHaveValue('2097152');
  });

  it('navigates to Help and About and presents architecture and boundaries', async () => {
    await act(async () => {
      render(<App />);
    });

    const helpBtn = screen.getByRole('button', { name: /help and about/i });
    await act(async () => {
      fireEvent.click(helpBtn);
    });

    expect(screen.getByText('System Architecture Overview')).toBeInTheDocument();
    expect(screen.getByText('Project Boundaries & Scope Constraints')).toBeInTheDocument();
    expect(screen.getByText(/Honest Simulation Boundary/i)).toBeInTheDocument();
  });
});
