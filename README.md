# CrowdPulse

Real-time venue crowd intelligence and social coordination platform.

**"Know before you go"**

## Overview

CrowdPulse is a mobile application that provides real-time venue crowd levels combined with a social coordination layer. Users can:

- **See how busy venues are** before arriving (lively vs lowkey vibes)
- **Find friends** who are out and see where they're heading
- **Share location** with selected friend groups ephemerally
- **Ping friends** to coordinate meetups at specific venues
- **Check in** to venues and see who else is there

## Tech Stack

### Backend
- **Runtime**: Node.js + Express
- **Database**: PostgreSQL with PostGIS (spatial queries)
- **Cache**: Redis (real-time presence)
- **Real-time**: Socket.io
- **Auth**: JWT + SMS OTP

### Mobile
- **Framework**: React Native (Expo)
- **Navigation**: React Navigation
- **State**: Zustand
- **Maps**: react-native-maps

## Getting Started

See backend and mobile directories for setup instructions.

---

# CrowdPulse 📍

Real-time venue crowd intelligence and social coordination platform. Know before you go.

## Overview

CrowdPulse helps users discover how busy venues are in real-time, coordinate with friends, and find the perfect spot for their night out.

### Key Features

- **Crowd Intelligence**: See real-time crowd levels at nearby venues
- **Vibe Filtering**: Switch between "Lively" (packed spots) and "Lowkey" (chill places)
- **Social Layer**: See where friends are going, share your status
- **Venue Pings**: Invite friends to venues with one tap
- **Ephemeral Sharing**: Time-limited location sharing that auto-expires
- **Group Management**: Organize friends into groups for granular sharing

## Architecture

```
crowdpulse/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── config/       # Database & Redis config
│   │   ├── models/       # Data models (User, Venue, etc.)
│   │   ├── routes/       # API endpoints
│   │   ├── middleware/   # Auth, validation
│   │   ├── services/     # Business logic
│   │   └── index.js      # Server entry point
│   ├── migrations/       # Database migrations
│   └── package.json
│
└── mobile/               # React Native (Expo) app
    ├── src/
    │   ├── screens/      # App screens
    │   ├── components/   # Reusable UI components
    │   ├── navigation/   # React Navigation setup
    │   ├── services/     # API & Socket.io clients
    │   ├── context/      # Zustand stores
    │   └── hooks/        # Custom hooks
    ├── App.tsx
    └── package.json
```

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with PostGIS (spatial queries)
- **Cache/Realtime**: Redis
- **WebSockets**: Socket.io
- **Auth**: JWT + SMS OTP (Twilio)

### Mobile
- **Framework**: React Native (Expo)
- **Navigation**: React Navigation 6
- **State**: Zustand
- **Maps**: react-native-maps
- **Location**: expo-location
- **Realtime**: socket.io-client

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ with PostGIS extension
- Redis 7+
- Expo CLI (`npm install -g expo-cli`)

### Backend Setup

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Setup PostgreSQL with PostGIS**
   ```sql
   CREATE DATABASE crowdpulse;
   \c crowdpulse
   CREATE EXTENSION postgis;
   CREATE EXTENSION "uuid-ossp";
   ```

4. **Run migrations**
   ```bash
   npm run migrate
   ```

5. **Start the server**
   ```bash
   npm run dev
   ```

   Server runs on `http://localhost:3000`

### Mobile Setup

1. **Install dependencies**
   ```bash
   cd mobile
   npm install
   ```

2. **Configure API URL**
   Create `.env` file:
   ```
   EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3000/api
   EXPO_PUBLIC_SOCKET_URL=http://YOUR_LOCAL_IP:3000
   ```

3. **Start Expo**
   ```bash
   npx expo start
   ```

4. **Run on device/simulator**
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app

## API Endpoints

### Auth
- `POST /api/auth/send-code` - Send OTP
- `POST /api/auth/verify` - Verify OTP & login
- `POST /api/auth/refresh` - Refresh tokens
- `GET /api/auth/me` - Current user

### Venues
- `GET /api/venues/nearby` - Nearby venues with crowd data
- `GET /api/venues/search` - Search venues
- `GET /api/venues/:id` - Venue details
- `GET /api/venues/discover/trending` - Trending venues
- `GET /api/venues/discover/quiet` - Quiet venues

### Presence
- `POST /api/presence/going-out` - Set "going out" status
- `POST /api/presence/check-in` - Check into venue
- `PUT /api/presence/location` - Update location
- `POST /api/presence/stop` - Stop sharing
- `GET /api/presence/friends` - Friends' presence

### Friends
- `GET /api/friends` - List friends
- `GET /api/friends/requests` - Pending requests
- `POST /api/friends/request/:userId` - Send request
- `POST /api/friends/accept/:id` - Accept request

### Groups
- `GET /api/groups` - User's groups
- `POST /api/groups` - Create group
- `POST /api/groups/:id/members/:userId` - Add member

### Pings
- `POST /api/pings` - Send venue ping
- `GET /api/pings/received` - Received pings
- `POST /api/pings/:id/respond` - Respond to ping

## WebSocket Events

### Client → Server
- `subscribe:friends` - Subscribe to friend updates
- `presence:update` - Send location update
- `presence:goingOut` - Set going out status
- `presence:checkIn` - Check into venue
- `ping:send` - Send venue ping
- `ping:respond` - Respond to ping

### Server → Client
- `friend:presence` - Friend location update
- `friend:goingOut` - Friend went out
- `friend:checkIn` - Friend checked in
- `ping:received` - New ping received
- `ping:response` - Response to your ping

## Data Models

### User
- Phone-based authentication
- Display name, avatar
- Vibe preference (lively/lowkey/any)
- Privacy settings

### Venue
- PostGIS geography point for location
- Category, capacity, metadata
- External place ID (Google/Foursquare)

### Crowd Reading
- Estimated count & capacity %
- Source (user pings, venue reported, etc.)
- Confidence level, trend

### User Presence
- Status (going_out, at_venue, offline)
- Sharing mode & permissions
- Ephemeral expiration

### Friendship
- Mutual connections
- Pending/accepted/blocked states

### Group
- Owner + members with roles
- Used for granular sharing

### Venue Ping
- Sender, venue, target (group/individual/all)
- Responses (in/out/maybe)

## Roadmap

### MVP (Current)
- [x] Core data models
- [x] Auth system
- [x] Venues API with crowd data
- [x] Presence & location sharing
- [x] Friends & groups
- [x] Venue pings
- [x] Real-time WebSocket events
- [x] Mobile app scaffold

### Phase 2
- [ ] Venue B2B dashboard
- [ ] Push notifications
- [ ] Historical crowd predictions
- [ ] Venue photos & reviews
- [ ] Check-in gamification

### Phase 3
- [ ] Promoted venues/deals
- [ ] Event integration
- [ ] Social sharing
- [ ] Analytics dashboard

## License

Proprietary - All rights reserved
