import React, { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import MiniPlayer from '@/components/MiniPlayer';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import SplashScreen from '@/components/SplashScreen';
import BottomNav, { Tab } from '@/components/BottomNav';
import PhoneEntry from '@/pages/auth/PhoneEntry';
import OTPVerify from '@/pages/auth/OTPVerify';
import ProfileSetup from '@/pages/auth/ProfileSetup';
import WelcomeBack from '@/pages/auth/WelcomeBack';
import LogTab from '@/pages/LogTab';
import FeedTab from '@/pages/FeedTab';
import GanalyticsTab from '@/pages/GanalyticsTab';
import ProfileTab from '@/pages/ProfileTab';

const queryClient = new QueryClient();

type AuthStep = 'phone' | 'otp' | 'setup' | 'welcome';

const AppShell = () => {
  const { user, profile, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('log');
  const [resetKeys, setResetKeys] = useState<Record<Tab, number>>({ log: 0, feed: 0, ganalytics: 0, profile: 0 });
  const [authStep, setAuthStep] = useState<AuthStep>('phone');
  const [pendingPhone, setPendingPhone] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const prevUser = useRef(user);

  // Hide iOS keyboard accessory bar (up/down/done toolbar)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      Keyboard.setAccessoryBarVisible({ isVisible: false });
    }
  }, []);

  // Reset auth flow to phone entry whenever user signs out
  useEffect(() => {
    if (prevUser.current && !user) {
      setAuthStep('phone');
      setPendingPhone('');
      setShowWelcome(false);
    }
    prevUser.current = user;
  }, [user]);

  const handleTabChange = (tab: Tab) => {
    if (tab === activeTab) {
      // Tap the active tab → reset it to root
      setResetKeys(prev => ({ ...prev, [tab]: prev[tab] + 1 }));
    } else {
      setActiveTab(tab);
    }
  };

  if (!splashDone) return <SplashScreen onComplete={() => setSplashDone(true)} />;
  if (loading) return null;

  if (!user) {
    if (authStep === 'phone') {
      return <PhoneEntry onCodeSent={phone => { setPendingPhone(phone); setAuthStep('otp'); }} />;
    }
    if (authStep === 'otp') {
      return (
        <OTPVerify
          phone={pendingPhone}
          onBack={() => setAuthStep('phone')}
          onVerified={isNewUser => {
            if (isNewUser) setAuthStep('setup');
            else setShowWelcome(true);
          }}
        />
      );
    }
  }

  if (user && !profile && authStep === 'setup') {
    return <ProfileSetup onComplete={() => setShowWelcome(true)} />;
  }

  if (showWelcome) {
    return <WelcomeBack onDone={() => setShowWelcome(false)} />;
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 relative overflow-hidden">
        <div key={`log-${resetKeys.log}`} className={activeTab === 'log' ? 'block h-full animate-tab-enter' : 'hidden'}>
          <LogTab resetKey={resetKeys.log} isActive={activeTab === 'log'} />
        </div>
        <div key={`feed-${resetKeys.feed}`} className={activeTab === 'feed' ? 'block h-full animate-tab-enter' : 'hidden'}>
          <FeedTab isActive={activeTab === 'feed'} resetKey={resetKeys.feed} />
        </div>
        <div key={`ganalytics-${resetKeys.ganalytics}`} className={activeTab === 'ganalytics' ? 'block h-full animate-tab-enter' : 'hidden'}>
          <GanalyticsTab resetKey={resetKeys.ganalytics} />
        </div>
        <div key={`profile-${resetKeys.profile}`} className={activeTab === 'profile' ? 'block h-full animate-tab-enter' : 'hidden'}>
          <ProfileTab isActive={activeTab === 'profile'} resetKey={resetKeys.profile} />
        </div>
      </div>
      <MiniPlayer />
      <BottomNav active={activeTab} onChange={handleTabChange} />
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PlayerProvider>
        <Toaster />
        <Sonner />
        <AppShell />
      </PlayerProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
