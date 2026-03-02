import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { MapPin, Users, TrendingUp, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { AnimatedCrowdBar, PulsingDot } from './Animated';

const getCrowdInfo = (percentage) => {
  if (!percentage && percentage !== 0) return { label: 'Unknown', color: '#666', emoji: '❓' };
  if (percentage < 30) return { label: 'Quiet', color: '#22c55e', emoji: '😌' };
  if (percentage < 60) return { label: 'Moderate', color: '#eab308', emoji: '🙂' };
  if (percentage < 80) return { label: 'Busy', color: '#f97316', emoji: '😊' };
  return { label: 'Packed', color: '#ef4444', emoji: '🔥' };
};

const VenueCard = ({ venue, onPress, style }) => {
  const crowdInfo = getCrowdInfo(venue.crowd?.percentage);
  const hasPromo = venue.activePromo;
  const friendsHere = venue.friendsHere || 0;
  const isTrending = venue.crowd?.trend === 'filling_up';

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(venue);
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Image / Placeholder */}
      <View style={styles.imageContainer}>
        {venue.imageUrl ? (
          <Image source={{ uri: venue.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.categoryEmoji}>
              {venue.category === 'bar' ? '🍺' : 
               venue.category === 'club' ? '🎵' : 
               venue.category === 'restaurant' ? '🍽️' : 
               venue.category === 'cafe' ? '☕' : '📍'}
            </Text>
          </View>
        )}
        
        {/* Promo badge */}
        {hasPromo && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoText}>🔥 {venue.activePromo}</Text>
          </View>
        )}
        
        {/* Trending indicator */}
        {isTrending && (
          <View style={styles.trendingBadge}>
            <TrendingUp size={12} color="#fff" />
            <Text style={styles.trendingText}>Filling up</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{venue.name}</Text>
          {friendsHere > 0 && (
            <View style={styles.friendsBadge}>
              <Users size={12} color="#6366f1" />
              <Text style={styles.friendsText}>{friendsHere}</Text>
            </View>
          )}
        </View>

        <View style={styles.location}>
          <MapPin size={12} color="#666" />
          <Text style={styles.locationText} numberOfLines={1}>
            {venue.distance ? `${venue.distance} • ` : ''}{venue.address || venue.category}
          </Text>
        </View>

        {/* Crowd indicator */}
        <View style={styles.crowdSection}>
          <View style={styles.crowdHeader}>
            <View style={styles.crowdLabelContainer}>
              <PulsingDot color={crowdInfo.color} size={6} />
              <Text style={[styles.crowdLabel, { color: crowdInfo.color }]}>
                {crowdInfo.label}
              </Text>
            </View>
            <Text style={styles.crowdPercent}>
              {venue.crowd?.percentage != null ? `${Math.round(venue.crowd.percentage)}%` : '?'}
            </Text>
          </View>
          <AnimatedCrowdBar 
            percentage={venue.crowd?.percentage || 0} 
            color={crowdInfo.color}
            height={6}
          />
        </View>

        {/* Wait time (if available) */}
        {venue.waitTime && (
          <View style={styles.waitTime}>
            <Clock size={12} color="#888" />
            <Text style={styles.waitTimeText}>{venue.waitTime} min wait</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 120,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryEmoji: {
    fontSize: 32,
  },
  promoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  promoText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  trendingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  content: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  friendsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  friendsText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  locationText: {
    color: '#666',
    fontSize: 12,
    flex: 1,
  },
  crowdSection: {
    gap: 6,
  },
  crowdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  crowdLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  crowdLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  crowdPercent: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  waitTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  waitTimeText: {
    color: '#888',
    fontSize: 12,
  },
});

export default VenueCard;
