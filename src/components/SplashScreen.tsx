import React, { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: Props) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 2200);
    const doneTimer = setTimeout(() => onComplete(), 2700);
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
      style={{ zIndex: 9999 }}
    >
      <h1 className="font-wordmark text-7xl text-foreground animate-reveal-lr">
        The Gacker
      </h1>
      <p className="mt-4 text-muted-foreground text-sm tracking-widest uppercase font-medium opacity-0 animate-fade-in" style={{ animationDelay: '1.4s', animationFillMode: 'forwards' }}>
        Stay clean.
      </p>
    </div>
  );
};

export default SplashScreen;
