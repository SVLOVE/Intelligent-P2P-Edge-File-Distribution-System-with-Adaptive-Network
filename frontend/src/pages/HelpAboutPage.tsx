import React from 'react';
import type { ScreenId } from '../types';
import { InfoIcon, CheckCircleIcon } from '../components/icons/Icons';

interface HelpAboutPageProps {
  onNavigate: (screen: ScreenId) => void;
}

export const HelpAboutPage: React.FC<HelpAboutPageProps> = ({
  onNavigate,
}) => {
  return (
    <div className="page-container help-about-page">
      {/* Simulation Banner */}
      <div className="sim-notice-banner" role="region" aria-label="Simulation Notice">
        <div className="notice-icon">ℹ</div>
        <div className="notice-content">
          <strong>Project Baseline &amp; Research Guide:</strong> This dashboard is an advanced college
          research demonstration platform for peer-to-peer edge distribution. Review this section for
          architecture specifications, research limits, and navigation guidance.
        </div>
      </div>

      <div className="help-grid">
        {/* Architecture Overview Card */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">System Architecture Overview</h2>
              <p className="panel-subtitle">Tier responsibilities across the decentralized edge distribution stack</p>
            </div>
            <InfoIcon size={20} className="text-info" />
          </div>

          <div className="architecture-tiers">
            <div className="tier-box">
              <div className="tier-title">
                <span className="tier-badge">Tier 1</span>
                <strong>Frontend Presentation &amp; Telemetry UI (Phase 3)</strong>
              </div>
              <p>
                React 19 + TypeScript + Vite responsive dashboard. Visualizes swarm metrics, chunk
                bitfields, topology graphs, and adaptive scheduling without third-party heavy dependencies.
              </p>
            </div>

            <div className="tier-box">
              <div className="tier-title">
                <span className="tier-badge">Tier 2</span>
                <strong>Signaling &amp; Orchestration Service (Phase 1 Baseline)</strong>
              </div>
              <p>
                FastAPI + Python 3.14 asynchronous backend. Provides health diagnostics (<code>/api/v1/health</code>),
                structured environment configuration, and future WebSockets for ICE SDP exchange.
              </p>
            </div>

            <div className="tier-box">
              <div className="tier-title">
                <span className="tier-badge">Tier 3</span>
                <strong>Transport Layer: WebRTC SCTP over DTLS (Design Spec)</strong>
              </div>
              <p>
                Low-latency peer-to-peer data channels utilizing SCTP framing encrypted by DTLS. Distinct
                from SRTP (which is media-only), data channels handle binary Merkle chunk slices.
              </p>
            </div>

            <div className="tier-box">
              <div className="tier-title">
                <span className="tier-badge">Tier 4</span>
                <strong>Adaptive Scheduling Engine (Design Spec)</strong>
              </div>
              <p>
                Multi-factor composite scoring engine:
                <code>Score = A_{'{i,k}'} · [0.45·T̂_i + 0.25·L̂_i + 0.20·S_i - 0.30·F̂_i]</code> balancing
                85% exploitation of proven seeders with 15% ε-greedy exploration of untested edge nodes.
              </p>
            </div>
          </div>
        </div>

        {/* Research Boundaries & Limitations */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Project Boundaries &amp; Scope Constraints</h2>
              <p className="panel-subtitle">Transparent disclosure of Phase 3 demo environment limitations</p>
            </div>
            <CheckCircleIcon size={20} className="text-success" />
          </div>

          <div className="limitations-list">
            <div className="limit-item">
              <strong className="text-warning">1. Honest Simulation Boundary:</strong>
              <p>
                All peer nodes, bandwidth histograms, RTT latencies, and chunk bitfields displayed across
                these screens are client-side simulated according to Phase 2 architecture formulas. No real
                WebRTC sockets or live distributed swarms are connected.
              </p>
            </div>

            <div className="limit-item">
              <strong className="text-warning">2. Zero Cloud Persistence:</strong>
              <p>
                No Supabase database migrations, cloud storage uploads, or production TURN credentials are
                configured or required. Files staged on the Upload screen remain exclusively inside the
                local browser memory sandbox.
              </p>
            </div>

            <div className="limit-item">
              <strong className="text-success">3. Preserved Phase 1 Integration:</strong>
              <p>
                The existing FastAPI backend health endpoint is fully integrated and actively probed by the
                header status pill and Environment Readiness screen.
              </p>
            </div>
          </div>

          <div className="navigation-guide-box">
            <h3 className="guide-title">Recommended Evaluation Flow:</h3>
            <ol className="guide-steps">
              <li>
                <button type="button" className="link-inline" onClick={() => onNavigate('overview')}>
                  Overview Dashboard
                </button>
                : Review aggregate swarm health and Phase 1 backend readiness.
              </li>
              <li>
                <button type="button" className="link-inline" onClick={() => onNavigate('files')}>
                  File Library
                </button>
                : Inspect catalog files and their cryptographic SHA-256 digests.
              </li>
              <li>
                <button type="button" className="link-inline" onClick={() => onNavigate('upload')}>
                  Upload File
                </button>
                : Test client-side chunk partitioning and Merkle tree calculations.
              </li>
              <li>
                <button type="button" className="link-inline" onClick={() => onNavigate('transfers')}>
                  Transfer Monitor
                </button>
                : Observe simulated multi-peer chunk pipelining in action.
              </li>
              <li>
                <button type="button" className="link-inline" onClick={() => onNavigate('adaptive-engine')}>
                  Adaptive Engine
                </button>
                : Adjust weight sliders to test peer utility re-ranking live.
              </li>
              <li>
                <button type="button" className="link-inline" onClick={() => onNavigate('topology')}>
                  Network Topology
                </button>
                : Click interactive nodes to view direct P2P vs TURN links.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
