import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/60 ${className}`}
    >
      {children}
    </div>
  );
}

export function Btn({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const styles = {
    primary: 'bg-brand-500 hover:bg-brand-600 text-white',
    ghost: 'border border-slate-700 hover:bg-slate-800 text-slate-200',
    danger: 'border border-red-500/40 text-red-300 hover:bg-red-500/10',
  }[variant];
  return (
    <button
      {...props}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function Field({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-xs text-slate-400 mb-1">{label}</span>
      )}
      <input
        {...props}
        className={`w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-brand-500 outline-none text-sm ${className}`}
      />
    </label>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-700/40 text-slate-300',
    green: 'bg-emerald-500/15 text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-300',
    red: 'bg-red-500/15 text-red-300',
    blue: 'bg-blue-500/15 text-blue-300',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  );
}
