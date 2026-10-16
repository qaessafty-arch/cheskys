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
import { CreateRoomModal } from './components/CreateRoomModal';
import { JoinRoomModal } from './components/JoinRoomModal';
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

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [error] = React.useState<Error | null>(null);

  if (error) {
    console.error('ErrorBoundary caught:', error);
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--app-bg)] z-50" style={{background: '#080B12', color: '#F8FAFC'}}>
        <div className="p-8 text-center">
          <h1 style={{color: '#FB7185'}}>Error</h1>
          <pre style={{textAlign: 'left', background: '#10151F', padding: '16px', borderRadius: '8px', color: '#FB7185'}}>{error.message}</pre>
          <pre style={{textAlign: 'left', background: '#10151F', padding: '16px', borderRadius: '8px', color: '#94A3B8', fontSize: '12px'}}>{error.stack}</pre>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const ViewRouter: React.FC = () => {
  const { viewMode, matchmakingState, createdRoomCode } = useDemo();

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
      <CreateRoomModal isOpen={!!createdRoomCode} onClose={() => {}} onCreate={() => {}} />
      <JoinRoomModal isOpen={false} onClose={() => {}} onJoin={() => {}} />
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
            <ViewRouter />
          </Suspense>
        </div>
      </DemoProvider>
    </ErrorBoundary>
  );
};

export default App;