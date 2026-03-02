import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Clock, 
  Users, 
  Zap,
  X,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { venuesApi, promotionsApi } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';

export default function PromotionsPage() {
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVenues();
  }, []);

  useEffect(() => {
    if (selectedVenue) {
      loadPromotions(selectedVenue.id);
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

  const loadPromotions = async (venueId) => {
    try {
      const response = await promotionsApi.getPromotions(venueId);
      setPromotions(response.data.promotions);
    } catch (error) {
      console.error('Failed to load promotions:', error);
    }
  };

  const handleDelete = async (promoId) => {
    if (!confirm('Delete this promotion?')) return;
    
    try {
      await promotionsApi.deletePromotion(selectedVenue.id, promoId);
      setPromotions(promotions.filter(p => p.id !== promoId));
    } catch (error) {
      console.error('Failed to delete promotion:', error);
    }
  };

  const getPromoTypeLabel = (type) => {
    const labels = {
      happy_hour: '🍺 Happy Hour',
      event: '🎉 Event',
      discount: '💰 Discount',
      special: '⭐ Special',
    };
    return labels[type] || type;
  };

  const getStatusColor = (promo) => {
    const now = new Date();
    const start = new Date(promo.startTime);
    const end = new Date(promo.endTime);
    
    if (now > end) return 'bg-gray-500/10 text-gray-400';
    if (now >= start && now <= end) return 'bg-green-500/10 text-green-400';
    return 'bg-yellow-500/10 text-yellow-400';
  };

  const getStatusLabel = (promo) => {
    const now = new Date();
    const start = new Date(promo.startTime);
    const end = new Date(promo.endTime);
    
    if (now > end) return 'Ended';
    if (now >= start && now <= end) return 'Active';
    return 'Scheduled';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold heading-display">Promotions</h1>
            <p className="text-muted">Create targeted offers to fill your venue</p>
          </div>
          
          <div className="flex items-center gap-3">
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
            
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 btn-primary px-4 py-2 rounded-lg font-semibold"
            >
              <Plus className="h-5 w-5" />
              New Promotion
            </button>
          </div>
        </div>

        {/* Promotions List */}
        {promotions.length === 0 ? (
          <div className="panel rounded-xl p-12 text-center">
            <Zap className="h-12 w-12 text-[#f2a65a] mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2 heading-display">No promotions yet</h3>
            <p className="text-muted mb-6">
              Create your first promotion to attract customers when the crowd is low
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 btn-primary px-6 py-3 rounded-lg font-semibold"
            >
              <Plus className="h-5 w-5" />
              Create Promotion
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {promotions.map(promo => (
              <div key={promo.id} className="panel-soft rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold heading-display">{promo.title}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(promo)}`}>
                        {getStatusLabel(promo)}
                      </span>
                    </div>
                    
                    <p className="text-muted text-sm mb-3">{promo.description}</p>
                    
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="text-muted">
                        {getPromoTypeLabel(promo.promoType)}
                      </span>
                      {promo.discountPercent && (
                        <span className="text-emerald-300">{promo.discountPercent}% off</span>
                      )}
                      <span className="flex items-center gap-1 text-muted">
                        <Clock className="h-4 w-4" />
                        {format(new Date(promo.startTime), 'MMM d, h:mm a')} - {format(new Date(promo.endTime), 'h:mm a')}
                      </span>
                      {promo.capacityTrigger && (
                        <span className="flex items-center gap-1 text-muted">
                          <Users className="h-4 w-4" />
                          Shows when under {promo.capacityTrigger}% capacity
                        </span>
                      )}
                    </div>
                    
                    <div className="flex gap-6 mt-4 text-sm text-muted">
                      <span>
                        <span className="text-white font-medium">{promo.impressions}</span> impressions
                      </span>
                      <span>
                        <span className="text-white font-medium">{promo.clicks}</span> clicks
                      </span>
                      {promo.impressions > 0 && (
                        <span>
                          <span className="text-white font-medium">
                            {((promo.clicks / promo.impressions) * 100).toFixed(1)}%
                          </span> CTR
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDelete(promo.id)}
                    className="text-muted hover:text-red-300 p-2"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <CreatePromoModal
          venueId={selectedVenue?.id}
          onClose={() => setShowModal(false)}
          onCreated={(promo) => {
            setPromotions([promo, ...promotions]);
            setShowModal(false);
          }}
        />
      )}
    </DashboardLayout>
  );
}

function CreatePromoModal({ venueId, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    promoType: 'happy_hour',
    discountPercent: '',
    startTime: '',
    endTime: '',
    capacityTrigger: '',
    targetAudience: 'all',
    pushNotification: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = {
        ...formData,
        discountPercent: formData.discountPercent ? parseInt(formData.discountPercent) : undefined,
        capacityTrigger: formData.capacityTrigger ? parseInt(formData.capacityTrigger) : undefined,
      };
      
      const response = await promotionsApi.createPromotion(venueId, data);
      onCreated(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create promotion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      
      <div className="relative panel w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#102033] px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-semibold heading-display">Create Promotion</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-muted mb-2">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="field"
              placeholder="Half-price drinks until 8pm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="field h-20"
              placeholder="Get 50% off all drinks during happy hour..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-2">Type</label>
              <select
                value={formData.promoType}
                onChange={(e) => setFormData({ ...formData, promoType: e.target.value })}
                className="field"
              >
                <option value="happy_hour">Happy Hour</option>
                <option value="event">Event</option>
                <option value="discount">Discount</option>
                <option value="special">Special</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-2">Discount %</label>
              <input
                type="number"
                value={formData.discountPercent}
                onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                className="field"
                placeholder="20"
                min="0"
                max="100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-2">Start Time</label>
              <input
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-2">End Time</label>
              <input
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="field"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Show when capacity is under (%)
            </label>
            <input
              type="number"
              value={formData.capacityTrigger}
              onChange={(e) => setFormData({ ...formData, capacityTrigger: e.target.value })}
              className="field"
              placeholder="40"
              min="0"
              max="100"
            />
            <p className="text-muted text-xs mt-1">Leave empty to show always during promo period</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-2">Target Audience</label>
            <select
              value={formData.targetAudience}
              onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              className="field"
            >
              <option value="all">All Users</option>
              <option value="nearby">Nearby Users</option>
              <option value="lowkey_seekers">Lowkey Seekers</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary font-semibold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Promotion'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
