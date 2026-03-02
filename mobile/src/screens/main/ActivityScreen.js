import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, MapPin, Check, X, Clock } from 'lucide-react-native';

import { pingsApi } from '../../services/api';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { palette } from '../../theme/palette';

const ActivityScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  
  const [receivedPings, setReceivedPings] = useState([]);
  const [sentPings, setSentPings] = useState([]);
  const [activeTab, setActiveTab] = useState('received');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchPings();
  }, []);

  const fetchPings = async () => {
    try {
      const [received, sent] = await Promise.all([
        pingsApi.getReceived(),
        pingsApi.getSent(),
      ]);
      setReceivedPings(received.data.pings);
      setSentPings(sent.data.pings);
    } catch (error) {
      console.error('Failed to fetch pings:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPings();
    setIsRefreshing(false);
  };

  const handleRespond = async (pingId, response) => {
    try {
      await pingsApi.respond(pingId, response);
      // Update local state
      setReceivedPings(prev =>
        prev.map(p => p.id === pingId ? { ...p, myResponse: response } : p)
      );
    } catch (error) {
      console.error('Failed to respond:', error);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const renderReceivedPing = ({ item }) => (
    <TouchableOpacity 
      style={styles.pingCard}
      onPress={() => navigation.navigate('PingDetail', { pingId: item.id })}
    >
      <View style={styles.pingHeader}>
        <View style={styles.pingIcon}>
          <MapPin size={20} color="#36d0c6" />
        </View>
        <View style={styles.pingInfo}>
          <Text style={styles.senderName}>{item.sender.name}</Text>
          <Text style={styles.pingTime}>{formatTime(item.sentAt)}</Text>
        </View>
      </View>
      
      <View style={styles.venueInfo}>
        <Text style={styles.venueName}>{item.venue.name}</Text>
        <Text style={styles.venueAddress}>{item.venue.address}</Text>
        {item.message && (
          <Text style={styles.pingMessage}>"{item.message}"</Text>
        )}
      </View>

      {!item.myResponse ? (
        <View style={styles.responseButtons}>
          <TouchableOpacity 
            style={[styles.responseButton, styles.responseIn]}
            onPress={() => handleRespond(item.id, 'in')}
          >
            <Check size={18} color="#fff" />
            <Text style={styles.responseText}>I'm in</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.responseButton, styles.responseMaybe]}
            onPress={() => handleRespond(item.id, 'maybe')}
          >
            <Clock size={18} color="#fff" />
            <Text style={styles.responseText}>Maybe</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.responseButton, styles.responseOut]}
            onPress={() => handleRespond(item.id, 'out')}
          >
            <X size={18} color="#fff" />
            <Text style={styles.responseText}>Out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.respondedBadge}>
          <Text style={styles.respondedText}>
            You responded: {item.myResponse === 'in' ? "I'm in" : item.myResponse}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderSentPing = ({ item }) => {
    const inCount = item.responses?.filter(r => r.response === 'in').length || 0;
    
    return (
      <TouchableOpacity 
        style={styles.pingCard}
        onPress={() => navigation.navigate('PingDetail', { pingId: item.id })}
      >
        <View style={styles.pingHeader}>
          <View style={styles.pingIcon}>
            <MapPin size={20} color="#22c55e" />
          </View>
          <View style={styles.pingInfo}>
            <Text style={styles.senderName}>You pinged {item.targetName}</Text>
            <Text style={styles.pingTime}>{formatTime(item.sentAt)}</Text>
          </View>
        </View>
        
        <View style={styles.venueInfo}>
          <Text style={styles.venueName}>{item.venue.name}</Text>
          {item.message && (
            <Text style={styles.pingMessage}>"{item.message}"</Text>
          )}
        </View>

        <View style={styles.responsesSummary}>
          <Text style={styles.responsesText}>
            {inCount > 0 ? `${inCount} people are in` : 'No responses yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const pings = activeTab === 'received' ? receivedPings : sentPings;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <ScreenHeader title="Activity" />

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'received' && styles.tabActive]}
          onPress={() => setActiveTab('received')}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
            Received ({receivedPings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.tabActive]}
          onPress={() => setActiveTab('sent')}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
            Sent ({sentPings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={pings}
        renderItem={activeTab === 'received' ? renderReceivedPing : renderSentPing}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#36d0c6"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Bell size={48} color="#18354e" />
            <Text style={styles.emptyTitle}>No pings yet</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'received' 
                ? 'When friends invite you somewhere, it will show here'
                : 'Ping friends to meet up at venues'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0d2233',
  },
  tabActive: {
    backgroundColor: '#36d0c6',
  },
  tabText: {
    color: '#8faac0',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
  },
  list: {
    paddingHorizontal: 20,
  },
  pingCard: {
    backgroundColor: '#0d2233',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  pingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pingInfo: {
    flex: 1,
  },
  senderName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  pingTime: {
    color: '#6f879b',
    fontSize: 13,
    marginTop: 2,
  },
  venueInfo: {
    backgroundColor: '#122b40',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  venueName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  venueAddress: {
    color: '#8faac0',
    fontSize: 13,
    marginTop: 2,
  },
  pingMessage: {
    color: '#36d0c6',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
  },
  responseButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  responseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  responseIn: {
    backgroundColor: '#22c55e',
  },
  responseMaybe: {
    backgroundColor: '#f59e0b',
  },
  responseOut: {
    backgroundColor: '#6f879b',
  },
  responseText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  respondedBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  respondedText: {
    color: '#36d0c6',
    fontSize: 14,
    fontWeight: '500',
  },
  responsesSummary: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  responsesText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    color: '#6f879b',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default ActivityScreen;
