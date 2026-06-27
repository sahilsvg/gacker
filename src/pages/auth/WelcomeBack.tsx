import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  onDone: () => void;
}

const WelcomeBack = ({ onDone }: Props) => {
  const { profile } = useAuth();

  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="flex flex-col h-full items-center justify-center px-8">
      <div className="text-center animate-fade-in">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Avatar"
            className="w-20 h-20 rounded-full object-cover mx-auto mb-5 border-2 border-clean/40"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-card border border-border flex items-center justify-center mx-auto mb-5">
            <span className="font-wordmark text-3xl text-foreground">{profile?.name?.[0]?.toUpperCase() ?? '?'}</span>
          </div>
        )}
        <h2 className="text-2xl font-semibold text-foreground mb-1">
          Welcome back, {profile?.name?.split(' ')[0] ?? 'friend'}.
        </h2>
        <p className="text-muted-foreground text-sm">Stay clean.</p>
      </div>
    </div>
  );
};

export default WelcomeBack;
