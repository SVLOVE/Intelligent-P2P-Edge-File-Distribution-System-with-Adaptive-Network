import React, { useState, useEffect, useCallback } from 'react';
import type {
  ScreenId,
  P2PFile,
  TransferSession,
  PeerNode,
  ActivityLogEntry,
  UserSettings,
  ConnectionState,
  HealthStatus,
} from './types';
import {
  MOCK_FILES,
  MOCK_TRANSFERS,
  MOCK_PEERS,
  MOCK_LOGS,
  DEFAULT_USER_SETTINGS,
} from './services/mockData';
import { checkBackendHealth, API_BASE_URL } from './services/api';
import { formatErrorMessage } from './utils';

// Layout & Navigation Components
import { AppLayout } from './components/AppLayout';

// Screen Pages
import { OverviewDashboard } from './pages/OverviewDashboard';
import { FileLibraryPage } from './pages/FileLibraryPage';
import { UploadFilePage } from './pages/UploadFilePage';
import { FileDetailsPage } from './pages/FileDetailsPage';
import { TransferMonitorPage } from './pages/TransferMonitorPage';
import { TransferDetailsPage } from './pages/TransferDetailsPage';
import { PeerNetworkPage } from './pages/PeerNetworkPage';
import { NetworkTopologyPage } from './pages/NetworkTopologyPage';
import { AdaptiveEnginePage } from './pages/AdaptiveEnginePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ActivityLogsPage } from './pages/ActivityLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpAboutPage } from './pages/HelpAboutPage';
import { ReadinessPage } from './pages/ReadinessPage';

export const App: React.FC = () => {
  // Screen routing state initialized from hash or 'overview'
  const getInitialScreen = (): ScreenId => {
    const hash = window.location.hash.replace('#/', '');
    const validScreens: ScreenId[] = [
      'overview',
      'files',
      'upload',
      'file-details',
      'transfers',
      'transfer-details',
      'peers',
      'topology',
      'adaptive-engine',
      'analytics',
      'activity-logs',
      'settings',
      'help',
      'readiness',
    ];
    return validScreens.includes(hash as ScreenId) ? (hash as ScreenId) : 'overview';
  };

  const [currentScreen, setCurrentScreen] = useState<ScreenId>(getInitialScreen);
  const [selectedFileId, setSelectedFileId] = useState<string>('f-101');
  const [selectedTransferId, setSelectedTransferId] = useState<string>('tx-201');

  // Shared state initialized from realistic Phase 2 datasets
  const [files, setFiles] = useState<P2PFile[]>(MOCK_FILES);
  const [transfers, setTransfers] = useState<TransferSession[]>(MOCK_TRANSFERS);
  const [peers] = useState<PeerNode[]>(MOCK_PEERS);
  const [logs, setLogs] = useState<ActivityLogEntry[]>(MOCK_LOGS);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  // Backend Health Integration (Phase 1 preservation)
  const [connectionState, setConnectionState] = useState<ConnectionState>('loading');
  const [healthData, setHealthData] = useState<HealthStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await checkBackendHealth();
      setHealthData(data);
      setErrorMessage(null);
      setConnectionState('connected');
    } catch (err) {
      setHealthData(null);
      setErrorMessage(formatErrorMessage(err));
      setConnectionState('disconnected');
    }
  }, []);

  const handleRefreshHealth = useCallback(() => {
    setConnectionState('loading');
    setErrorMessage(null);
    fetchHealth();
  }, [fetchHealth]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Sync hash routing with browser history
  useEffect(() => {
    const handleHashChange = () => {
      const screen = getInitialScreen();
      setCurrentScreen(screen);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (
    screen: ScreenId,
    params?: { fileId?: string; transferId?: string }
  ) => {
    if (params?.fileId) {
      setSelectedFileId(params.fileId);
    }
    if (params?.transferId) {
      setSelectedTransferId(params.transferId);
    }
    setCurrentScreen(screen);
    window.location.hash = `#/${screen}`;
  };

  const handleAddFile = (newFile: P2PFile) => {
    setFiles((prev) => [newFile, ...prev]);
    setSelectedFileId(newFile.id);

    // Append log event
    const newLog: ActivityLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'INFO',
      component: 'Storage',
      event: 'CATALOG_FILE_STAGED',
      fileId: newFile.id,
      details: `Staged "${newFile.name}" (${newFile.totalChunks} chunks of 1 MiB) in local edge catalog.`,
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  const handleInitiateTransfer = (file: P2PFile) => {
    const existing = transfers.find((t) => t.fileId === file.id);
    if (existing) {
      navigateTo('transfer-details', { transferId: existing.id });
      return;
    }

    const newTransfer: TransferSession = {
      id: `tx-${Date.now().toString().slice(-3)}`,
      fileId: file.id,
      fileName: file.name,
      fileSizeBytes: file.sizeBytes,
      status: 'active',
      mode: 'p2p_direct',
      progressPercent: 5.0,
      chunksCompleted: Math.max(1, Math.floor(file.totalChunks * 0.05)),
      totalChunks: file.totalChunks,
      downloadSpeedBps: 24117248, // ~23 MB/s
      uploadSpeedBps: 4194304,
      etaSeconds: Math.ceil(file.sizeBytes / 24117248),
      elapsedSeconds: 2,
      p2pRatio: 0.90,
      connectedPeers: 12,
      createdAt: new Date().toISOString(),
      isSimulated: true,
    };

    setTransfers((prev) => [newTransfer, ...prev]);
    navigateTo('transfer-details', { transferId: newTransfer.id });

    // Append log event
    const newLog: ActivityLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'INFO',
      component: 'Scheduler',
      event: 'TRANSFER_INITIATED',
      fileId: file.id,
      details: `Dispatched adaptive chunk scheduler for file "${file.name}". Probing 12 edge seeders.`,
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  const handleTogglePause = (transferId: string) => {
    setTransfers((prev) =>
      prev.map((t) => {
        if (t.id === transferId) {
          const nextStatus = t.status === 'active' ? 'paused' : 'active';
          return {
            ...t,
            status: nextStatus,
            downloadSpeedBps: nextStatus === 'active' ? 18454912 : 0,
          };
        }
        return t;
      })
    );
  };

  const handleResetDemo = () => {
    setFiles(MOCK_FILES);
    setTransfers(MOCK_TRANSFERS);
    setLogs(MOCK_LOGS);
    setSettings(DEFAULT_USER_SETTINGS);
    setSelectedFileId('f-101');
    setSelectedTransferId('tx-201');
    navigateTo('overview');
  };

  // Screen Title and Subtitle metadata
  const getScreenMeta = (
    screen: ScreenId
  ): { title: string; subtitle: string } => {
    switch (screen) {
      case 'overview':
        return {
          title: 'Overview Dashboard',
          subtitle: 'Real-time edge swarm metrics, transfer throughput, and node health',
        };
      case 'files':
        return {
          title: 'File Library',
          subtitle: 'Cryptographically verified distributed edge file catalog',
        };
      case 'upload':
        return {
          title: 'Upload File',
          subtitle: 'Client-side chunk boundary simulator and Merkle manifest constructor',
        };
      case 'file-details':
        return {
          title: 'File Details',
          subtitle: 'Chunk bitfield inspector, SHA-256 digests and swarm availability',
        };
      case 'transfers':
        return {
          title: 'Transfer Monitor',
          subtitle: 'Active P2P chunk streams, pipeline windows, and transfer states',
        };
      case 'transfer-details':
        return {
          title: 'Transfer Details',
          subtitle: 'Detailed session bitfield heatmap, contributing peers and provenance',
        };
      case 'peers':
        return {
          title: 'Peer Network',
          subtitle: 'Edge peer swarm registry, NAT classifications, RTT latency, and throughput',
        };
      case 'topology':
        return {
          title: 'Network Topology',
          subtitle: 'Interactive visual mesh graph of direct P2P data channels and TURN relays',
        };
      case 'adaptive-engine':
        return {
          title: 'Adaptive Scheduling Engine',
          subtitle: 'Multi-factor utility scoring formula, weight sliders, and ε-greedy strategy',
        };
      case 'analytics':
        return {
          title: 'Analytics & Telemetry',
          subtitle: 'Swarm offload curves, latency percentiles, and transmission integrity',
        };
      case 'activity-logs':
        return {
          title: 'Activity Logs',
          subtitle: 'Chronological audit trail of WebRTC transitions and scheduler signals',
        };
      case 'settings':
        return {
          title: 'Presentation & Transport Settings',
          subtitle: 'Local client UI preferences, chunk size defaults, and rate limits',
        };
      case 'help':
        return {
          title: 'Help and About',
          subtitle: 'System architecture specifications, research boundaries, and documentation',
        };
      case 'readiness':
        return {
          title: 'Phase 1: Environment Readiness',
          subtitle: 'Cross-tier connectivity validation between React frontend and FastAPI backend',
        };
      default:
        return {
          title: 'Overview Dashboard',
          subtitle: 'Real-time edge swarm metrics and node health',
        };
    }
  };

  const meta = getScreenMeta(currentScreen);

  return (
    <div className={`app-root ${settings.theme === 'contrast' ? 'theme-contrast' : ''} ${settings.compactView ? 'compact-layout' : ''}`}>
      {/* Accessible Project Title Heading for screen-readers and regression tests */}
      <h1 className="visually-hidden">
        Intelligent P2P Edge File Distribution System with Adaptive Network
      </h1>

      <AppLayout
        currentScreen={currentScreen}
        screenTitle={meta.title}
        screenSubtitle={meta.subtitle}
        connectionState={connectionState}
        healthData={healthData}
        onNavigate={navigateTo}
        onRefreshHealth={handleRefreshHealth}
      >
        {currentScreen === 'overview' && (
          <OverviewDashboard
            files={files}
            transfers={transfers}
            peers={peers}
            logs={logs}
            connectionState={connectionState}
            healthData={healthData}
            errorMessage={errorMessage}
            apiUrl={API_BASE_URL}
            onRefreshHealth={handleRefreshHealth}
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'files' && (
          <FileLibraryPage
            files={files}
            onNavigate={navigateTo}
            onInitiateTransfer={handleInitiateTransfer}
          />
        )}

        {currentScreen === 'upload' && (
          <UploadFilePage
            onAddFile={handleAddFile}
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'file-details' && (
          <FileDetailsPage
            files={files}
            selectedFileId={selectedFileId}
            onSelectFileId={setSelectedFileId}
            onNavigate={navigateTo}
            onInitiateTransfer={handleInitiateTransfer}
          />
        )}

        {currentScreen === 'transfers' && (
          <TransferMonitorPage
            transfers={transfers}
            onTogglePause={handleTogglePause}
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'transfer-details' && (
          <TransferDetailsPage
            transfers={transfers}
            peers={peers}
            selectedTransferId={selectedTransferId}
            onSelectTransferId={setSelectedTransferId}
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'peers' && (
          <PeerNetworkPage
            peers={peers}
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'topology' && (
          <NetworkTopologyPage
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'adaptive-engine' && (
          <AdaptiveEnginePage
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'analytics' && (
          <AnalyticsPage
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'activity-logs' && (
          <ActivityLogsPage
            logs={logs}
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'settings' && (
          <SettingsPage
            settings={settings}
            onUpdateSettings={(newVals) =>
              setSettings((prev) => ({ ...prev, ...newVals }))
            }
            onResetDemo={handleResetDemo}
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'help' && (
          <HelpAboutPage
            onNavigate={navigateTo}
          />
        )}

        {currentScreen === 'readiness' && (
          <ReadinessPage
            connectionState={connectionState}
            healthData={healthData}
            errorMessage={errorMessage}
            apiUrl={API_BASE_URL}
            onRefresh={handleRefreshHealth}
          />
        )}
      </AppLayout>
    </div>
  );
};

export default App;
