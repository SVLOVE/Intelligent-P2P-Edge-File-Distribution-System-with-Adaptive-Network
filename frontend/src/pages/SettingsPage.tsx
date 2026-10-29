import React, { useState } from 'react';
import type { UserSettings, ScreenId } from '../types';
import { SettingsIcon, CheckCircleIcon, RefreshIcon } from '../components/icons/Icons';

interface SettingsPageProps {
  settings: UserSettings;
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onResetDemo: () => void;
  onNavigate: (screen: ScreenId) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  onResetDemo,
}) => {
  const [saveBanner, setSaveBanner] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveBanner(true);
    setTimeout(() => setSaveBanner(false), 2500);
  };

  return (
    <div className="page-container settings-page">
      {/* Simulation & Security Banner */}
      <div className="sim-notice-banner" role="region" aria-label="Simulation Notice">
        <div className="notice-icon">ℹ</div>
        <div className="notice-content">
          <strong>Local Preference Sandbox:</strong> No authentication tokens, private keys, or cloud
          secrets are saved or transmitted. All controls adjust local UI presentation and simulated
          client-side scheduler parameters.
        </div>
      </div>

      {saveBanner && (
        <div className="alert-banner-success" role="alert">
          <CheckCircleIcon size={18} />
          <span>Local presentation settings updated successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="settings-form">
        <div className="settings-grid">
          {/* Swarm & Transport Partitioning Settings */}
          <div className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Edge Chunk Transport Defaults</h2>
                <p className="panel-subtitle">Parameters governing file partitioning and WebRTC buffers</p>
              </div>
            </div>

            <div className="setting-field">
              <label htmlFor="default-chunk-select" className="setting-label">
                Default Chunk Boundary Size (C_default):
              </label>
              <select
                id="default-chunk-select"
                className="form-select"
                value={settings.defaultChunkSize}
                onChange={(e) =>
                  onUpdateSettings({ defaultChunkSize: Number(e.target.value) })
                }
              >
                <option value={524288}>512 KiB (High Jitter / Mobile Edge)</option>
                <option value={1048576}>1 MiB (Recommended Project Baseline)</option>
                <option value={2097152}>2 MiB (Campus / High-Speed LANs)</option>
                <option value={4194304}>4 MiB (Maximum Frame Window)</option>
              </select>
              <span className="setting-hint">
                Controls the slice granularity for newly staged catalog assets. 1 MiB is the approved baseline.
              </span>
            </div>

            <div className="setting-field">
              <label htmlFor="max-up-select" className="setting-label">
                Upload Bandwidth Cap (Seeding Egress):
              </label>
              <select
                id="max-up-select"
                className="form-select"
                value={settings.maxUploadRateBps}
                onChange={(e) =>
                  onUpdateSettings({ maxUploadRateBps: Number(e.target.value) })
                }
              >
                <option value={5242880}>5 MB/s (Conserve Bandwidth)</option>
                <option value={10485760}>10 MB/s (Moderate)</option>
                <option value={20971520}>20 MB/s (Standard Edge Seeder)</option>
                <option value={104857600}>100 MB/s (High-Performance LAN)</option>
              </select>
              <span className="setting-hint">
                Limits maximum aggregate WebRTC egress to avoid saturating local edge uplinks.
              </span>
            </div>

            <div className="setting-field">
              <label htmlFor="refresh-interval-select" className="setting-label">
                Telemetry Polling Cadence:
              </label>
              <select
                id="refresh-interval-select"
                className="form-select"
                value={settings.refreshIntervalSeconds}
                onChange={(e) =>
                  onUpdateSettings({ refreshIntervalSeconds: Number(e.target.value) })
                }
              >
                <option value={1}>1 Second (High Frequency)</option>
                <option value={3}>3 Seconds (Balanced - Default)</option>
                <option value={5}>5 Seconds (Low Overhead)</option>
              </select>
            </div>
          </div>

          {/* Presentation & UI Preferences */}
          <div className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Dashboard Presentation</h2>
                <p className="panel-subtitle">Visual ergonomics, themes and layout density</p>
              </div>
            </div>

            <div className="setting-field">
              <label htmlFor="theme-select" className="setting-label">Theme Contrast Mode:</label>
              <select
                id="theme-select"
                className="form-select"
                value={settings.theme}
                onChange={(e) =>
                  onUpdateSettings({ theme: e.target.value as 'dark' | 'contrast' })
                }
              >
                <option value="dark">Deep Charcoal / Navy (Developer Default)</option>
                <option value="contrast">High Contrast Dark (Accessible Focus)</option>
              </select>
              <span className="setting-hint">
                Calibrated against WCAG AAA standards for low-strain technical monitoring.
              </span>
            </div>

            <div className="setting-field checkbox-field">
              <input
                id="compact-view-check"
                type="checkbox"
                checked={settings.compactView}
                onChange={(e) =>
                  onUpdateSettings({ compactView: e.target.checked })
                }
                className="form-checkbox"
              />
              <div>
                <label htmlFor="compact-view-check" className="checkbox-title">
                  Compact Grid Spacing
                </label>
                <p className="checkbox-desc">
                  Reduces card margins and padding for dense multi-monitor edge control centers.
                </p>
              </div>
            </div>

            <div className="setting-field checkbox-field">
              <input
                id="telemetry-share-check"
                type="checkbox"
                checked={settings.enableTelemetrySharing}
                onChange={(e) =>
                  onUpdateSettings({ enableTelemetrySharing: e.target.checked })
                }
                className="form-checkbox"
              />
              <div>
                <label htmlFor="telemetry-share-check" className="checkbox-title">
                  Simulate Swarm Telemetry Gossip
                </label>
                <p className="checkbox-desc">
                  Broadcasts RTT and throughput EMA updates to neighboring swarm participants.
                </p>
              </div>
            </div>

            {/* Storage Quota Simulation Card */}
            <div className="quota-box">
              <div className="quota-header">
                <strong>Simulated Client Storage Quota:</strong>
                <span>14.8 GiB / 50.0 GiB (29.6%)</span>
              </div>
              <div className="quota-track">
                <div className="quota-fill" style={{ width: '29.6%' }} />
              </div>
              <span className="quota-sub">
                Uses browser OPFS (Origin Private File System) allocation model.
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="settings-actions-footer">
          <button type="submit" className="btn btn-primary">
            <SettingsIcon size={16} />
            <span>Apply Preferences</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onResetDemo}
            title="Reset all mock data, files, and transfers to initial baseline"
          >
            <RefreshIcon size={16} />
            <span>Reset Demo State to Initial Baseline</span>
          </button>
        </div>
      </form>
    </div>
  );
};
