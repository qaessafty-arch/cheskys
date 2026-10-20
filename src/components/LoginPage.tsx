import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, Mail, Eye, EyeOff, UserPlus, ArrowRight, User, X,
  ShieldCheck, Zap, ChevronLeft, CheckCircle2, AlertCircle, Smartphone, MessageSquareText
} from 'lucide-react';
import { useGlassFloat } from '../hooks/useGlassFloat';
import { useTranslation } from 'react-i18next';

interface LoginPageProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  onNavigateHome?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onCancel, onNavigateHome }) => {
  const { 
    profile, signInWithGoogle, signInWithApple, signInWithEmail,
    signUpWithEmail, signInAsGuest, sendPasswordReset, signOut,
    sendPhoneCode, confirmPhoneCode, authError, clearAuthError
  } = useAuth();
  
  const { t } = useTranslation();
  const floatVariants = useGlassFloat(1.1);
  
  const [screen, setScreen] = useState<'landing' | 'auth'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  
  // Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  // Phone
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Errors from a Google redirect sign-in arrive after the page reloads.
  useEffect(() => {
    if (authError) {
      setError(authError);
      clearAuthError();
    }
  }, [authError, clearAuthError]);

  useEffect(() => {
    const savedEmail = localStorage.getItem('chess_saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setScreen('auth');
      setAuthMode('login');
    }
  }, []);

  const handleSuccess = async (message: string) => {
    setSuccess(message);
    setTimeout(() => {
      if (onSuccess) onSuccess();
      else if (onNavigateHome) onNavigateHome();
    }, 1000);
  };

  const handleGuest = async () => {
    setError(null); setLoading(true);
    try {
      await signInAsGuest();
      await handleSuccess('Welcome, Guest!');
    } catch (err: any) {
      setError(err.message); setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setError(null); setLoading(true);
    try {
      if (provider === 'google') await signInWithGoogle();
      if (provider === 'apple') await signInWithApple();
      await handleSuccess(`Signed in with ${provider === 'google' ? 'Google' : 'Apple'}`);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') setError(err.message);
      setLoading(false);
    }
  };

  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      if (!codeSent) {
        await sendPhoneCode(phoneNumber, 'phone-recaptcha');
        setCodeSent(true);
        setSuccess('Code sent. Check your SMS messages.');
        setLoading(false);
      } else {
        await confirmPhoneCode(phoneCode);
        await handleSuccess('Signed in with your phone number.');
      }
    } catch (err: any) {
      setSuccess(null);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    
    try {
      if (authMode === 'forgot') {
        await sendPasswordReset(email);
        setSuccess('Password reset link sent.');
        setTimeout(() => setAuthMode('login'), 3000);
        setLoading(false);
        return;
      }

      if (authMode === 'signup') {
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        if (password.length < 8) throw new Error('Password must be at least 8 characters');
        await signUpWithEmail(email, password, displayName || undefined);
        if (rememberMe) localStorage.setItem('chess_saved_email', email);
        await handleSuccess('Account created successfully!');
      } else {
        await signInWithEmail(email, password);
        if (rememberMe) localStorage.setItem('chess_saved_email', email);
        else localStorage.removeItem('chess_saved_email');
        await handleSuccess('Successfully signed in.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={["visible", "float"]}
        variants={{
          visible: { opacity: 1, scale: 1 },
          ...floatVariants
        }}
        className="w-full max-w-md bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative z-10"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" />
        
        {onCancel && (
          <button onClick={onCancel} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 flex items-center justify-center mb-4 shadow-inner">
            <span className="text-2xl filter drop-shadow">♟️</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Chesskys <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-400">PRO</span>
          </h1>
        </div>

        
        {profile && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-800/50 border border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src={profile.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60'} alt="Profile" className="w-10 h-10 rounded-xl object-cover border border-emerald-500/30" referrerPolicy="no-referrer" />
              <div className="truncate">
                <div className="text-sm font-bold text-white truncate">{profile.displayName} {profile.flag}</div>
                <div className="text-[10px] text-emerald-400 font-mono">Rating: {profile.elo}</div>
              </div>
            </div>
            <button onClick={async () => { await signOut(); if (onNavigateHome) onNavigateHome(); }} className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-colors whitespace-nowrap">
              Sign Out
            </button>
          </div>
        )}
        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
          </div>
        )}

        <AnimatePresence mode="wait">
          {screen === 'landing' ? (
            <motion.div key="landing" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-4">
              <button
                onClick={() => handleOAuth('google')}
                disabled={loading}
                className="w-full py-3.5 bg-white hover:bg-slate-100 rounded-xl text-slate-900 font-black shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" /> Continue with Google
              </button>
              <p className="text-[11px] text-slate-400 text-center -mt-1">New accounts are created with Google. Your Google account keeps your rating, friends and chats safe.</p>

              <div className="flex items-center gap-4 py-1">
                <div className="h-px bg-white/10 flex-1" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Or</span>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              <button
                onClick={handleGuest}
                disabled={loading}
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Zap className="w-5 h-5 text-emerald-400" /> Play as Guest
              </button>
              <p className="text-[11px] text-slate-500 text-center -mt-1">Guests can play the bots. Friends, chat and the leaderboard need a Google account.</p>

              <button
                onClick={() => { setAuthMode('login'); setScreen('auth'); setError(null); }}
                disabled={loading}
                className="text-xs font-bold text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Already have an email or phone account? Sign in
              </button>
            </motion.div>
          ) : (
            <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex items-center mb-6">
                <button onClick={() => setScreen('landing')} className="text-slate-400 hover:text-white mr-3">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                {method === 'phone' ? (
                  <span className="flex-1 text-sm font-bold text-white">Sign in with phone</span>
                ) : (
                <span className="flex-1 text-sm font-bold text-white">{authMode === 'forgot' ? 'Reset your password' : 'Sign in to your existing account'}</span>
                )}
              </div>

              <div className="flex bg-black/40 rounded-lg p-1 mb-4" role="tablist" aria-label="Sign-in method">
                <button type="button" role="tab" aria-selected={method === 'email'} onClick={() => { setMethod('email'); setError(null); setSuccess(null); }} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 ${method === 'email' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
                <button type="button" role="tab" aria-selected={method === 'phone'} onClick={() => { setMethod('phone'); setError(null); setSuccess(null); }} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center justify-center gap-1.5 ${method === 'phone' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
                  <Smartphone className="w-3.5 h-3.5" /> Phone
                </button>
              </div>

              {method === 'phone' ? (
              <form onSubmit={handlePhoneAuth} className="space-y-4">
                <div className="relative">
                  <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="tel" inputMode="tel" autoComplete="tel" value={phoneNumber} onChange={e => { setPhoneNumber(e.target.value); setCodeSent(false); }} disabled={codeSent && loading} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50" placeholder="+964 750 123 4567" aria-label="Phone number" required />
                </div>
                {codeSent && (
                  <div className="relative">
                    <MessageSquareText className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={phoneCode} onChange={e => setPhoneCode(e.target.value.replace(/\D/g, ''))} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm tracking-[0.4em] font-mono placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50" placeholder="6-digit code" aria-label="Verification code" required />
                  </div>
                )}
                <p className="text-[11px] text-slate-500 px-1">Include your country code. Only for phone accounts that already exist; new players sign up with Google.</p>
                <button type="submit" disabled={loading || (codeSent && phoneCode.length < 6)} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? 'Processing...' : codeSent ? 'Verify & Sign In' : 'Send Code'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
                {codeSent && (
                  <button type="button" disabled={loading} onClick={() => { setCodeSent(false); setPhoneCode(''); setSuccess(null); }} className="w-full text-xs font-bold text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
                    Change number or resend code
                  </button>
                )}
              </form>
              ) : (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {authMode === 'signup' && (
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50" placeholder="Display Name" required />
                  </div>
                )}
                
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50" placeholder="Email Address" required />
                </div>

                {authMode !== 'forgot' && (
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50" placeholder="Password" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {authMode === 'signup' && (
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50" placeholder="Confirm Password" required />
                  </div>
                )}

                {authMode === 'login' && (
                  <div className="flex justify-between items-center px-1">
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500/50" />
                      Remember me
                    </label>
                    <button type="button" onClick={() => setAuthMode('forgot')} className="text-xs font-bold text-emerald-400 hover:text-emerald-300">
                      Forgot Password?
                    </button>
                  </div>
                )}

                <button type="submit" disabled={loading} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? 'Processing...' : authMode === 'login' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Reset Password'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {/* Invisible reCAPTCHA required by Firebase phone sign-in. */}
        <div id="phone-recaptcha" />

      </motion.div>
    </div>
  );
};
