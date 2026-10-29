import React, { useState } from 'react';
import type { ConnectionState, HealthStatus, ScreenId } from '../types';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface AppLayoutProps {
  currentScreen: ScreenId;
  screenTitle: string;
  screenSubtitle?: string;
  connectionState: ConnectionState;
  healthData: HealthStatus | null;
  onNavigate: (screen: ScreenId) => void;
  onRefreshHealth: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentScreen,
  screenTitle,
  screenSubtitle,
  connectionState,
  healthData,
  onNavigate,
  onRefreshHealth,
  children,
}) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="dashboard-shell">
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Primary Sidebar */}
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={onNavigate}
        isOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="dashboard-main-wrapper">
        <Header
          currentScreen={currentScreen}
          screenTitle={screenTitle}
          screenSubtitle={screenSubtitle}
          connectionState={connectionState}
          healthData={healthData}
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onRefreshHealth={onRefreshHealth}
          onNavigate={onNavigate}
        />

        <main className="dashboard-content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};
