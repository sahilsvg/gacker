import React, { useState, useRef } from 'react';
import { X, Camera, Loader2, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { validateHandle, validateName, sanitizeHandle, sanitizeName } from '@/lib/validation';

interface Props {
  onClose: () => void;
}

const SettingsPage = ({ onClose }: Props) => {
  const { user, profile, refreshProfile, signOut } = useAuth();

  // Avatar
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Name
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile?.name ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  // Handle
  const [editingHandle, setEditingHandle] = useState(false);
  const [handle, setHandle] = useState(profile?.handle ?? '');
  const [handleSaving, setHandleSaving] = useState(false);
  const [handleError, setHandleError] = useState('');
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const handleCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
    await refreshProfile();
    setAvatarUploading(false);
  };

  const saveName = async () => {
    if (!user) return;
    const err = validateName(name);
    if (err) { setNameError(err); return; }
    setNameSaving(true);
    setNameError('');
    const { error } = await supabase.from('profiles').update({ name: name.trim() }).eq('id', user.id);
    if (error) setNameError('Could not save name.');
    else { await refreshProfile(); setEditingName(false); }
    setNameSaving(false);
  };

  const onHandleChange = (val: string) => {
    const clean = sanitizeHandle(val);
    setHandle(clean);
    setHandleError('');
    setHandleAvailable(null);
    if (handleCheckRef.current) clearTimeout(handleCheckRef.current);
    if (!clean || clean === profile?.handle) return;
    handleCheckRef.current = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('handle', clean).maybeSingle();
      setHandleAvailable(!data);
    }, 400);
  };

  const saveHandle = async () => {
    if (!user) return;
    const err = validateHandle(handle);
    if (err) { setHandleError(err); return; }
    if (handleAvailable === false) return;
    setHandleSaving(true);
    setHandleError('');
    const { error } = await supabase.from('profiles').update({ handle: handle.trim() }).eq('id', user.id);
    if (error) setHandleError('Could not save handle.');
    else { await refreshProfile(); setEditingHandle(false); setHandleAvailable(null); }
    setHandleSaving(false);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
      await signOut();
    } catch (err: any) {
      setDeleteError('Something went wrong. Please try again.');
      setDeleting(false);
    }
  };

  const phone = user?.phone ?? '—';

  return (
    <div
      className="fixed inset-0 bg-background flex flex-col z-[300] animate-slide-up"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-border">
        <h2 className="font-semibold text-foreground text-lg">Settings</h2>
        <button onPointerDown={e => { e.preventDefault(); onClose(); }} className="text-muted-foreground active:opacity-60">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Profile picture */}
        <Section label="Profile">
          <div className="flex items-center gap-4 px-4 py-4">
            <label className="relative w-16 h-16 flex-shrink-0 cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-muted border border-border overflow-hidden">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center">
                      <span className="font-wordmark text-2xl text-foreground">{profile?.name?.[0]?.toUpperCase()}</span>
                    </div>
                }
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-clean flex items-center justify-center shadow-md pointer-events-none">
                {avatarUploading ? <Loader2 size={11} className="animate-spin text-clean-foreground" /> : <Camera size={11} className="text-clean-foreground" />}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
            <div>
              <p className="font-semibold text-foreground">{profile?.name}</p>
              <p className="text-sm text-muted-foreground">@{profile?.handle}</p>
            </div>
          </div>
        </Section>

        {/* Name */}
        <Section label="Account">
          <SettingsRow label="Name" onTap={() => { setEditingName(true); setName(profile?.name ?? ''); }}>
            <span className="text-muted-foreground text-sm truncate max-w-[140px]">{profile?.name}</span>
          </SettingsRow>
          {editingName && (
            <div className="px-4 pb-4 space-y-2">
              <input
                autoFocus
                value={name}
                onChange={e => setName(sanitizeName(e.target.value))}
                placeholder="Your name"
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {nameError && <p className="text-red text-xs px-1">{nameError}</p>}
              <div className="flex gap-2">
                <button onPointerDown={e => { e.preventDefault(); setEditingName(false); }} className="flex-1 py-2 rounded-xl bg-muted text-sm font-medium text-muted-foreground">Cancel</button>
                <button onPointerDown={e => { e.preventDefault(); saveName(); }} disabled={nameSaving || !name.trim()} className="flex-1 py-2 rounded-xl bg-clean text-clean-foreground text-sm font-semibold disabled:opacity-50">
                  {nameSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          <div className="h-px bg-border mx-4" />

          {/* Handle */}
          <SettingsRow label="Username" onTap={() => { setEditingHandle(true); setHandle(profile?.handle ?? ''); }}>
            <span className="text-muted-foreground text-sm truncate max-w-[140px]">@{profile?.handle}</span>
          </SettingsRow>
          {editingHandle && (
            <div className="px-4 pb-4 space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <input
                  autoFocus
                  value={handle}
                  onChange={e => onHandleChange(e.target.value)}
                  placeholder="yourhandle"
                  className="w-full bg-background border border-border rounded-xl pl-7 pr-9 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {handle && handle !== profile?.handle && (
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold ${handleAvailable === true ? 'text-clean' : handleAvailable === false ? 'text-red' : 'text-muted-foreground'}`}>
                    {handleAvailable === true ? '✓' : handleAvailable === false ? '✗' : '…'}
                  </span>
                )}
              </div>
              {handleError && <p className="text-red text-xs px-1">{handleError}</p>}
              {handleAvailable === false && <p className="text-red text-xs px-1">That handle is taken.</p>}
              <div className="flex gap-2">
                <button onPointerDown={e => { e.preventDefault(); setEditingHandle(false); setHandleAvailable(null); }} className="flex-1 py-2 rounded-xl bg-muted text-sm font-medium text-muted-foreground">Cancel</button>
                <button onPointerDown={e => { e.preventDefault(); saveHandle(); }} disabled={handleSaving || handleAvailable === false || handle === profile?.handle} className="flex-1 py-2 rounded-xl bg-clean text-clean-foreground text-sm font-semibold disabled:opacity-50">
                  {handleSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          <div className="h-px bg-border mx-4" />

          {/* Phone */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm text-foreground">Phone</span>
            <span className="text-muted-foreground text-sm">{phone}</span>
          </div>
        </Section>

        {/* Sign out + Delete account */}
        <div className="px-5 pt-2 pb-8 space-y-3">
          <button
            onPointerDown={e => { e.preventDefault(); signOut(); }}
            className="w-full py-3.5 rounded-2xl bg-card border border-border text-red text-sm font-semibold transition-all active:scale-95"
          >
            Sign Out
          </button>
          <button
            onPointerDown={e => { e.preventDefault(); setShowDeleteConfirm(true); }}
            className="w-full py-3.5 rounded-2xl text-red/60 text-sm font-medium transition-all active:opacity-60"
          >
            Delete Account
          </button>
        </div>

      </div>

      {/* Delete account confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/70" onPointerDown={() => { if (!deleting) setShowDeleteConfirm(false); }} />
          <div className="relative bg-card border border-border rounded-3xl p-6 w-full max-w-sm">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red/10 flex items-center justify-center">
                <AlertTriangle size={22} className="text-red" />
              </div>
            </div>
            <h3 className="font-semibold text-foreground text-base text-center mb-2">Delete Account</h3>
            <p className="text-muted-foreground text-sm text-center mb-6 leading-relaxed">
              This will permanently delete your account and all your data. This can't be undone.
            </p>
            {deleteError && (
              <p className="text-red text-xs text-center mb-4">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onPointerDown={e => { e.preventDefault(); if (!deleting) { setShowDeleteConfirm(false); setDeleteError(''); } }}
                disabled={deleting}
                className="flex-1 py-3 rounded-2xl bg-muted text-foreground text-sm font-semibold active:scale-95 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onPointerDown={e => { e.preventDefault(); handleDeleteAccount(); }}
                disabled={deleting}
                className="flex-1 py-3 rounded-2xl bg-red text-white text-sm font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="px-5 pt-6 pb-2">
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{label}</p>
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {children}
    </div>
  </div>
);

const SettingsRow = ({ label, children, onTap }: { label: string; children: React.ReactNode; onTap: () => void }) => (
  <button onPointerDown={e => { e.preventDefault(); onTap(); }} className="w-full flex items-center justify-between px-4 py-3.5 active:opacity-60 transition-opacity">
    <span className="text-sm text-foreground">{label}</span>
    <div className="flex items-center gap-1.5">
      {children}
      <ChevronRight size={14} className="text-muted-foreground/50" />
    </div>
  </button>
);

export default SettingsPage;
