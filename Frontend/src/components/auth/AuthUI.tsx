import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

export const InputField: React.FC<InputFieldProps> = ({ label, error, icon, ...props }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black uppercase text-outline tracking-widest block">{label}</label>
    <div className="relative">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-outline">{icon}</div>}
      <input
        className={`w-full bg-surface-container-low border ${
          error ? 'border-error' : 'border-outline-variant'
        } rounded px-3 py-2 text-body-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all ${
          icon ? 'pl-9' : ''
        }`}
        {...props}
      />
    </div>
    {error && <p className="text-[10px] text-error font-bold uppercase">{error}</p>}
  </div>
);

export const PasswordField: React.FC<InputFieldProps> = ({ label, error, ...props }) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase text-outline tracking-widest block">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className={`w-full bg-surface-container-low border ${
            error ? 'border-error' : 'border-outline-variant'
          } rounded px-3 py-2 pr-10 text-body-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="text-[10px] text-error font-bold uppercase">{error}</p>}
    </div>
  );
};

export const AuthButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }> = ({ 
  children, 
  loading, 
  className, 
  ...props 
}) => (
  <button
    disabled={loading}
    className={`w-full bg-primary hover:bg-primary-container text-on-primary font-black text-label-md py-2.5 rounded shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest flex items-center justify-center ${className}`}
    {...props}
  >
    {loading ? 'Executing Security Handshake...' : children}
  </button>
);
