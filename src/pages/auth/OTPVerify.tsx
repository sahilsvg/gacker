import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';

interface Props {
  phone: string;
  onVerified: (isNewUser: boolean) => void;
  onBack: () => void;
}

const OTPVerify = ({ phone, onVerified, onBack }: Props) => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  const handleChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...code];
    next[i] = val.slice(-1);
    setCode(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
    if (next.every(d => d)) verify(next.join(''));
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const verify = async (token: string) => {
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) {
      setError('Incorrect code. Try again.');
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
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

        <div className="flex gap-3 justify-center mb-4">
          {code.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              disabled={loading}
              className={`w-11 h-14 text-center text-xl font-semibold rounded-xl border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all ${
                digit ? 'border-clean' : 'border-border'
              } disabled:opacity-50`}
            />
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
