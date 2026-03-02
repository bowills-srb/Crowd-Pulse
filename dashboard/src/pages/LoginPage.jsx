import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen app-shell flex items-center justify-center px-4 py-10">
      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-8 w-full max-w-5xl items-stretch">
        <section className="panel p-8 lg:p-12 fade-in">
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="brand-badge rounded-xl p-2.5">
              <MapPin className="h-7 w-7" />
            </div>
            <div>
              <p className="text-2xl font-bold heading-display">CrowdPulse</p>
              <p className="text-sm text-muted mono">Operator Dashboard</p>
            </div>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold heading-display mb-3">
            Know the crowd pulse in real time.
          </h1>
          <p className="text-muted max-w-md leading-relaxed">
            Monitor venue energy, launch timely promotions, and make live staffing decisions
            from one command center.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 mt-10">
            {[
              ['Live capacity', 'Updated every 30s'],
              ['Smart offers', 'Trigger by occupancy'],
              ['Trend insights', '7-day movement view'],
            ].map(([title, body]) => (
              <div key={title} className="panel-soft p-4">
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted mt-1">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="panel p-8 lg:p-10 fade-in stagger-1">
          <h2 className="text-2xl font-semibold heading-display">Sign In</h2>
          <p className="text-muted mt-1 mb-6">Access your venue command center.</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                placeholder="you@venue.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary font-semibold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-muted text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#2cc7b8] hover:text-[#7ee5dc]">
              Register your venue
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
