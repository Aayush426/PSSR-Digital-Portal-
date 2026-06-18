import React, { useState } from 'react';
import { InputField, PasswordField, AuthButton } from '../../components/auth/AuthUI';
import { Mail, Lock, ShieldCheck, Cpu } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { routeUserToDashboard } from '../../components/auth/RoleRouter';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(email, password);
      routeUserToDashboard(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'ACCESS_DENIED: Invalid credentials or insufficient privileges.'
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-inverse-surface flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl shadow-lg ring-4 ring-primary/20 mb-4">
            <ShieldCheck className="w-10 h-10 text-on-primary" />
          </div>
          <h1 className="text-2xl font-black text-on-primary uppercase tracking-tighter leading-none">Digital PSSR Portal</h1>
          <p className="text-[10px] text-outline-variant font-black uppercase tracking-[0.3em] mt-2 opacity-60">Enterprise Gateway v4.2</p>
        </div>

        {/* Auth Card */}
        <div className="bg-surface-container-lowest border-t-4 border-primary rounded p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-headline-sm font-black text-on-surface uppercase tracking-tight">Security Handshake</h2>
            <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-widest mt-1 opacity-70">Authenticated Access Only</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <InputField
              label="Personnel Email"
              type="email"
              placeholder="name@refinery.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={16} />}
              required
              disabled={loading}
            />

            <PasswordField
              label="Security Token / Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={16} />}
              required
              disabled={loading}
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary bg-surface"
                />
                <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest transition-colors group-hover:text-primary">Keep Session Active</span>
              </label>
              <button type="button" className="text-[11px] font-black text-primary uppercase tracking-widest hover:underline transition-all">Token Reset?</button>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-error-container border border-error/20 rounded flex items-start space-x-3"
              >
                <div className="w-1.5 h-1.5 bg-error rounded-full mt-1.5 shrink-0 animate-pulse"></div>
                <p className="text-[10px] text-on-error-container font-black uppercase tracking-wider leading-relaxed">{error}</p>
              </motion.div>
            )}

            <AuthButton loading={loading}>
              Authorize Session
            </AuthButton>
          </form>

          <div className="mt-8 pt-6 border-t border-outline-variant/30 flex items-center justify-between opacity-50">
            <div className="flex items-center space-x-2 grayscale">
              <Cpu size={14} className="text-outline" />
              <span className="text-[10px] font-bold uppercase text-outline"></span>
            </div>
            <div className="text-[10px] font-mono text-outline uppercase"></div>
          </div>
        </div>

        <p className="text-center mt-6 text-[10px] text-outline-variant uppercase font-bold tracking-widest opacity-40">
          Industrial Safety Protocol Compliance Required. Unauthorized access attempts are monitored and logged to Security Node.
        </p>
      </motion.div>
    </div>
  );
};
