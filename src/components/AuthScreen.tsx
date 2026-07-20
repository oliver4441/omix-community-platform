import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Icon } from './Icon';

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showPasskeyOption, setShowPasskeyOption] = useState(false);
  const { signIn, signUp, signInWithPasskey, isBiometricAvailable, hasPasskey } = useAuth();

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
  }, [isBiometricAvailable]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        if (!displayName.trim()) {
          setError('Please enter a display name');
          setLoading(false);
          return;
        }
        await signUp(email.trim(), password, displayName.trim());
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (e.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists');
      } else if (e.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters');
      } else if (e.code === 'auth/invalid-email') {
        setError('Please enter a valid email address');
      } else {
        setError(e.message || 'Something went wrong');
      }
    }
    setLoading(false);
  };

  const handlePasskeySignIn = async () => {
    if (!email.trim()) {
      setError('Please enter your email first');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const hasRegistered = await hasPasskey(email.trim());
      if (!hasRegistered) {
        setError('No passkey registered for this email. Use password or register a passkey first.');
        setLoading(false);
        return;
      }
      await signInWithPasskey(email.trim());
      // The sign in will complete via email link
      setError('Check your email for the sign-in link');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Passkey sign-in failed');
    }
    setLoading(false);
  };

  const checkPasskeyForEmail = async () => {
    if (email.trim() && biometricAvailable) {
      const registered = await hasPasskey(email.trim());
      setShowPasskeyOption(registered);
    } else {
      setShowPasskeyOption(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f1a] via-[#111827] to-[#0a0f1a]" />
      
      {/* Animated floating orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #3390EC 0%, transparent 70%)',
            animation: 'floatOrb 12s ease infinite',
          }} />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, #2A7FD6 0%, transparent 70%)',
            animation: 'floatOrb 15s ease infinite reverse',
          }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-5"
          style={{
            background: 'radial-gradient(circle, #4BA0F5 0%, transparent 70%)',
            animation: 'pulseSlow 8s ease infinite',
          }} />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Auth Card */}
      <div className="relative z-10 w-full max-w-md px-4" style={{ animation: 'fadeSlideUp 0.6s ease' }}>
        <div className="backdrop-blur-2xl bg-white/[0.05] rounded-2xl p-8 shadow-2xl border border-white/10"
          style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>

          {/* Logo area */}
          <div className="text-center mb-7">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-4 overflow-hidden shadow-lg"
              style={{ boxShadow: '0 8px 32px rgba(51,144,236,0.4)' }}>
              <img src="/logo.jpg" className="w-full h-full object-cover" alt="Omix Community" />
            </div>
            <h1 className="text-2xl font-bold text-white">Omix Community</h1>
            <p className="text-white/50 text-sm mt-1">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex bg-black/20 rounded-lg p-1 mb-6 backdrop-blur-sm">
            <button
              onClick={() => { setMode('signin'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'signin' ? 'bg-white/15 text-white shadow-sm' : 'text-white/40 hover:text-white/70'
              }`}>
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === 'signup' ? 'bg-white/15 text-white shadow-sm' : 'text-white/40 hover:text-white/70'
              }`}>
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Display Name</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                  className="w-full bg-white/5 text-white rounded-lg p-3 mt-1 outline-none focus:ring-2 focus:ring-[#3390EC] border border-white/10 transition-all placeholder:text-white/30"
                  placeholder="Your name" required maxLength={20} />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Email</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); checkPasskeyForEmail(); }}
                className="w-full bg-white/5 text-white rounded-lg p-3 mt-1 outline-none focus:ring-2 focus:ring-[#3390EC] border border-white/10 transition-all placeholder:text-white/30"
                placeholder="you@example.com" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 text-white rounded-lg p-3 mt-1 outline-none focus:ring-2 focus:ring-[#3390EC] border border-white/10 transition-all placeholder:text-white/30"
                placeholder="At least 6 characters" required minLength={6} />
            </div>

            {mode === 'signin' && biometricAvailable && showPasskeyOption && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePasskeySignIn}
                  disabled={loading || !email.trim()}
                  className="w-full p-3 rounded-lg font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 border border-white/20 hover:border-white/30 bg-white/5 hover:bg-white/10 text-white"
                >
                  <Icon name="fingerprint" size={20} />
                  <span>Sign in with Passkey / Biometric</span>
                </button>
                <p className="text-center text-xs text-white/40 mt-2">Use Face ID, Touch ID, Windows Hello, or device PIN</p>
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button type="submit" disabled={loading}
              className={`w-full p-3 rounded-lg font-semibold text-base transition-all duration-200 ${
                loading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'
              }`}
              style={{
                background: 'linear-gradient(135deg, #3390EC, #2A7FD6)',
                boxShadow: '0 4px 20px rgba(51,144,236,0.3)',
              }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
                  {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                mode === 'signin' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          {mode === 'signin' && (
            <p className="text-center mt-5 text-xs text-white/40">
              No account?{' '}
              <button onClick={() => { setMode('signup'); setError(''); }} className="text-[#3390EC] hover:underline font-medium">
                Sign up
              </button>
            </p>
          )}

          <p className="text-center mt-4 text-xs text-white/30">
            Designed by OmixSystems
          </p>
        </div>
      </div>
    </div>
  );
}
