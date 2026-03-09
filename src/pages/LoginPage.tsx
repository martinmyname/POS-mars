import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, loading, error, clearError } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (_err) {
      // Error stored in context
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-3 py-8 sm:px-4 sm:py-12">
      <button
        type="button"
        onClick={toggleTheme}
        className="fixed right-3 top-3 z-10 flex items-center justify-center rounded-xl border border-slate-300 bg-white p-2.5 text-slate-600 transition hover:bg-slate-50 hover:border-slate-400 dark:border-[#1f2937] dark:bg-[#1f2937] dark:text-[#9ca3af] dark:hover:bg-[#374151] dark:hover:border-[#374151] sm:right-6 sm:top-6"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <div className="w-full max-w-[400px]">
        <div className="card p-6 shadow-soft sm:p-8">
          <div className="mb-3 flex justify-center sm:mb-4">
            <img src="/logo.png" alt="Mars Kitchen Essentials" className="h-14 w-14 object-contain sm:h-16 sm:w-16" />
          </div>
          <h1 className="page-title text-center">Sign in</h1>
          <p className="page-subtitle text-center">Welcome back</p>
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4 sm:mt-6">
            <label htmlFor="login-email" className="sr-only">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-base"
              autoComplete="email"
            />
            <label htmlFor="login-password" className="sr-only">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-base"
              autoComplete="current-password"
            />
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 disabled:opacity-50"
            >
              {loading ? 'Please wait…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
