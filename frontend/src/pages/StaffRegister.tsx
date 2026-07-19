import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Coffee, ArrowRight, Home, Globe, User, Mail, Lock } from 'lucide-react';
import { useAuth } from '../shared/hooks/useAuth';
import { API_URL } from '../shared/config/api';

export default function StaffRegister() {
  const navigate = useNavigate();
  const loginUser = useAuth((state) => state.login);

  const [restaurantName, setRestaurantName] = useState('');
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Automatically update slug from restaurant name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRestaurantName(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName || !slug || !name || !email || !password) {
      setError('Please fill in all registration parameters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantName, slug, name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      loginUser(data.token, data.user, data.restaurant);
      navigate('/staff/dashboard');
    } catch (err: any) {
      setError(err.message || 'Server error creating store.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col justify-center items-center p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-brand-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-orange-600/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-accent to-orange-500" />
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-accent/15 flex items-center justify-center text-brand-accent mb-3 border border-brand-accent/20">
            <Coffee className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-brand-textPrimary">Register Restaurant</h2>
          <p className="text-xs text-brand-textSecondary mt-1">Deploy new Smart QR SaaS instance</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Restaurant Name
            </label>
            <div className="relative">
              <Home className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Cafe Delight"
                value={restaurantName}
                onChange={handleNameChange}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-brand-textPrimary placeholder-zinc-650 focus:outline-none focus:border-brand-accent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              URL Handle (Slug)
            </label>
            <div className="relative">
              <Globe className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="cafe-delight"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-brand-textPrimary placeholder-zinc-650 focus:outline-none focus:border-brand-accent transition-all"
              />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1 pl-1">
              Customer link: <span className="font-mono text-brand-accent">crunchos.com/r/{slug || '...'}</span>
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Owner Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Rohan Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-brand-textPrimary placeholder-zinc-650 focus:outline-none focus:border-brand-accent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Owner Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                placeholder="rohan@crunchos.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-brand-textPrimary placeholder-zinc-650 focus:outline-none focus:border-brand-accent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
              Secure Password
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
            className="w-full py-3 mt-4 bg-brand-accent hover:bg-brand-accentHover text-brand-dark font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
          >
            {loading ? 'Initializing server...' : 'Initialize SaaS Instance'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[11px] text-center text-brand-textSecondary mt-6 pt-4 border-t border-zinc-850">
          Already registered?{' '}
          <Link to="/staff/login" className="text-brand-accent font-bold hover:underline">
            Login to terminal
          </Link>
        </p>
      </div>
    </div>
  );
}
