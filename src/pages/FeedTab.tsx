import React from 'react';
import { Users } from 'lucide-react';

const FeedTab = () => (
  <div className="flex flex-col h-full tab-bar-padding">
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center mb-5">
        <Users size={28} className="text-muted-foreground" />
      </div>
      <h2 className="font-wordmark text-4xl text-foreground mb-2">The Feed</h2>
      <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
        See how your friends are holding up. Social features are coming in the next update.
      </p>
      <div className="mt-8 px-4 py-2 rounded-full border border-border text-xs text-muted-foreground font-medium tracking-wider uppercase">
        Coming Soon
      </div>
    </div>
  </div>
);

export default FeedTab;
