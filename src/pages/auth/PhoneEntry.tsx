import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  onCodeSent: (phone: string) => void;
}

const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

const toE164 = (formatted: string): string => {
  const digits = formatted.replace(/\D/g, '');
  return `+1${digits}`;
};

const PhoneEntry = ({ onCodeSent }: Props) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const digits = phone.replace(/\D/g, '');
  const ready = digits.length === 10;

  const handleSend = async () => {
    if (!ready || loading) return;
    setLoading(true);
    setError('');
    const e164 = toE164(phone);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      onCodeSent(e164);
    }
  };

  return (
    <div className="flex flex-col h-full items-center justify-center px-8" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="w-full max-w-sm">
        <h1 className="font-wordmark text-6xl text-foreground mb-2 text-center">The Gacker</h1>
        <p className="text-muted-foreground text-sm text-center mb-12">Enter your number to get started.</p>

        <div className="mb-2">
          <div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-4 focus-within:ring-1 focus-within:ring-ring transition-all">
            <span className="text-foreground font-medium text-lg">🇺🇸 +1</span>
            <div className="w-px h-6 bg-border" />
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              placeholder="(555) 000-0000"
              maxLength={14}
              className="flex-1 bg-transparent text-foreground text-lg font-medium focus:outline-none placeholder:text-muted-foreground"
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
          </div>
        </div>

        {error && (
          <p className="text-red text-xs mb-3 px-1">{error}</p>
        )}

        <button
          onClick={handleSend}
          disabled={!ready || loading}
          className="w-full h-14 rounded-2xl bg-clean text-clean-foreground font-semibold text-base mt-4 transition-all active:scale-95 disabled:opacity-40"
        >
          {loading ? 'Sending…' : 'Send Code'}
        </button>

        <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
          US numbers only for now. Standard message rates apply.
        </p>
      </div>
    </div>
  );
};

export default PhoneEntry;
