import { io } from 'socket.io-client';
import { getAccessToken } from './api';

const SOCKET_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://api.crowdpulse.app';

class SocketService {
  socket = null;
  listeners = new Map();

  connect() {
    const token = getAccessToken();
    if (!token) {
      console.warn('Cannot connect to socket: No access token');
      return;
    }

    if (this.socket?.connected) {
      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    // Re-register all listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket.on(event, callback);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
      this.socket?.off(event, callback);
    };
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
    this.socket?.off(event, callback);
  }

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  // =====================
  // PRESENCE EVENTS
  // =====================
  updatePresence(data) {
    this.emit('presence:update', data);
  }

  pingLocation(latitude, longitude, venueId) {
    this.emit('location:ping', { latitude, longitude, venueId });
  }

  onPresenceUpdate(callback) {
    return this.on('presence:update', callback);
  }

  onLocationUpdate(callback) {
    return this.on('location:update', callback);
  }

  // =====================
  // FRIEND EVENTS
  // =====================
  onFriendOnline(callback) {
    return this.on('friend:online', callback);
  }

  onFriendOffline(callback) {
    return this.on('friend:offline', callback);
  }

  // =====================
  // PING EVENTS
  // =====================
  sendPing(pingId, targetType, targetId, venue) {
    this.emit('ping:send', { pingId, targetType, targetId, venue });
  }

  respondToPing(pingId, senderId, response) {
    this.emit('ping:respond', { pingId, senderId, response });
  }

  onPingReceived(callback) {
    return this.on('ping:received', callback);
  }

  onPingResponse(callback) {
    return this.on('ping:response', callback);
  }

  // =====================
  // GROUP EVENTS
  // =====================
  joinGroup(groupId) {
    this.emit('group:join', groupId);
  }

  leaveGroup(groupId) {
    this.emit('group:leave', groupId);
  }
}

export const socketService = new SocketService();
export default socketService;
