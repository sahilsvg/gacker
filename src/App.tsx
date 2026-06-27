import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
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
  const [authStep, setAuthStep] = useState<AuthStep>('phone');
  const [pendingPhone, setPendingPhone] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);

  if (!splashDone) return <SplashScreen onComplete={() => setSplashDone(true)} />;
  if (loading) return null;

  // Not logged in → show auth flow
  if (!user) {
    if (authStep === 'phone') {
      return (
        <PhoneEntry
          onCodeSent={phone => { setPendingPhone(phone); setAuthStep('otp'); }}
        />
      );
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

  // Logged in but no profile yet
  if (user && !profile && authStep !== 'welcome') {
    return <ProfileSetup onComplete={() => setShowWelcome(true)} />;
  }

  // Welcome back screen
  if (showWelcome) {
    return <WelcomeBack onDone={() => setShowWelcome(false)} />;
  }

  // Main app
  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex-1 relative overflow-hidden">
        <div className={activeTab === 'log' ? 'block h-full' : 'hidden'}><LogTab /></div>
        <div className={activeTab === 'feed' ? 'block h-full' : 'hidden'}><FeedTab /></div>
        <div className={activeTab === 'ganalytics' ? 'block h-full' : 'hidden'}><GanalyticsTab /></div>
        <div className={activeTab === 'profile' ? 'block h-full' : 'hidden'}><ProfileTab /></div>
      </div>
      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <Toaster />
      <Sonner />
      <AppShell />
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
