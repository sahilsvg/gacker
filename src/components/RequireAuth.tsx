import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export type AdminOwner = 'helium' | 'prize';

export interface AdminSession {
  username: string;
  owner: AdminOwner;
  label: string;
}

const STORAGE_KEY = 'ascension_admin';

const ACCOUNTS: Record<string, { password: string; owner: AdminOwner; label: string }> = {
  LosAdmin: { password: 'Banana0129!', owner: 'helium', label: 'Helium' },
  LosPrize: { password: 'Guatemala123!!', owner: 'prize', label: 'Prize' },
};

interface RequireAuthProps {
  children: (session: AdminSession) => React.ReactNode;
  title?: string;
}

const RequireAuth = ({ children, title = 'Admin Login' }: RequireAuthProps) => {
  const [session, setSession] = useState<AdminSession | null>(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as AdminSession; } catch { return null; }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const acct = ACCOUNTS[username.trim()];
    if (acct && acct.password === password) {
      const next: AdminSession = { username: username.trim(), owner: acct.owner, label: acct.label };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next);
    } else {
      toast({ title: 'Invalid credentials', variant: 'destructive' });
    }
  };

  if (session) return <>{children(session)}</>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-card/80 backdrop-blur-sm border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                <ArrowLeft size={16} />
              </Button>
            </Link>
            <CardTitle className="text-primary">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full">
              <LogIn size={16} className="mr-2" />
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RequireAuth;
