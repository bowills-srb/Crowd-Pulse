import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Zap, 
  Moon, 
  Navigation, 
  Radio,
  Users,
  ChevronUp,
} from 'lucide-react-native';

import { venuesApi } from '../../services/api';
import { usePresenceStore } from '../../context/presenceStore';
import { useAuthStore } from '../../context/authStore';
import VenueMarker from '../../components/VenueMarker';
import FriendMarker from '../../components/FriendMarker';
import GoingOutSheet from '../../components/GoingOutSheet';
import { palette, spacing, radius, type } from '../../theme/palette';

const { width, height } = Dimensions.get('window');

const VIBE_MODES = {
  ANY: 'any',
  LIVELY: 'lively',
  LOWKEY: 'lowkey',
};

const RadarScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const { user } = useAuthStore();
  const { 
    myPresence, 
    friendsPresence, 
    goingOut, 
    fetchFriendsPresence,
    setupSocketListeners,
  } = usePresenceStore();

  const [location, setLocation] = useState(null);
  const [venues, setVenues] = useState([]);
  const [vibeMode, setVibeMode] = useState(VIBE_MODES.ANY);
  const [isLoading, setIsLoading] = useState(true);
  const [showGoingOutSheet, setShowGoingOutSheet] = useState(false);

  // Get user location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        setIsLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  // Fetch venues when location changes
  useEffect(() => {
    if (location) {
      fetchVenues();
    }
  }, [location, vibeMode]);

  // Setup socket listeners
  useEffect(() => {
    const unsubscribe = setupSocketListeners();
    return unsubscribe;
  }, []);

  // Fetch friends presence periodically
  useEffect(() => {
    fetchFriendsPresence();
    const interval = setInterval(fetchFriendsPresence, 30000); // Every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchVenues = async () => {
    if (!location) return;
    
    setIsLoading(true);
    try {
      const response = await venuesApi.getNearby(
        location.latitude,
        location.longitude,
        { vibe: vibeMode, radius: 5000 }
      );
      setVenues(response.data.venues);
    } catch (error) {
      console.error('Failed to fetch venues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const centerOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  };

  const handleVenuePress = (venue) => {
    navigation.navigate('VenueDetail', { venueId: venue.id, venue });
  };

  const handleFriendPress = (friend) => {
    if (friend.venueId) {
      navigation.navigate('VenueDetail', { venueId: friend.venueId });
    }
  };

  const handleGoingOut = async (sharingMode, sharingWith) => {
    await goingOut(sharingMode, sharingWith);
    setShowGoingOutSheet(false);
  };

  const isGoingOut = myPresence?.status === 'going_out' || myPresence?.status === 'at_venue';

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        customMapStyle={darkMapStyle}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Venue markers */}
        {venues.map((venue) => (
          <VenueMarker
            key={venue.id}
            venue={venue}
            onPress={() => handleVenuePress(venue)}
          />
        ))}

        {/* Friend markers */}
        {friendsPresence.map((friend) => (
          friend.location && (
            <FriendMarker
              key={friend.id}
              friend={friend}
              onPress={() => handleFriendPress(friend)}
            />
          )
        ))}
      </MapView>

      {/* Top controls */}
      <View style={[styles.topControls, { paddingTop: insets.top + 10 }]}>
        {/* Vibe mode toggle */}
        <View style={styles.vibeModeContainer}>
          <TouchableOpacity
            style={[
              styles.vibeModeButton,
              vibeMode === VIBE_MODES.LIVELY && styles.vibeModeActive,
            ]}
            onPress={() => setVibeMode(vibeMode === VIBE_MODES.LIVELY ? VIBE_MODES.ANY : VIBE_MODES.LIVELY)}
          >
            <Zap size={18} color={vibeMode === VIBE_MODES.LIVELY ? '#032824' : palette.textMuted} />
            <Text style={[
              styles.vibeModeText,
              vibeMode === VIBE_MODES.LIVELY && styles.vibeModeTextActive,
            ]}>
              Lively
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.vibeModeButton,
              vibeMode === VIBE_MODES.LOWKEY && styles.vibeModeActive,
            ]}
            onPress={() => setVibeMode(vibeMode === VIBE_MODES.LOWKEY ? VIBE_MODES.ANY : VIBE_MODES.LOWKEY)}
          >
            <Moon size={18} color={vibeMode === VIBE_MODES.LOWKEY ? '#032824' : palette.textMuted} />
            <Text style={[
              styles.vibeModeText,
              vibeMode === VIBE_MODES.LOWKEY && styles.vibeModeTextActive,
            ]}>
              Lowkey
            </Text>
          </TouchableOpacity>
        </View>

        {/* Friends out count */}
        {friendsPresence.length > 0 && (
          <View style={styles.friendsOutBadge}>
            <Users size={14} color={palette.accent} />
            <Text style={styles.friendsOutText}>
              {friendsPresence.length} out
            </Text>
          </View>
        )}
      </View>

      {/* Map controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.mapButton} onPress={centerOnUser}>
          <Navigation size={20} color={palette.text} />
        </TouchableOpacity>
      </View>

      {/* Going out button */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 100 }]}>
        <TouchableOpacity
          style={[
            styles.goingOutButton,
            isGoingOut && styles.goingOutButtonActive,
          ]}
          onPress={() => setShowGoingOutSheet(true)}
        >
          <Radio 
            size={20} 
            color={isGoingOut ? '#032824' : palette.accent} 
          />
          <Text style={[
            styles.goingOutText,
            isGoingOut && styles.goingOutTextActive,
          ]}>
            {isGoingOut ? 'Sharing Location' : 'Going Out?'}
          </Text>
          <ChevronUp 
            size={18} 
            color={isGoingOut ? '#032824' : palette.accent} 
          />
        </TouchableOpacity>
      </View>

      {/* Going out bottom sheet */}
      <GoingOutSheet
        visible={showGoingOutSheet}
        onClose={() => setShowGoingOutSheet(false)}
        onConfirm={handleGoingOut}
        currentPresence={myPresence}
      />
    </View>
  );
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e0e' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.bg,
  },
  loadingText: {
    color: palette.textMuted,
    marginTop: spacing.md,
    fontSize: type.sm,
  },
  map: {
    flex: 1,
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vibeModeContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(12, 33, 49, 0.92)',
    borderRadius: radius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
  vibeModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.lg,
    gap: 6,
  },
  vibeModeActive: {
    backgroundColor: palette.accent,
  },
  vibeModeText: {
    color: palette.textMuted,
    fontSize: type.xs + 1,
    fontWeight: '600',
  },
  vibeModeTextActive: {
    color: '#032824',
  },
  friendsOutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(54, 208, 198, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(54, 208, 198, 0.25)',
  },
  friendsOutText: {
    color: palette.accent,
    fontSize: type.xs + 1,
    fontWeight: '600',
  },
  mapControls: {
    position: 'absolute',
    right: spacing.lg,
    top: '45%',
  },
  mapButton: {
    backgroundColor: 'rgba(12, 33, 49, 0.92)',
    width: 44,
    height: 44,
    borderRadius: radius.round,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.stroke,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  goingOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 33, 49, 0.95)',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.round,
    gap: 10,
    borderWidth: 1,
    borderColor: palette.accent,
  },
  goingOutButtonActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  goingOutText: {
    color: palette.accent,
    fontSize: type.sm + 1,
    fontWeight: '700',
  },
  goingOutTextActive: {
    color: '#032824',
  },
});

export default RadarScreen;
