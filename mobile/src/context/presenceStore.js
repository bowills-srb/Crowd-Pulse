import { create } from 'zustand';
import { presenceApi } from '../services/api';
import socketService from '../services/socket';

export const usePresenceStore = create((set, get) => ({
  myPresence: null,
  friendsPresence: [],
  isLoading: false,
  error: null,

  // Fetch current presence
  fetchMyPresence: async () => {
    try {
      const response = await presenceApi.getMyPresence();
      set({ myPresence: response.data });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch presence:', error);
    }
  },

  // Set status to "going out"
  goingOut: async (sharingMode = 'all_friends', sharingWith = []) => {
    set({ isLoading: true, error: null });
    try {
      const response = await presenceApi.goingOut(sharingMode, sharingWith);
      set({ myPresence: response.data, isLoading: false });
      
      // Broadcast via socket
      socketService.updatePresence({
        status: 'going_out',
        sharingMode,
        sharingWith,
      });
      
      return response.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to set status';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  // Check in to venue
  checkIn: async (venueId, sharingMode = 'all_friends', sharingWith = []) => {
    set({ isLoading: true, error: null });
    try {
      const response = await presenceApi.checkIn(venueId, sharingMode, sharingWith);
      set({ myPresence: response.data, isLoading: false });
      
      socketService.updatePresence({
        status: 'at_venue',
        venueId,
        sharingMode,
        sharingWith,
      });
      
      return response.data;
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to check in';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  // Update location
  updateLocation: async (latitude, longitude, venueId = null) => {
    try {
      await presenceApi.updateLocation(latitude, longitude, venueId);
      socketService.pingLocation(latitude, longitude, venueId);
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  },

  // Stop sharing
  stopSharing: async () => {
    set({ isLoading: true });
    try {
      await presenceApi.stop();
      set({ myPresence: { status: 'offline', sharing: false }, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  // Fetch friends' presence (for radar)
  fetchFriendsPresence: async () => {
    try {
      const response = await presenceApi.getFriendsPresence();
      set({ friendsPresence: response.data.friends });
      return response.data.friends;
    } catch (error) {
      console.error('Failed to fetch friends presence:', error);
      return [];
    }
  },

  // Update friend presence from socket event
  updateFriendPresence: (update) => {
    set((state) => {
      const index = state.friendsPresence.findIndex(f => f.id === update.userId);
      if (index >= 0) {
        const newPresence = [...state.friendsPresence];
        newPresence[index] = { ...newPresence[index], ...update };
        return { friendsPresence: newPresence };
      } else {
        return { friendsPresence: [...state.friendsPresence, update] };
      }
    });
  },

  // Remove friend from presence list (went offline)
  removeFriendPresence: (userId) => {
    set((state) => ({
      friendsPresence: state.friendsPresence.filter(f => f.id !== userId),
    }));
  },

  // Setup socket listeners
  setupSocketListeners: () => {
    const unsubPresence = socketService.onPresenceUpdate((data) => {
      get().updateFriendPresence(data);
    });

    const unsubLocation = socketService.onLocationUpdate((data) => {
      get().updateFriendPresence(data);
    });

    const unsubOffline = socketService.onFriendOffline((data) => {
      get().removeFriendPresence(data.userId);
    });

    return () => {
      unsubPresence();
      unsubLocation();
      unsubOffline();
    };
  },

  clearError: () => set({ error: null }),
}));
