import { dismissOnEnter } from '@/hooks/useKeyboardDismiss';
import React, { useState, useRef } from 'react';
import { Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { validateHandle, validateName, sanitizeHandle, sanitizeName } from '@/lib/validation';

interface Props {
  onComplete: () => void;
}

const ProfileSetup = ({ onComplete }: Props) => {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [handleTaken, setHandleTaken] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleNameChange = (val: string) => {
    const clean = sanitizeName(val);
    setName(clean);
    if (!handle || handle === name.toLowerCase().replace(/\s+/g, '')) {
      setHandle(sanitizeHandle(clean.toLowerCase().replace(/\s+/g, '')));
    }
  };

  const handleHandleChange = (val: string) => {
    setHandle(sanitizeHandle(val));
    setHandleTaken(false);
  };

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!user) return;
    const nameErr = validateName(name);
    const handleErr = validateHandle(handle);
    if (nameErr) { setError(nameErr); return; }
    if (handleErr) { setError(handleErr); return; }
    setLoading(true);
    setError('');

    // Check handle uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('handle', handle)
      .maybeSingle();

    if (existing) {
      setHandleTaken(true);
      setLoading(false);
      return;
    }

    let avatar_url: string | null = null;

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true });

      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        avatar_url = data.publicUrl;
      }
    }

    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      name: name.trim(),
      handle: handle.trim(),
      avatar_url,
    });

    if (insertError) {
      setError('Something went wrong. Try again.');
      setLoading(false);
      return;
    }

    await refreshProfile();
    onComplete();
  };

  const ready = !validateName(name) && !validateHandle(handle);

  return (
    <div className="flex flex-col h-full items-center px-8 pt-24" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 60px)' }}>
      <div className="w-full max-w-sm">
        <h2 className="text-2xl font-semibold text-foreground mb-1">Set up your profile</h2>
        <p className="text-muted-foreground text-sm mb-8">This is how your friends will find you.</p>

        {/* Avatar picker */}
        <div className="flex justify-center mb-8">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative w-24 h-24 rounded-full bg-card border-2 border-border flex items-center justify-center overflow-hidden transition-all active:scale-95"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Camera size={22} className="text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium">Add Photo</span>
              </div>
            )}
            {avatarPreview && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Camera size={20} className="text-white" />
              </div>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Name</label>
          <input
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            enterKeyHint="next"
            onKeyDown={dismissOnEnter()}
            placeholder="Your name"
            maxLength={20}
            className="w-full bg-card border border-border rounded-2xl px-4 py-3.5 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>

        {/* Handle */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Handle</label>
          <div className="flex items-center bg-card border border-border rounded-2xl px-4 py-3.5 focus-within:ring-1 focus-within:ring-ring transition-all">
            <span className="text-muted-foreground font-medium mr-1">@</span>
            <input
              value={handle}
              onChange={e => handleHandleChange(e.target.value)}
              enterKeyHint="done"
              onKeyDown={dismissOnEnter()}
              placeholder="yourhandle"
              maxLength={13}
              className="flex-1 bg-transparent text-foreground font-medium focus:outline-none placeholder:text-muted-foreground"
            />
          </div>
          {handleTaken && <p className="text-red text-xs mt-1.5 px-1">That handle's taken. Try another.</p>}
        </div>

        {error && <p className="text-red text-xs mb-3 px-1">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!ready || loading}
          className="w-full h-14 rounded-2xl bg-clean text-clean-foreground font-semibold text-base transition-all active:scale-95 disabled:opacity-40"
        >
          {loading ? 'Creating profile…' : "Let's go"}
        </button>
      </div>
    </div>
  );
};

export default ProfileSetup;
