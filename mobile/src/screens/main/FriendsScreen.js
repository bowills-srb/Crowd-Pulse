import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, UserPlus, Users, ChevronRight, Radio } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { friendsApi, groupsApi } from '../../services/api';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { palette } from '../../theme/palette';

const FriendsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('friends');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [friendsRes, groupsRes, requestsRes] = await Promise.all([
        friendsApi.getFriends(),
        groupsApi.getGroups(),
        friendsApi.getRequests(),
      ]);
      setFriends(friendsRes.data.friends);
      setGroups(groupsRes.data.groups);
      setPendingRequests(requestsRes.data.requests);
    } catch (error) {
      console.error('Failed to fetch friends data:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const filteredFriends = friends.filter(friend =>
    friend.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFriendItem = ({ item }) => {
    const initials = item.displayName
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <TouchableOpacity style={styles.friendItem}>
        <View style={styles.avatarContainer}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}
          {item.isOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.displayName}</Text>
          {item.status && (
            <View style={styles.statusContainer}>
              <Radio size={12} color="#36d0c6" />
              <Text style={styles.statusText}>Going out</Text>
            </View>
          )}
        </View>
        <ChevronRight size={20} color="#547186" />
      </TouchableOpacity>
    );
  };

  const renderGroupItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.groupItem}
      onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
    >
      <View style={styles.groupIcon}>
        <Text style={styles.groupEmoji}>{item.emoji || '👥'}</Text>
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupMembers}>{item.memberCount} members</Text>
      </View>
      <ChevronRight size={20} color="#547186" />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <ScreenHeader
        title="Friends"
        right={(
          <TouchableOpacity style={styles.addButton}>
            <UserPlus size={22} color={palette.accent} />
          </TouchableOpacity>
        )}
      />

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={18} color="#6f879b" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search friends..."
          placeholderTextColor="#6f879b"
        />
      </View>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <TouchableOpacity style={styles.requestsBanner}>
          <View style={styles.requestsBadge}>
            <Text style={styles.requestsCount}>{pendingRequests.length}</Text>
          </View>
          <Text style={styles.requestsText}>Pending friend requests</Text>
          <ChevronRight size={18} color="#36d0c6" />
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>
            Groups ({groups.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {activeTab === 'friends' ? (
        <FlatList
          data={filteredFriends}
          renderItem={renderFriendItem}
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
              <Users size={48} color="#18354e" />
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptyText}>Add friends to see them here</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroupItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#36d0c6"
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(54, 208, 198, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d2233',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#fff',
  },
  requestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  requestsBadge: {
    backgroundColor: '#36d0c6',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  requestsCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  requestsText: {
    flex: 1,
    color: '#36d0c6',
    fontSize: 14,
    fontWeight: '500',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
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
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0d2233',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#07141f',
  },
  friendInfo: {
    flex: 1,
    marginLeft: 14,
  },
  friendName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  statusText: {
    color: '#36d0c6',
    fontSize: 13,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0d2233',
  },
  groupIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#0d2233',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupEmoji: {
    fontSize: 24,
  },
  groupInfo: {
    flex: 1,
    marginLeft: 14,
  },
  groupName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  groupMembers: {
    color: '#8faac0',
    fontSize: 13,
    marginTop: 2,
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
  },
});

export default FriendsScreen;
