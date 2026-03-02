import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  TrendingUp, 
  TrendingDown,
  Eye,
  Clock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { venuesApi, analyticsApi } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';

export default function DashboardPage() {
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVenues();
  }, []);

  useEffect(() => {
    if (selectedVenue) {
      loadAnalytics(selectedVenue.id);
      loadLiveData(selectedVenue.id);
      
      // Poll live data every 30 seconds
      const interval = setInterval(() => loadLiveData(selectedVenue.id), 30000);
      return () => clearInterval(interval);
    }
  }, [selectedVenue]);

  const loadVenues = async () => {
    try {
      const response = await venuesApi.getMyVenues();
      setVenues(response.data.venues);
      if (response.data.venues.length > 0) {
        setSelectedVenue(response.data.venues[0]);
      }
    } catch (error) {
      console.error('Failed to load venues:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async (venueId) => {
    try {
      const response = await analyticsApi.getAnalytics(venueId, '7d');
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const loadLiveData = async (venueId) => {
    try {
      const response = await analyticsApi.getLive(venueId);
      setLiveData(response.data);
    } catch (error) {
      console.error('Failed to load live data:', error);
    }
  };

  const getCrowdColor = (percent) => {
    if (percent < 30) return 'text-emerald-300';
    if (percent < 60) return 'text-amber-300';
    if (percent < 80) return 'text-orange-300';
    return 'text-rose-300';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 text-[#2cc7b8] animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (venues.length === 0) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <div className="panel max-w-xl mx-auto p-10">
            <AlertCircle className="h-12 w-12 text-[#f2a65a] mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2 heading-display">No venues yet</h2>
            <p className="text-muted mb-6">Claim your first venue to start tracking crowds</p>
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 btn-primary px-6 py-3 rounded-lg font-semibold"
            >
              Claim a Venue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold heading-display">Dashboard</h1>
            <p className="text-muted">Real-time venue insights</p>
          </div>
          
          {venues.length > 1 && (
            <select
              value={selectedVenue?.id}
              onChange={(e) => setSelectedVenue(venues.find(v => v.id === e.target.value))}
              className="field max-w-xs"
            >
              {venues.map(venue => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Live Crowd Card */}
        <div className="panel p-6 fade-in stagger-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold heading-display">Live Now</h2>
            <div className="flex items-center gap-2 text-muted text-sm mono">
              <div className="w-2 h-2 bg-[#2cc7b8] rounded-full animate-pulse" />
              Real-time
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-muted text-sm mb-1">Capacity</p>
              <p className={`text-4xl font-bold ${getCrowdColor(liveData?.capacityPercent || 0)}`}>
                {liveData?.capacityPercent || 0}%
              </p>
            </div>
            <div>
              <p className="text-muted text-sm mb-1">Est. Crowd</p>
              <p className="text-4xl font-bold">
                {liveData?.estimatedTotal || 0}
              </p>
            </div>
            <div>
              <p className="text-muted text-sm mb-1">App Users</p>
              <p className="text-4xl font-bold">
                {liveData?.appUsers || 0}
              </p>
            </div>
            <div>
              <p className="text-muted text-sm mb-1">Trend</p>
              <div className="flex items-center gap-2">
                {selectedVenue?.trend === 'filling_up' ? (
                  <>
                    <TrendingUp className="h-8 w-8 text-amber-300" />
                    <span className="font-medium">Filling Up</span>
                  </>
                ) : selectedVenue?.trend === 'emptying' ? (
                  <>
                    <TrendingDown className="h-8 w-8 text-emerald-300" />
                    <span className="font-medium">Emptying</span>
                  </>
                ) : (
                  <span className="font-medium">Stable</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 fade-in stagger-2">
          <StatCard
            title="Today's Check-ins"
            value={analytics?.todayCheckIns || 0}
            icon={Users}
            color="bg-cyan-500/10 text-cyan-300"
          />
          <StatCard
            title="Profile Views (7d)"
            value={analytics?.daily?.reduce((sum, d) => sum + (d.profileViews || 0), 0) || 0}
            icon={Eye}
            color="bg-amber-500/10 text-amber-300"
          />
          <StatCard
            title="Avg Dwell Time"
            value={`${Math.round(analytics?.daily?.reduce((sum, d) => sum + (d.avgDwellTime || 0), 0) / (analytics?.daily?.length || 1) || 0)} min`}
            icon={Clock}
            color="bg-emerald-500/10 text-emerald-300"
          />
        </div>

        {/* Hourly Chart */}
        <div className="panel p-6 fade-in stagger-3">
          <h3 className="text-lg font-semibold heading-display mb-4">Typical Crowd by Hour</h3>
          {analytics?.hourly?.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.hourly}>
                  <XAxis 
                    dataKey="hour" 
                    stroke="#8aa2b9"
                    tickFormatter={(h) => `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`}
                  />
                  <YAxis stroke="#8aa2b9" tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f1d2b', border: '1px solid rgba(125, 181, 228, 0.24)', borderRadius: '10px' }}
                    labelFormatter={(h) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`}
                    formatter={(v) => [`${v}%`, 'Capacity']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgCapacity" 
                    stroke="#2cc7b8" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted">
              No data available yet
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/analytics"
            className="panel-soft hover:bg-[#1a3046] rounded-xl p-6 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1 heading-display">View Full Analytics</h3>
                <p className="text-muted text-sm">Deep dive into your venue performance</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted group-hover:text-[#2cc7b8] transition-colors" />
            </div>
          </Link>
          
          <Link
            to="/promotions"
            className="panel-soft hover:bg-[#1a3046] rounded-xl p-6 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1 heading-display">Create Promotion</h3>
                <p className="text-muted text-sm">Run targeted offers when crowd is low</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted group-hover:text-[#2cc7b8] transition-colors" />
            </div>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="panel-soft rounded-xl p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-muted text-sm">{title}</p>
          <p className="text-2xl font-bold heading-display">{value}</p>
        </div>
      </div>
    </div>
  );
}
