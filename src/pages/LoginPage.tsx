import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      if (isSignUp) await signUp(email, password);
      else await signIn(email, password);
      navigate(from, { replace: true });
    } catch (_err) {
      // Error stored in context
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-3 py-8 sm:px-4 sm:py-12">
      <div className="w-full max-w-[400px]">
        <div className="card p-6 shadow-soft sm:p-8">
          <div className="mb-3 flex justify-center sm:mb-4">
            <img src="/logo.png" alt="Mars Kitchen Essentials" className="h-14 w-14 object-contain sm:h-16 sm:w-16" />
          </div>
          <h1 className="page-title text-center">
            {isSignUp ? 'Create account' : 'Sign in'}
          </h1>
          <p className="page-subtitle text-center">
            {isSignUp ? 'Register for Mars Kitchen Essentials' : 'Welcome back'}
          </p>
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4 sm:mt-6">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-base"
              autoComplete="email"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-base"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
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
              {loading ? 'Please wait…' : isSignUp ? 'Sign up' : 'Sign in'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => { setIsSignUp((v) => !v); clearError(); }}
            className="mt-4 w-full text-center text-sm font-medium text-tufts-blue hover:text-tufts-blue-hover"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
}
