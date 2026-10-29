import React, { useState } from 'react';
import type { ScreenId } from '../types';
import { MOCK_ADAPTIVE_COMPONENTS } from '../services/mockData';
import { CpuIcon, RefreshIcon } from '../components/icons/Icons';
import { formatSpeed } from '../utils';

interface AdaptiveEnginePageProps {
  onNavigate: (screen: ScreenId) => void;
}

export const AdaptiveEnginePage: React.FC<AdaptiveEnginePageProps> = () => {
  // Configurable weights matching Phase 2 specification defaults
  const [weightT, setWeightT] = useState(0.45);
  const [weightL, setWeightL] = useState(0.25);
  const [weightS, setWeightS] = useState(0.20);
  const [weightF, setWeightF] = useState(0.30);
  const [epsilon, setEpsilon] = useState(0.15);

  const resetWeights = () => {
    setWeightT(0.45);
    setWeightL(0.25);
    setWeightS(0.20);
    setWeightF(0.30);
    setEpsilon(0.15);
  };

  // Re-calculate scores dynamically based on sliders
  const scoredPeers = MOCK_ADAPTIVE_COMPONENTS.map((item) => {
    const rawScore =
      weightT * item.normalizedThroughput +
      weightL * item.normalizedLatency +
      weightS * item.successRatio -
      weightF * item.failurePenalty;
    const boundedScore = Math.max(0, Math.min(1, rawScore));

    let decision = item.decision;
    if (boundedScore < 0.10) {
      decision = 'Choked';
    }

    return {
      ...item,
      dynamicScore: boundedScore,
      dynamicDecision: decision,
    };
  }).sort((a, b) => b.dynamicScore - a.dynamicScore);

  return (
    <div className="page-container adaptive-engine-page">
      {/* Simulation Banner */}
      <div className="sim-notice-banner" role="region" aria-label="Simulation Notice">
        <div className="notice-icon">ℹ</div>
        <div className="notice-content">
          <strong>Algorithmic Telemetry Workbench:</strong> Dynamic peer scores and assignment decisions
          are calculated using the approved Phase 2 Adaptive Network Scheduling specification. Adjusting
          weights updates utility ranking live.
        </div>
      </div>

      {/* Algorithmic Formula Card */}
      <div className="dashboard-panel formula-card">
        <div className="formula-header">
          <CpuIcon size={24} className="formula-icon" />
          <div>
            <h2 className="panel-title">Composite Peer Utility Scoring Formulation</h2>
            <p className="panel-subtitle">
              SVD multi-factor utility function balancing bandwidth, latency decay, reliability and failure penalties
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={resetWeights}
            title="Reset to approved Phase 2 default weights"
          >
            <RefreshIcon size={14} />
            <span>Reset Defaults</span>
          </button>
        </div>

        <div className="formula-display-box">
          <code className="latex-formula">
            Score(p_i, c_k) = A_{'{i,k}'} · [ w_T · T̂_i + w_L · L̂_i + w_S · S_i - w_F · F̂_i ]
          </code>
          <div className="formula-sub-rules">
            <span>• Throughput: T̂_i = T_i / max(T_swarm, 1024)</span>
            <span>• Latency Decay: L̂_i = exp(-L_i / 250ms)</span>
            <span>• Penalty: F̂_i = min(1.0, F_i / 3)</span>
            <span>• Demotion Threshold: Score ≤ 0.10 ⇒ Choked</span>
          </div>
        </div>

        {/* Dynamic Weight Sliders */}
        <div className="weights-slider-grid">
          <div className="slider-control">
            <div className="slider-label-row">
              <span className="slider-name">Throughput Weight (w_T):</span>
              <span className="slider-val text-success">{weightT.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.80"
              step="0.05"
              value={weightT}
              onChange={(e) => setWeightT(parseFloat(e.target.value))}
              className="range-input"
              aria-label="Throughput weight slider"
            />
            <span className="slider-hint">Dominant factor for download duration</span>
          </div>

          <div className="slider-control">
            <div className="slider-label-row">
              <span className="slider-name">Latency Weight (w_L):</span>
              <span className="slider-val text-info">{weightL.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.60"
              step="0.05"
              value={weightL}
              onChange={(e) => setWeightL(parseFloat(e.target.value))}
              className="range-input"
              aria-label="Latency weight slider"
            />
            <span className="slider-hint">Exponential decay with L_ref = 250ms</span>
          </div>

          <div className="slider-control">
            <div className="slider-label-row">
              <span className="slider-name">Success Ratio Weight (w_S):</span>
              <span className="slider-val text-accent">{weightS.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.50"
              step="0.05"
              value={weightS}
              onChange={(e) => setWeightS(parseFloat(e.target.value))}
              className="range-input"
              aria-label="Success ratio weight slider"
            />
            <span className="slider-hint">Prioritizes verified cryptographic integrity</span>
          </div>

          <div className="slider-control">
            <div className="slider-label-row">
              <span className="slider-name">Failure Penalty (w_F):</span>
              <span className="slider-val text-warning">{weightF.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.60"
              step="0.05"
              value={weightF}
              onChange={(e) => setWeightF(parseFloat(e.target.value))}
              className="range-input"
              aria-label="Failure penalty weight slider"
            />
            <span className="slider-hint">Suppresses timeouts and corrupt chunks (Subtractive)</span>
          </div>
        </div>

        {/* Weight Vector Architecture & Normalization Analysis */}
        <div className="weight-analysis-box">
          <div className="analysis-presets-row">
            <span className="analysis-presets-title">Weight Vector Presets:</span>
            <div className="presets-group">
              <button
                type="button"
                className={`preset-pill-btn ${weightT === 0.45 && weightL === 0.25 && weightS === 0.20 && weightF === 0.30 ? 'active' : ''}`}
                onClick={resetWeights}
              >
                Phase 2 Baseline (0.45, 0.25, 0.20, -0.30)
              </button>
              <button
                type="button"
                className={`preset-pill-btn ${weightT === 0.50 && Math.abs(weightL - 0.28) < 0.01 && Math.abs(weightS - 0.22) < 0.01 ? 'active' : ''}`}
                onClick={() => {
                  setWeightT(0.50);
                  setWeightL(0.28);
                  setWeightS(0.22);
                  setWeightF(0.33);
                }}
              >
                Normalized Convex (0.50, 0.28, 0.22, -0.33)
              </button>
              <button
                type="button"
                className={`preset-pill-btn ${weightT === 0.50 && weightL === 0.30 && weightS === 0.20 && weightF === 0.30 ? 'active' : ''}`}
                onClick={() => {
                  setWeightT(0.50);
                  setWeightL(0.30);
                  setWeightS(0.20);
                  setWeightF(0.30);
                }}
              >
                Normalized Rounded (0.50, 0.30, 0.20, -0.30)
              </button>
            </div>
          </div>

          <div className="weight-sums-grid">
            <div className="sum-item">
              <span className="sum-label">Positive Reward Sum (w_T + w_L + w_S):</span>
              <span className="sum-value text-success font-bold">
                {(weightT + weightL + weightS).toFixed(2)}
              </span>
            </div>
            <div className="sum-item">
              <span className="sum-label">Subtractive Risk Penalty (-w_F):</span>
              <span className="sum-value text-warning font-bold">
                -{weightF.toFixed(2)}
              </span>
            </div>
            <div className="sum-item">
              <span className="sum-label">Max Theoretical Utility:</span>
              <span className="sum-value text-info font-bold">
                {Math.min(1.0, weightT + weightL + weightS).toFixed(2)} / 1.00
              </span>
            </div>
          </div>

          <p className="analysis-subtext">
            <strong>Normalization Audit Note:</strong> The absolute sum of parameters (0.45 + 0.25 + 0.20 + 0.30 = 1.20)
            occurs because w_F is a subtractive penalty rather than an additive weight. Positive reward weights sum to 0.90 in baseline (or 1.00 in normalized mode).
            Because candidate peer selection uses argmax, relative peer ranking order remains identical under both baseline and normalized formulations.
          </p>
        </div>
      </div>

      {/* Exploration vs Exploitation Strategy Section */}
      <div className="dashboard-two-col">
        {/* Epsilon Greedy Policy Box */}
        <div className="dashboard-panel">
          <h3 className="panel-title">ε-Greedy Exploration Policy</h3>
          <p className="panel-subtitle">Prevents stagnation by testing newly joined edge nodes</p>

          <div className="epsilon-gauge-container">
            <div className="epsilon-slider-box">
              <div className="slider-label-row">
                <span className="slider-name">Exploration Rate (ε):</span>
                <span className="slider-val text-warning">{(epsilon * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.30"
                step="0.01"
                value={epsilon}
                onChange={(e) => setEpsilon(parseFloat(e.target.value))}
                className="range-input"
                aria-label="Epsilon exploration slider"
              />
            </div>

            <div className="policy-ratio-bar">
              <div
                className="ratio-fill exploitation"
                style={{ width: `${(1 - epsilon) * 100}%` }}
                title={`Exploitation: ${((1 - epsilon) * 100).toFixed(0)}%`}
              >
                <span>Exploit ({((1 - epsilon) * 100).toFixed(0)}%)</span>
              </div>
              <div
                className="ratio-fill exploration"
                style={{ width: `${epsilon * 100}%` }}
                title={`Exploration: ${(epsilon * 100).toFixed(0)}%`}
              >
                <span>Explore ({(epsilon * 100).toFixed(0)}%)</span>
              </div>
            </div>

            <div className="policy-explanation">
              <div className="policy-note">
                <strong className="text-success">Exploitation ({(1 - epsilon) * 100}%):</strong> Chunks
                routed strictly to proven highest-scoring candidate peers for maximum sustained throughput.
              </div>
              <div className="policy-note">
                <strong className="text-warning">Exploration ({epsilon * 100}%):</strong> Probes newly
                discovered peers to evaluate bandwidth and update decay history before assigning full pipeline.
              </div>
            </div>
          </div>
        </div>

        {/* Scheduling Rationale Inspector */}
        <div className="dashboard-panel">
          <h3 className="panel-title">Scheduling Decision Rationale</h3>
          <p className="panel-subtitle">Algorithmic trace for pending chunk request #289</p>

          <div className="rationale-flow">
            <div className="rationale-step">
              <div className="step-num">1</div>
              <div className="step-content">
                <strong>Bitfield Possession Check (A_{'{i,289}'}):</strong>
                <p>Identified 6 candidate peers holding chunk #289. 2 peers excluded (no chunk bitfield).</p>
              </div>
            </div>

            <div className="rationale-step">
              <div className="step-num">2</div>
              <div className="step-content">
                <strong>Policy Mode Selection:</strong>
                <p>Roll = 0.72 &gt; ε (0.15). Exploitation mode engaged. Selecting peer with max utility score.</p>
              </div>
            </div>

            <div className="rationale-step">
              <div className="step-num">3</div>
              <div className="step-content">
                <strong>Utility Winner Selected:</strong>
                <p>
                  <strong>Edge-LAN-Gateway-01</strong> selected (Score: {scoredPeers[0]?.dynamicScore.toFixed(3)}).
                  Pipeline window allocated: 4/4 concurrent chunks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Candidate Peers Scoring Breakdown Table */}
      <div className="dashboard-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Live Candidate Peer Scoring Matrix</h3>
            <p className="panel-subtitle">Real-time normalized variables and composite utility ranking</p>
          </div>
          <span className="ranking-badge">
            Ranked by Dynamic Score ({scoredPeers.length} Peers)
          </span>
        </div>

        <div className="table-responsive-wrapper">
          <table className="data-table" aria-label="Peer Scoring Matrix">
            <thead>
              <tr>
                <th>Rank & Peer</th>
                <th>Raw Throughput</th>
                <th>T̂_i (Norm)</th>
                <th>Raw Latency</th>
                <th>L̂_i (Decay)</th>
                <th>Success (S_i)</th>
                <th>Failures (F̂_i)</th>
                <th>Composite Score</th>
                <th>Window (W_i)</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {scoredPeers.map((peer, idx) => (
                <tr key={peer.peerId}>
                  <td>
                    <div className="peer-id-cell">
                      <span className="rank-num">#{idx + 1}</span>
                      <strong>{peer.peerName}</strong>
                    </div>
                  </td>
                  <td className="monospace-cell">{formatSpeed(peer.rawThroughputBps)}</td>
                  <td className="monospace-cell text-success">{peer.normalizedThroughput.toFixed(2)}</td>
                  <td className="monospace-cell">{peer.rawLatencyMs.toFixed(1)} ms</td>
                  <td className="monospace-cell text-info">{peer.normalizedLatency.toFixed(3)}</td>
                  <td className="monospace-cell">{(peer.successRatio * 100).toFixed(0)}%</td>
                  <td className="monospace-cell">
                    {peer.rawFailures > 0 ? (
                      <span className="text-warning">
                        {peer.rawFailures} (F̂: {peer.failurePenalty.toFixed(2)})
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td>
                    <div className="score-cell">
                      <span className="score-val font-bold">
                        {peer.dynamicScore.toFixed(3)}
                      </span>
                      <div className="mini-score-bar">
                        <div
                          className="mini-score-fill"
                          style={{ width: `${peer.dynamicScore * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="pipeline-window-pill">
                      {peer.pipelineWindow} chunks
                    </div>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        peer.dynamicDecision === 'Exploiting'
                          ? 'ready'
                          : peer.dynamicDecision === 'Exploring'
                          ? 'distributing'
                          : 'error'
                      }`}
                    >
                      {peer.dynamicDecision.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
