import React, { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SplashScreen from '@/components/SplashScreen';
import BottomNav, { Tab } from '@/components/BottomNav';
import LogTab from '@/pages/LogTab';
import FeedTab from '@/pages/FeedTab';
import GanalyticsTab from '@/pages/GanalyticsTab';
import ProfileTab from '@/pages/ProfileTab';

const queryClient = new QueryClient();

const App = () => {
  const [splashDone, setSplashDone] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('log');

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Sonner />
      {!splashDone && <SplashScreen onComplete={() => setSplashDone(true)} />}
      {splashDone && (
        <div className="flex flex-col h-full animate-fade-in">
          <div className="flex-1 relative overflow-hidden">
            <div className={activeTab === 'log' ? 'block h-full' : 'hidden'}>
              <LogTab />
            </div>
            <div className={activeTab === 'feed' ? 'block h-full' : 'hidden'}>
              <FeedTab />
            </div>
            <div className={activeTab === 'ganalytics' ? 'block h-full' : 'hidden'}>
              <GanalyticsTab />
            </div>
            <div className={activeTab === 'profile' ? 'block h-full' : 'hidden'}>
              <ProfileTab />
            </div>
          </div>
          <BottomNav active={activeTab} onChange={setActiveTab} />
        </div>
      )}
    </QueryClientProvider>
  );
};

export default App;
