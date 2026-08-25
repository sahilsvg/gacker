import { dismissOnEnter, dismissKeyboard } from '@/hooks/useKeyboardDismiss';
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';

interface Props {
  phone: string;
  onVerified: (isNewUser: boolean) => void;
  onBack: () => void;
}

const OTPVerify = ({ phone, onVerified, onBack }: Props) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleChange = (val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = val.slice(0, 6);
    setCode(next);
    if (next.length === 6) verify(next);
  };

  const verify = async (token: string) => {
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) {
      setError('Incorrect code. Try again.');
      setCode('');
      inputRef.current?.focus();
      setLoading(false);
      return;
    }
    // Check if profile exists
    const userId = data.user?.id;
    if (userId) {
      const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
      onVerified(!profile);
    }
  };

  const resend = async () => {
    await supabase.auth.signInWithOtp({ phone });
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  };

  const displayPhone = phone.replace('+1', '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');

  return (
    <div className="flex flex-col h-full items-center justify-center px-8" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="w-full max-w-sm" style={{ marginTop: '-15vh' }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground text-sm mb-10 -ml-1">
          <ArrowLeft size={16} /> Back
        </button>

        <h2 className="text-2xl font-semibold text-foreground mb-2">Check your texts</h2>
        <p className="text-muted-foreground text-sm mb-10">
          We sent a 6-digit code to <span className="text-foreground font-medium">{displayPhone}</span>
        </p>

        {/* Single hidden input captures the full code — iOS autofill fills all 6 digits at once */}
        <div className="relative flex gap-3 justify-center mb-4" onPointerDown={() => inputRef.current?.focus()}>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={e => handleChange(e.target.value)}
            enterKeyHint="go"
            onKeyDown={dismissOnEnter()}
            disabled={loading}
            className="absolute inset-0 opacity-0 w-full h-full cursor-default"
          />
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-11 h-14 flex items-center justify-center text-xl font-semibold rounded-xl border bg-card text-foreground transition-all ${
                code[i] ? 'border-clean' : 'border-border'
              } ${loading ? 'opacity-50' : ''}`}
            >
              {code[i] ?? ''}
            </div>
          ))}
        </div>

        {error && <p className="text-red text-xs text-center mb-3">{error}</p>}
        {loading && <p className="text-muted-foreground text-xs text-center mb-3">Verifying…</p>}

        <div className="text-center mt-6">
          <button onClick={resend} className="text-xs text-muted-foreground underline">
            {resent ? 'Code sent!' : "Didn't get it? Resend"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OTPVerify;
