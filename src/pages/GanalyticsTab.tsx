import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Target, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEntries, computeStats, Entry } from '@/lib/entries';
import { supabase } from '@/integrations/supabase/client';
import { haptic } from '@/lib/haptics';
import { useTap } from '@/hooks/useTap';
import { Goal, getActiveGoal, setGoal, completeGoal, minGoalTarget } from '@/lib/goals';

// ─── Goal Picker Sheet ───────────────────────────────────────────────────────

const DAYS = Array.from({ length: 200 }, (_, i) => i + 1);
const ITEM_H = 52; // px per row

const GoalPicker = ({ current, min, onSave, onClose }: {
  current: number | null;
  /** Lowest selectable target — always above the current streak. */
  min: number;
  onSave: (days: number) => void;
  onClose: () => void;
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  // Anything at or below the streak is already achieved, so it is not offered.
  const days = DAYS.filter(d => d >= min);
  const [selected, setSelected] = useState(Math.max(current ?? 30, min));
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => { setIsClosing(true); setTimeout(onClose, 210); };

  // Swipe-aware: a scroll gesture that happens to end over the button must not
  // save. Saving posts a goal_set to every follower, so an accidental fire is
  // not recoverable.
  const saveTap = useTap(() => { haptic.medium(); onSave(selected); handleClose(); });

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    setSelected(days[Math.min(idx, days.length - 1)]);
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const idx = days.indexOf(selected);
    el.scrollTop = idx * ITEM_H;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sheet = (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onPointerDown={handleClose} />
      <div
        className={`relative w-full bg-card rounded-t-3xl px-6 pt-5 pb-10 flex flex-col items-center gap-6 ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="w-10 h-1 rounded-full bg-border" />
        <div className="flex items-center justify-between w-full">
          <h3 className="font-semibold text-foreground text-lg">Set your goal</h3>
          <button onPointerDown={e => { e.preventDefault(); handleClose(); }} className="text-muted-foreground p-2 -mr-2">
            <X size={18} />
          </button>
        </div>
        <p className="text-muted-foreground text-sm -mt-3 w-full">How many days in a row are you aiming for?</p>
        <div className="relative w-full" style={{ height: ITEM_H * 5 }}>
          <div
            className="absolute left-0 right-0 rounded-2xl bg-clean/10 border border-clean/20 pointer-events-none z-10"
            style={{ top: ITEM_H * 2, height: ITEM_H }}
          />
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-card to-transparent pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent pointer-events-none z-10" />
          <div
            ref={listRef}
            onScroll={onScroll}
            className="h-full overflow-y-scroll"
            style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
          >
            <div style={{ height: ITEM_H * 2 }} />
            {days.map(d => (
              <div key={d} style={{ height: ITEM_H, scrollSnapAlign: 'center' }} className="flex items-center justify-center">
                <span className={`font-mono-stats text-2xl transition-all duration-150 ${
                  d === selected ? 'text-clean font-semibold scale-110' : 'text-muted-foreground/50 scale-95'
                }`}>
                  {d} {d === 1 ? 'day' : 'days'}
                </span>
              </div>
            ))}
            <div style={{ height: ITEM_H * 2 }} />
          </div>
        </div>
        <button
          {...saveTap.props}
          className="w-full h-14 rounded-2xl bg-clean text-clean-foreground font-semibold text-base active:scale-95 transition-all"
        >
          Set Goal — {selected} {selected === 1 ? 'day' : 'days'}
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(sheet, document.body);
};

// ─── Sisyphus Animation ───────────────────────────────────────────────────────

const SisyphusAnimation = ({ progress, animKey }: { progress: number; animKey: number }) => {
  const p = Math.min(Math.max(progress, 0), 1);

  // Slope geometry
  const SX = 24, SY = 148;
  const EX = 188, EY = 22;
  const ddx = EX - SX;
  const ddy = EY - SY;
  const deg = Math.atan2(ddy, ddx) * 180 / Math.PI;

  const tx = SX + ddx * p;
  const ty = SY + ddy * p;

  const id = `sy${animKey}`;
  const moveDurSec = Math.max(1.8, 1.8 + p * 2.2);
  const moveDur = `${moveDurSec}s`;
  const fromT = `translate(${SX}px,${SY}px) rotate(${deg}deg)`;
  const toT   = `translate(${tx}px,${ty}px) rotate(${deg}deg)`;

  // Resting only at very start (hasn't begun); walking the rest of the way including at goal
  const isResting = p < 0.03;

  // Figure in local space: y=0 = slope surface, body upward (-y).
  // Hip at (0,−22). Boulder at (bx,by) with r=br touching ground: by = −br.
  // Torso bends forward at hip so arms can reach the low boulder.
  // Declared before fallRotTo below, which interpolates `by` — keep it that way:
  // `const a = f(b), b = 1` puts b in the temporal dead zone and throws at render.
  const bx = 30, by = -14, br = 14; // by=−br so bottom of boulder = y=0

  // Right slope geometry — boulder rolls down once after cresting the peak
  const RX = 292, RY = 152;
  const fallDeg = Math.atan2(RY - EY, RX - EX) * 180 / Math.PI;
  const fallDurSec = 1.6;
  const showFall = p > 0.97;
  // Rotations for the fall: distance ÷ circumference × 360°
  // dist ≈ √(104²+130²) ≈ 166.5; circ = 2π×14 ≈ 88 → ~683°
  const fallRotTo = `683 0 ${by}`;

  const wd = '0.52s', wr = 'indefinite', ks = '0.42 0 0.58 1;0.42 0 0.58 1';

  // Shared leg paths, rotating around hip (0,−22)
  const Leg = ({
    front, staticRot,
  }: { front?: boolean; staticRot?: number }) => {
    const sw1 = front ? 6 : 5.5, sw2 = front ? 4.8 : 4.2, sw3 = front ? 3.2 : 2.8;
    const inner = (
      <>
        <path d="M 0,-22 C 1,-17 2,-12 2,-8" fill="none" stroke="white" strokeWidth={sw1} strokeLinecap="round"/>
        <circle cx="2" cy="-8" r="2.2" fill="none" stroke="white" strokeWidth="1.4"/>
        <path d="M 2,-8 C 3,-4 3,-1 3,0" fill="none" stroke="white" strokeWidth={sw2} strokeLinecap="round"/>
        <path d="M 3,0 L 8,0" fill="none" stroke="white" strokeWidth={sw3} strokeLinecap="round"/>
      </>
    );
    if (staticRot !== undefined) return <g transform={`rotate(${staticRot} 0 -22)`}>{inner}</g>;
    return (
      <g>
        <animateTransform attributeName="transform" type="rotate"
          values={front ? `-12 0 -22; 16 0 -22; -12 0 -22` : `16 0 -22; -12 0 -22; 16 0 -22`}
          keyTimes="0;0.5;1" dur={wd} repeatCount={wr}
          calcMode="spline" keySplines={ks}/>
        {inner}
      </g>
    );
  };

  // Body parts: torso bent forward at hip, arms angling down to boulder level
  const BodyParts = ({ animate }: { animate: boolean }) => {
    const inner = (
      <>
        {/* HEAD — tilted forward with the lean */}
        <circle cx="10" cy="-36" r="5" fill="white" fillOpacity="0.07" stroke="white" strokeWidth="2"/>
        <path d="M 7,-38 Q 10,-40 14,-38" fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.5"/>
        <path d="M 7,-32 Q 9,-30 13,-31"  fill="none" stroke="white" strokeWidth="0.9" strokeOpacity="0.35"/>
        {/* NECK */}
        <path d="M 9,-31 Q 7,-29 5,-27" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round"/>
        {/* TORSO — bent forward at hip: shoulders end up at (5,−29) */}
        <path d="M -1,-22 C -3,-25 0,-27 5,-29 L 8,-28 C 6,-26 4,-24 2,-22 Z"
          fill="white" fillOpacity="0.06" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M 0,-25 Q 3,-23 5,-25" fill="none" stroke="white" strokeWidth="1.1" strokeOpacity="0.42"/>
        {/* TRAPS */}
        <path d="M 5,-29 Q 9,-31 11,-30" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
        {/* GLUTES — hip hinge shows glutes popping back */}
        <path d="M -1,-22 C -6,-20 -5,-15 -2,-14 C 1,-14 3,-18 2,-22"
          fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
        {/* FAR ARM (behind body, angling down to boulder) */}
        <path d="M 3,-27 Q 9,-23 14,-18"  fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeOpacity="0.58"/>
        <path d="M 14,-18 Q 17,-16 19,-15" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeOpacity="0.58"/>
        {/* NEAR ARM (full opacity, bicep flex) */}
        <path d="M 6,-28 Q 12,-23 16,-17"  fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"/>
        <path d="M 10,-27 Q 13,-23 16,-17" fill="none" stroke="white" strokeWidth="1.1" strokeOpacity="0.32"/>
        <path d="M 16,-17 Q 18,-15 20,-14" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round"/>
      </>
    );
    if (!animate) return <g>{inner}</g>;
    return (
      <g>
        <animateTransform attributeName="transform" type="translate"
          values="0,0;0,-1.5;0,0"
          keyTimes="0;0.5;1" dur={wd} repeatCount={wr}
          calcMode="spline" keySplines={ks}/>
        {inner}
      </g>
    );
  };

  const walkDur = wd;
  const walkRepeat = wr;

  return (
    <svg viewBox="0 0 300 168" style={{ display: 'block', width: '100%', height: 'auto' }}>
      <style>{`
        #${id}-grp {
          transform: ${fromT};
          animation: ${id}-move ${moveDur} cubic-bezier(0.3,0.0,0.7,1.0) forwards;
        }
        @keyframes ${id}-move {
          from { transform: ${fromT}; }
          to   { transform: ${toT}; }
        }
        ${showFall ? `
        /* Main boulder fades out as it crests */
        #${id}-bld { animation: ${id}-bld-hide ${moveDur} linear forwards; }
        @keyframes ${id}-bld-hide { 0%,98%{opacity:1} 100%{opacity:0} }
        /* Fall boulder: waits for man to reach peak, then rolls down once */
        #${id}-fall {
          opacity: 0;
          animation: ${id}-fall-anim ${fallDurSec}s ease-in 1 forwards;
          animation-delay: ${moveDurSec}s;
        }
        @keyframes ${id}-fall-anim {
          from { transform: translate(${EX}px,${EY}px) rotate(${fallDeg}deg); opacity:1; }
          to   { transform: translate(${RX}px,${RY}px) rotate(${fallDeg}deg); opacity:1; }
        }` : ''}
      `}</style>

      {/* Ground */}
      <line x1="0" y1="152" x2="300" y2="152" stroke="white" strokeOpacity="0.08" strokeWidth="1"/>
      {/* Mountain */}
      <path d="M 16 152 L 190 20 L 295 152 Z" fill="white" fillOpacity="0.04"/>
      <line x1={SX} y1={SY} x2={EX} y2={EY} stroke="white" strokeOpacity="0.18" strokeWidth="1.5"/>
      <line x1={EX} y1={EY} x2="292" y2="152" stroke="white" strokeOpacity="0.1" strokeWidth="1"/>
      <circle cx={EX} cy={EY} r="2.5" fill="white" fillOpacity="0.28"/>
      {/* Rocks */}
      <ellipse cx="65"  cy="114" rx="3"   ry="1.5" fill="white" fillOpacity="0.10"/>
      <ellipse cx="102" cy="88"  rx="2.5" ry="1.2" fill="white" fillOpacity="0.08"/>
      <ellipse cx="140" cy="62"  rx="3"   ry="1.4" fill="white" fillOpacity="0.09"/>

      {/* ── Main group slides along slope ── */}
      <g id={`${id}-grp`}>

        {/* BOULDER – rolls CCW as it climbs; fades out at peak when goal complete */}
        <g id={showFall ? `${id}-bld` : undefined}>
          <animateTransform attributeName="transform" type="rotate"
            from={`0 ${bx} ${by}`} to={`-360 ${bx} ${by}`}
            dur="1.4s" repeatCount={wr}/>
          <circle cx={bx} cy={by} r={br} fill="white" fillOpacity="0.07" stroke="white" strokeWidth="2.4"/>
          <path d={`M ${bx-7},${by-11} Q ${bx},${by-3} ${bx+5},${by+9}`}
            fill="none" stroke="white" strokeWidth="1.1" strokeOpacity="0.38" strokeLinecap="round"/>
          <path d={`M ${bx-13},${by+1} Q ${bx-5},${by+5} ${bx-8},${by+11}`}
            fill="none" stroke="white" strokeWidth="0.9" strokeOpacity="0.28" strokeLinecap="round"/>
          <path d={`M ${bx+1},${by-13} Q ${bx+11},${by-7} ${bx+11},${by+3}`}
            fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.22" strokeLinecap="round"/>
        </g>

        {/* BACK LEG — behind body */}
        <Leg staticRot={isResting ? 14 : undefined}/>

        {/* BODY — head, torso, arms */}
        <BodyParts animate={!isResting}/>

        {/* FRONT LEG — in front of body */}
        <Leg front staticRot={isResting ? -10 : undefined}/>

      </g>

      {/* ── Fall boulder: same rock, picks up at peak, rolls down right slope once ── */}
      {showFall && (
        <g id={`${id}-fall`}>
          {/* CW spin matches rolling downhill; begin fires after moveDur; freeze holds final pos */}
          <animateTransform attributeName="transform" type="rotate"
            begin={`${moveDurSec}s`}
            from={`0 0 ${by}`} to={fallRotTo}
            dur={`${fallDurSec}s`} fill="freeze" repeatCount="1"/>
          <circle cx="0" cy={by} r={br} fill="white" fillOpacity="0.07" stroke="white" strokeWidth="2.4"/>
          <path d={`M -7,${by-11} Q 0,${by-3} 5,${by+9}`}
            fill="none" stroke="white" strokeWidth="1.1" strokeOpacity="0.38" strokeLinecap="round"/>
          <path d={`M -13,${by+1} Q -5,${by+5} -8,${by+11}`}
            fill="none" stroke="white" strokeWidth="0.9" strokeOpacity="0.28" strokeLinecap="round"/>
          <path d={`M 1,${by-13} Q 11,${by-7} 11,${by+3}`}
            fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.22" strokeLinecap="round"/>
        </g>
      )}
    </svg>
  );
};

// ─── Main Tab ────────────────────────────────────────────────────────────────

const GanalyticsTab = ({ resetKey: _, isActive }: { resetKey: number; isActive?: boolean }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [loading, setLoading] = useState(true);
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  // Target of a goal closed out on load, so we can congratulate rather than
  // just showing an empty goal slot.
  const [justCompleted, setJustCompleted] = useState<number | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Increment animKey each time tab becomes active → forces animation replay
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => {
    if (isActive) setAnimKey(k => k + 1);
  }, [isActive]);

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchEntries(user.id), getActiveGoal(user.id)]).then(async ([data, g]) => {
      setEntries(data);
      const { streak: s0 } = computeStats(data);
      // A goal the streak has already passed closes out silently: it may have
      // been met while away, or carried over from before goals had a
      // lifecycle. Dating it now, or announcing it to followers, would be a lie.
      if (g && s0 >= g.target_days) {
        await completeGoal(g, { silent: true });
        setActiveGoal(null);
        setJustCompleted(g.target_days);
      } else {
        setActiveGoal(g);
      }
      setLoading(false);
    });
  }, [user]);

  const { streak, cleanDays, redDays } = computeStats(entries);
  const total = cleanDays + redDays;
  const fireRate = total > 0 ? Math.round((redDays / total) * 100) : 0;

  const handleSaveGoal = async (days: number) => {
    if (!user) return;
    const err = await setGoal(user.id, days, streak);
    if (err) { setGoalError(err); return; }
    setGoalError(null);
    setJustCompleted(null);
    setActiveGoal(await getActiveGoal(user.id));
  };

  // Goal is based on streak (consecutive clean days), not total clean days
  const goal = activeGoal?.target_days ?? null;
  const goalProgress = goal && streak > 0 ? Math.min(streak / goal, 1) : 0;
  const daysLeft = goal ? Math.max(goal - streak, 0) : null;

  return (
    <>
      <div className="flex flex-col h-full tab-bar-padding">
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-6">

          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="font-wordmark text-5xl text-foreground mb-1">Ganalytics</h1>
              <p className="text-muted-foreground text-sm font-medium">Your performance, laid bare.</p>
            </div>
            <button
              onPointerDown={e => { e.preventDefault(); haptic.light(); setShowPicker(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-sm font-medium text-foreground active:opacity-60 transition-opacity flex-shrink-0"
            >
              <Target size={14} className="text-clean" />
              {goal ? `${goal}d goal` : 'Set goal'}
            </button>
          </div>

          {/* Goal progress card */}
          {goal && (
            <div className="bg-card border border-border rounded-2xl p-5 mb-6">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">Goal Progress</span>
                <span className="text-xs text-muted-foreground">
                  {loading ? '—' : streak} / {goal} days
                  {daysLeft !== null && daysLeft > 0 && (
                    <span className="text-muted-foreground/60"> · {daysLeft} to go</span>
                  )}
                </span>
              </div>

              {/* Sisyphus animation */}
              <div className="mb-3 -mx-1">
                <SisyphusAnimation progress={goalProgress} animKey={animKey} />
              </div>

              {/* Progress bar */}
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-clean rounded-full transition-all duration-700"
                  style={{ width: `${goalProgress * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* No active goal — either never set one, or just finished one.
              A goal is always something still ahead, so this is the only place
              "complete" is shown: once, as a prompt to pick the next one. */}
          {!loading && !goal && (
            <div className="bg-card border border-border rounded-2xl p-5 mb-6 text-center">
              {justCompleted !== null ? (
                <>
                  <p className="text-clean font-semibold text-sm mb-1">
                    {justCompleted} day goal complete
                  </p>
                  <p className="text-muted-foreground text-xs mb-4">
                    You're on {streak} days. Pick your next one.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-foreground font-semibold text-sm mb-1">No goal set</p>
                  <p className="text-muted-foreground text-xs mb-4">
                    Set a streak to aim for and track it here.
                  </p>
                </>
              )}
              <button
                onPointerDown={e => { e.preventDefault(); haptic.light(); setShowPicker(true); }}
                className="px-5 h-11 rounded-xl bg-clean text-clean-foreground font-semibold text-sm active:scale-95 transition-all"
              >
                {justCompleted !== null ? 'Set next goal' : 'Set a goal'}
              </button>
            </div>
          )}

          {goalError && (
            <p className="text-red text-xs text-center mb-4">{goalError}</p>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { value: streak, label: 'Day Streak', color: 'text-clean' },
              { value: cleanDays, label: 'Clean Days', color: 'text-clean' },
              { value: redDays, label: 'Red Days', color: 'text-red' },
              { value: `${fireRate}%`, label: 'Fire Rate', color: 'text-foreground' },
            ].map(({ value, label, color }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-5">
                <div className={`font-mono-stats text-3xl font-medium mb-1 ${color}`}>
                  {loading ? '—' : value}
                </div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>

          {/* Clean vs Red bar */}
          {total > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex justify-between text-xs text-muted-foreground font-medium mb-3">
                <span>Clean vs Red</span>
                <span>{cleanDays} / {total} days</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-clean rounded-full transition-all duration-700"
                  style={{ width: `${(cleanDays / total) * 100}%` }}
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {showPicker && (
        <GoalPicker
          current={goal}
          min={minGoalTarget(streak)}
          onSave={handleSaveGoal}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
};

export default GanalyticsTab;
