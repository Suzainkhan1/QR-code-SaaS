import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Coffee, ArrowRight, ShieldCheck, Mail, Lock } from 'lucide-react';
import { useAuth } from '../shared/hooks/useAuth';

export default function StaffLogin() {
  const navigate = useNavigate();
  const loginUser = useAuth((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all credentials.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      loginUser(data.token, data.user, data.restaurant);
      navigate('/staff/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check internet and credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background soft glowing blur spheres */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-brand-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-orange-600/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-accent to-orange-500" />
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-accent/15 flex items-center justify-center text-brand-accent mb-3 border border-brand-accent/20">
            <Coffee className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-brand-textPrimary">Welcome to CrunchOS</h2>
          <p className="text-xs text-brand-textSecondary mt-1">Management Terminals Hub</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                placeholder="rohan@restaurant.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-brand-textPrimary placeholder-zinc-650 focus:outline-none focus:border-brand-accent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-brand-textPrimary placeholder-zinc-650 focus:outline-none focus:border-brand-accent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 bg-brand-accent hover:bg-brand-accentHover text-brand-dark font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-950/20"
          >
            {loading ? 'Authenticating terminal...' : 'Access Dashboard'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 border-t border-zinc-850 pt-4 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-accent" />
            Role-Based Cryptographic Terminal Lock
          </div>
          <p className="text-[11px] text-brand-textSecondary mt-2">
            New restaurant?{' '}
            <Link to="/staff/register" className="text-brand-accent font-bold hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
