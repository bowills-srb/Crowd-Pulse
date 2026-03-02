import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { crowdScale, palette } from '../theme/palette';

const getCrowdColor = (percentage) => {
  if (!percentage) return palette.textSoft;
  if (percentage < 30) return crowdScale.quiet;
  if (percentage < 60) return crowdScale.moderate;
  if (percentage < 80) return crowdScale.busy;
  return crowdScale.packed;
};

const getCrowdEmoji = (percentage) => {
  if (!percentage) return '❓';
  if (percentage < 30) return '😌';
  if (percentage < 60) return '🙂';
  if (percentage < 80) return '😊';
  return '🔥';
};

const VenueMarker = ({ venue, onPress }) => {
  const crowdPercentage = venue.crowd?.percentage;
  const color = getCrowdColor(crowdPercentage);
  const hasFriends = venue.friendsHere > 0;

  return (
    <Marker
      coordinate={{
        latitude: venue.location.latitude,
        longitude: venue.location.longitude,
      }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={styles.container}>
        {/* Main marker */}
        <View style={[styles.marker, { borderColor: color }]}>
          {crowdPercentage !== null ? (
            <Text style={styles.percentage}>{Math.round(crowdPercentage)}%</Text>
          ) : (
            <Text style={styles.unknown}>?</Text>
          )}
          
          {/* Trend indicator */}
          {venue.crowd?.trend === 'filling_up' && (
            <View style={styles.trendUp}>
              <Text style={styles.trendText}>↑</Text>
            </View>
          )}
        </View>

        {/* Friends badge */}
        {hasFriends && (
          <View style={styles.friendsBadge}>
            <Text style={styles.friendsCount}>{venue.friendsHere}</Text>
          </View>
        )}

        {/* Venue name */}
        <View style={styles.nameContainer}>
          <Text style={styles.venueName} numberOfLines={1}>
            {venue.name}
          </Text>
        </View>
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  marker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.bgSoft,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentage: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '700',
  },
  unknown: {
    color: palette.textSoft,
    fontSize: 14,
    fontWeight: '600',
  },
  trendUp: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: crowdScale.packed,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendText: {
    color: palette.text,
    fontSize: 10,
    fontWeight: '700',
  },
  friendsBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    backgroundColor: palette.accent,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  friendsCount: {
    color: '#032824',
    fontSize: 11,
    fontWeight: '700',
  },
  nameContainer: {
    backgroundColor: 'rgba(10, 24, 38, 0.82)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    maxWidth: 100,
  },
  venueName: {
    color: palette.text,
    fontSize: 10,
    fontWeight: '500',
  },
});

export default VenueMarker;
