// Login — email + password auth screen with a sign-in / sign-up toggle.
// Used when the app requires auth (see App.jsx). Errors surface inline; on sign-up
// with email confirmation enabled, we tell the user to check their inbox.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';

export function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const isSignup = mode === 'signup';

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (isSignup) {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setNotice('Account created — check your email to confirm, then sign in.');
          setMode('signin');
        }
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto p-4 pt-16">
      <Card>
        <CardHeader>
          <CardTitle>{isSignup ? 'Create account' : 'Sign in'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}
            {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

            <Button type="submit" disabled={busy}>
              {busy ? 'Please wait…' : isSignup ? 'Sign up' : 'Sign in'}
            </Button>
          </form>

          <button
            type="button"
            className="mt-3 text-sm text-muted-foreground underline"
            onClick={() => {
              setMode(isSignup ? 'signin' : 'signup');
              setError(null);
              setNotice(null);
            }}
          >
            {isSignup ? 'Have an account? Sign in' : "No account? Sign up"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
