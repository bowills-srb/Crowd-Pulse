import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BarChart3, 
  Megaphone, 
  Settings, 
  LogOut,
  Menu,
  X,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Promotions', href: '/promotions', icon: Megaphone },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { owner, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen app-shell">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 panel p-6 m-3">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="brand-badge rounded-xl p-2">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xl font-bold heading-display">CrowdPulse</span>
                  <p className="text-xs text-muted mono">Venue Command</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="h-6 w-6 text-muted" />
              </button>
            </div>
            <NavLinks currentPath={location.pathname} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-80 lg:flex-col p-6">
        <div className="flex flex-col flex-grow panel pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center gap-3 px-6 mb-8">
            <div className="brand-badge rounded-xl p-2">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl font-bold heading-display">CrowdPulse</span>
              <p className="text-xs text-muted mono">Venue Command</p>
            </div>
          </div>
          <nav className="flex-1 px-4 space-y-1">
            <NavLinks currentPath={location.pathname} />
          </nav>
          <div className="px-4 py-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full brand-badge flex items-center justify-center">
                <span className="font-semibold">
                  {owner?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">{owner?.name}</p>
                <p className="text-xs text-muted">{owner?.subscriptionTier} plan</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-muted hover:text-white text-sm w-full"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-80">
        {/* Mobile header */}
        <div className="sticky top-0 z-40 lg:hidden panel-soft m-3 px-4 py-3 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6 text-muted" />
          </button>
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-[#2cc7b8]" />
            <span className="font-bold">CrowdPulse</span>
          </div>
        </div>

        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLinks({ currentPath }) {
  return (
    <>
      {navigation.map((item) => {
        const isActive = currentPath === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? 'brand-badge shadow-md'
                : 'text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        );
      })}
    </>
  );
}
