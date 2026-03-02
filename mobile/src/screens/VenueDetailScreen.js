import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  X, 
  MapPin, 
  Users, 
  TrendingUp, 
  Clock,
  Send,
  Navigation,
  CheckCircle,
} from 'lucide-react-native';

import { venuesApi, presenceApi } from '../services/api';
import { crowdScale, palette, spacing, radius, type } from '../theme/palette';
import PrimaryButton from '../components/ui/PrimaryButton';

const VenueDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { venueId, venue: initialVenue } = route.params;
  
  const [venue, setVenue] = useState(initialVenue || null);
  const [isLoading, setIsLoading] = useState(!initialVenue);

  useEffect(() => {
    fetchVenueDetails();
  }, [venueId]);

  const fetchVenueDetails = async () => {
    try {
      const response = await venuesApi.getVenue(venueId);
      setVenue(response.data);
    } catch (error) {
      console.error('Failed to fetch venue:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      await presenceApi.checkIn(venueId);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to check in:', error);
    }
  };

  const getCrowdColor = (percentage) => {
    if (!percentage) return palette.textSoft;
    if (percentage < 30) return crowdScale.quiet;
    if (percentage < 60) return crowdScale.moderate;
    if (percentage < 80) return crowdScale.busy;
    return crowdScale.packed;
  };

  const getCrowdLabel = (percentage) => {
    if (!percentage) return 'Unknown';
    if (percentage < 30) return 'Quiet';
    if (percentage < 60) return 'Moderate';
    if (percentage < 80) return 'Busy';
    return 'Packed';
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  const crowdPercentage = venue?.crowd?.percentage;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <X size={24} color={palette.text} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Venue Info */}
        <View style={styles.venueHeader}>
          <Text style={styles.venueName}>{venue?.name}</Text>
          <View style={styles.venueCategory}>
            <MapPin size={14} color={palette.textMuted} />
            <Text style={styles.categoryText}>{venue?.category}</Text>
          </View>
          <Text style={styles.venueAddress}>{venue?.address}</Text>
        </View>

        {/* Crowd Level */}
        <View style={styles.crowdCard}>
          <View style={styles.crowdHeader}>
            <Text style={styles.crowdTitle}>Current Crowd</Text>
            {venue?.crowd?.trend === 'filling_up' && (
              <View style={styles.trendBadge}>
                <TrendingUp size={14} color="#ef4444" />
                <Text style={styles.trendText}>Filling up</Text>
              </View>
            )}
          </View>
          
          <View style={styles.crowdMeter}>
            <View style={styles.crowdBarBg}>
              <View 
                style={[
                  styles.crowdBarFill, 
                  { 
                    width: `${crowdPercentage || 0}%`,
                    backgroundColor: getCrowdColor(crowdPercentage),
                  }
                ]} 
              />
            </View>
            <View style={styles.crowdLabels}>
              <Text style={[styles.crowdPercentage, { color: getCrowdColor(crowdPercentage) }]}>
                {crowdPercentage ? `${Math.round(crowdPercentage)}%` : '?'}
              </Text>
              <Text style={styles.crowdLabel}>{getCrowdLabel(crowdPercentage)}</Text>
            </View>
          </View>

          {venue?.crowd?.lastUpdate && (
            <View style={styles.lastUpdate}>
              <Clock size={12} color={palette.textSoft} />
              <Text style={styles.lastUpdateText}>
                Updated {new Date(venue.crowd.lastUpdate).toLocaleTimeString()}
              </Text>
            </View>
          )}
        </View>

        {/* Friends Here */}
        {venue?.friendsHere?.length > 0 && (
          <View style={styles.friendsCard}>
            <Text style={styles.cardTitle}>
              <Users size={16} color={palette.accent} /> Friends Here
            </Text>
            <View style={styles.friendsList}>
              {venue.friendsHere.map(friend => (
                <View key={friend.id} style={styles.friendChip}>
                  {friend.avatarUrl ? (
                    <Image source={{ uri: friend.avatarUrl }} style={styles.friendAvatar} />
                  ) : (
                    <View style={styles.friendAvatarPlaceholder}>
                      <Text style={styles.friendInitial}>{friend.displayName[0]}</Text>
                    </View>
                  )}
                  <Text style={styles.friendName}>{friend.displayName}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Hourly Trends */}
        {venue?.hourlyAverages?.length > 0 && (
          <View style={styles.trendsCard}>
            <Text style={styles.cardTitle}>Typical Crowd Today</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.hourlyBars}>
                {venue.hourlyAverages.map(hour => (
                  <View key={hour.hour} style={styles.hourBar}>
                    <View style={styles.barContainer}>
                      <View 
                        style={[
                          styles.bar, 
                          { 
                            height: `${hour.avgCapacity}%`,
                            backgroundColor: getCrowdColor(hour.avgCapacity),
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.hourLabel}>
                      {hour.hour > 12 ? hour.hour - 12 : hour.hour}
                      {hour.hour >= 12 ? 'p' : 'a'}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + 20 }]}>
        <PrimaryButton
          title="Ping Friends"
          variant="secondary"
          leftIcon={<Send size={20} color={palette.accent} />}
          style={styles.actionButton}
        />
        <PrimaryButton
          title="Check In"
          onPress={handleCheckIn}
          leftIcon={<CheckCircle size={20} color="#032824" />}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md - 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radius.round,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.stroke,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  venueHeader: {
    marginBottom: spacing.xxl,
  },
  venueName: {
    fontSize: type.hero - 2,
    fontWeight: '700',
    color: palette.text,
  },
  venueCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 4,
  },
  categoryText: {
    color: palette.textMuted,
    fontSize: type.sm,
    textTransform: 'capitalize',
  },
  venueAddress: {
    color: palette.textSoft,
    fontSize: type.sm,
    marginTop: spacing.xs,
  },
  crowdCard: {
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.stroke,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  crowdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  crowdTitle: {
    color: palette.text,
    fontSize: type.md,
    fontWeight: '600',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(241, 111, 111, 0.16)',
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    gap: 4,
  },
  trendText: {
    color: crowdScale.packed,
    fontSize: type.xs,
    fontWeight: '500',
  },
  crowdMeter: {
    gap: 12,
  },
  crowdBarBg: {
    height: 12,
    backgroundColor: palette.bgElevated,
    borderRadius: radius.sm - 2,
    overflow: 'hidden',
  },
  crowdBarFill: {
    height: '100%',
    borderRadius: radius.sm - 2,
  },
  crowdLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crowdPercentage: {
    fontSize: type.hero + 2,
    fontWeight: '700',
  },
  crowdLabel: {
    color: palette.textMuted,
    fontSize: type.sm,
  },
  lastUpdate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: 4,
  },
  lastUpdateText: {
    color: palette.textSoft,
    fontSize: type.xs,
  },
  friendsCard: {
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.stroke,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    color: palette.text,
    fontSize: type.md,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  friendsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bgCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
    gap: 8,
  },
  friendAvatar: {
    width: 24,
    height: 24,
    borderRadius: radius.md,
  },
  friendAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: radius.md,
    backgroundColor: palette.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendInitial: {
    color: '#032824',
    fontSize: type.xs,
    fontWeight: '600',
  },
  friendName: {
    color: palette.text,
    fontSize: type.sm,
  },
  trendsCard: {
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.stroke,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  hourlyBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: 8,
  },
  hourBar: {
    alignItems: 'center',
    width: 30,
  },
  barContainer: {
    height: 80,
    width: 20,
    backgroundColor: palette.bgCard,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
  },
  hourLabel: {
    color: palette.textSoft,
    fontSize: type.xs - 2,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: 12,
    backgroundColor: palette.bg,
    borderTopWidth: 1,
    borderTopColor: palette.stroke,
  },
  actionButton: {
    flex: 1,
  },
});

export default VenueDetailScreen;
