import React, { useState, type FormEvent } from 'react';

interface LoginPageProps {
  busy: boolean;
  error: string | null;
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function LoginPage({ busy, error, onSubmit }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit(email, password).finally(() => setPassword(''));
  };

  return (
    <main className="login-layout">
      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">Blackrose Journal</p>
        <h1 id="login-title">AI control plane</h1>
        <p className="muted">Sign in with an account explicitly authorized for administration.</p>
        {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
        <form className="form-stack" onSubmit={submit}>
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
