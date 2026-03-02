import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';

const FriendMarker = ({ friend, onPress }) => {
  const initials = friend.displayName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  return (
    <Marker
      coordinate={{
        latitude: friend.location.latitude,
        longitude: friend.location.longitude,
      }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={styles.container}>
        <View style={styles.marker}>
          {friend.avatarUrl ? (
            <Image
              source={{ uri: friend.avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.initialsContainer}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}
          
          {/* Status indicator */}
          <View style={[
            styles.statusDot,
            friend.status === 'at_venue' && styles.statusAtVenue,
          ]} />
        </View>

        {/* Name */}
        <View style={styles.nameContainer}>
          <Text style={styles.name} numberOfLines={1}>
            {friend.displayName?.split(' ')[0]}
          </Text>
          {friend.venueName && (
            <Text style={styles.venueName} numberOfLines={1}>
              @ {friend.venueName}
            </Text>
          )}
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
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#6366f1',
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  initialsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#374151',
  },
  initials: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#0f0f0f',
  },
  statusAtVenue: {
    backgroundColor: '#6366f1',
  },
  nameContainer: {
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    maxWidth: 120,
  },
  name: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  venueName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    textAlign: 'center',
  },
});

export default FriendMarker;
