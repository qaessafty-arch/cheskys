import React, { Suspense } from 'react';
import { DemoProvider } from './context/DemoContext';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { GameView } from './components/GameView';
import { ReplayView } from './components/ReplayView';
import { LeaderboardView } from './components/LeaderboardView';
import { TournamentsView } from './components/TournamentsView';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { FeaturesShowcase } from './components/FeaturesShowcase';
import { MatchmakingModal } from './components/MatchmakingModal';
import { useDemo } from './context/DemoContext';

const LoadingFallback: React.FC = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--app-bg)] z-50" style={{background: '#080B12'}}>
      <div className="text-center" style={{color: '#F8FAFC'}}>
        <div className="w-16 h-16 border-4 border-[var(--glass-border)] border-t-[var(--primary-accent)] rounded-full mx-auto mb-4 animate-spin" style={{borderColor: '#94A3B8 #94A3B8 #94A3B8 #F5B83D'}} />
        <p style={{color: '#94A3B8'}}>Loading Chesskys Demo...</p>
      </div>
    </div>
  );
};

// A real error boundary: if one screen throws, show a recovery panel instead of a blank page
class ErrorBoundary extends React.Component<{ children: React.ReactNode; onRecover?: () => void }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--app-bg)] z-50 p-6" style={{ background: '#080B12', color: '#F8FAFC' }}>
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-black mb-3">Something went wrong on this screen</h1>
          <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>The rest of the demo is fine. Go back to the dashboard, or reload the page.</p>
          <div className="flex gap-3 justify-center">
            {this.props.onRecover && (
              <button className="btn-primary" onClick={() => { this.setState({ error: null }); this.props.onRecover?.(); }}>Back to dashboard</button>
            )}
            <button className="btn-secondary" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    );
  }
}

// Each view gets its own boundary (keyed by view), so a crash on one screen never blocks the others
const RoutedViews: React.FC = () => {
  const { viewMode, setViewMode } = useDemo();
  return (
    <ErrorBoundary key={viewMode} onRecover={() => setViewMode('dashboard')}>
      <ViewRouter />
    </ErrorBoundary>
  );
};

const ViewRouter: React.FC = () => {
  const { viewMode, matchmakingState } = useDemo();

  const renderView = () => {
    switch (viewMode) {
      case 'landing':
        return <LandingPage />;
      case 'dashboard':
        return <Dashboard />;
      case 'game':
        return <GameView />;
      case 'replay':
        return <ReplayView />;
      case 'leaderboard':
        return <LeaderboardView />;
      case 'tournaments':
        return <TournamentsView />;
      case 'profile':
        return <ProfileView />;
      case 'settings':
        return <SettingsView />;
      case 'features':
        return <FeaturesShowcase />;
      default:
        return <LandingPage />;
    }
  };

  return (
    <>
      {renderView()}
      <MatchmakingModal isOpen={matchmakingState !== 'idle'} onClose={() => {}} onStart={() => {}} />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <DemoProvider>
        <div className="min-h-screen bg-[var(--app-bg)]" style={{background: '#080B12'}}>
          <Header />
          <Suspense fallback={<LoadingFallback />}>
            <RoutedViews />
          </Suspense>
        </div>
      </DemoProvider>
    </ErrorBoundary>
  );
};

export default App;