import React from 'react';

interface Props {
  /** 1-based signup order, or null/undefined if outside the first 20. */
  rank: number | null | undefined;
}

// Small numbered circle for one of the app's first 20 accounts, meant to sit
// inline right after a name. Rank 1 additionally gets the "Chief Gacker"
// title -- see ChiefGackerLabel below, rendered as its own line since it
// doesn't fit inline next to the name the way the circle does.
export const FounderBadge = ({ rank }: Props) => {
  if (!rank) return null;
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-border bg-card text-[10px] font-mono-stats font-semibold text-foreground flex-shrink-0">
      {rank}
    </span>
  );
};

export const ChiefGackerLabel = ({ rank }: Props) => {
  if (rank !== 1) return null;
  return (
    <p className="text-[10px] font-semibold text-amber-400 tracking-wider mt-0.5">
      CHIEF GACKER
    </p>
  );
};
