import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  X, 
  Send, 
  Users, 
  User,
  Globe,
  Check,
  MapPin,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { friendsApi, groupsApi, pingsApi } from '../services/api';
import socketService from '../services/socket';

const TARGET_TYPES = [
  { id: 'all_friends', label: 'All Friends', icon: Globe, description: 'Everyone you\'re connected with' },
  { id: 'group', label: 'A Group', icon: Users, description: 'Specific friend group' },
  { id: 'individual', label: 'One Friend', icon: User, description: 'Send to specific person' },
];

const PingSheet = ({ visible, venue, onClose, onSuccess }) => {
  const insets = useSafeAreaInsets();
  
  const [targetType, setTargetType] = useState('all_friends');
  const [targetId, setTargetId] = useState(null);
  const [message, setMessage] = useState('');
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [step, setStep] = useState(1); // 1: select type, 2: select target (if needed), 3: message
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setTargetType('all_friends');
      setTargetId(null);
      setMessage('');
      loadData();
    }
  }, [visible]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [friendsRes, groupsRes] = await Promise.all([
        friendsApi.getFriends(),
        groupsApi.getGroups(),
      ]);
      setFriends(friendsRes.data.friends);
      setGroups(groupsRes.data.groups);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeSelect = (type) => {
    Haptics.selectionAsync();
    setTargetType(type);
    
    if (type === 'all_friends') {
      setStep(3);
    } else {
      setStep(2);
    }
  };

  const handleTargetSelect = (id) => {
    Haptics.selectionAsync();
    setTargetId(id);
    setStep(3);
  };

  const handleSend = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSending(true);

    try {
      const response = await pingsApi.create(
        venue.id,
        targetType,
        targetId,
        message.trim() || undefined
      );

      // Emit via socket for real-time delivery
      socketService.sendPing(
        response.data.id,
        targetType,
        targetId,
        { id: venue.id, name: venue.name }
      );

      onSuccess?.(response.data);
      onClose();
    } catch (error) {
      console.error('Failed to send ping:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Who do you want to ping?</Text>
      <View style={styles.typeOptions}>
        {TARGET_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = targetType === type.id;
          
          return (
            <TouchableOpacity
              key={type.id}
              style={[styles.typeOption, isSelected && styles.typeOptionSelected]}
              onPress={() => handleTypeSelect(type.id)}
            >
              <View style={[styles.typeIcon, isSelected && styles.typeIconSelected]}>
                <Icon size={22} color={isSelected ? '#fff' : '#888'} />
              </View>
              <View style={styles.typeContent}>
                <Text style={[styles.typeLabel, isSelected && styles.typeLabelSelected]}>
                  {type.label}
                </Text>
                <Text style={styles.typeDescription}>{type.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        {targetType === 'group' ? 'Select a group' : 'Select a friend'}
      </Text>
      
      <ScrollView style={styles.targetList} showsVerticalScrollIndicator={false}>
        {targetType === 'group' ? (
          groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={[styles.targetItem, targetId === group.id && styles.targetItemSelected]}
              onPress={() => handleTargetSelect(group.id)}
            >
              <View style={styles.groupIcon}>
                <Text style={styles.groupEmoji}>{group.emoji || '👥'}</Text>
              </View>
              <View style={styles.targetInfo}>
                <Text style={styles.targetName}>{group.name}</Text>
                <Text style={styles.targetMeta}>{group.memberCount} members</Text>
              </View>
              {targetId === group.id && <Check size={20} color="#6366f1" />}
            </TouchableOpacity>
          ))
        ) : (
          friends.map((friend) => {
            const initials = friend.displayName
              ?.split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
              
            return (
              <TouchableOpacity
                key={friend.id}
                style={[styles.targetItem, targetId === friend.id && styles.targetItemSelected]}
                onPress={() => handleTargetSelect(friend.id)}
              >
                {friend.avatarUrl ? (
                  <Image source={{ uri: friend.avatarUrl }} style={styles.friendAvatar} />
                ) : (
                  <View style={styles.friendAvatarPlaceholder}>
                    <Text style={styles.friendInitials}>{initials}</Text>
                  </View>
                )}
                <View style={styles.targetInfo}>
                  <Text style={styles.targetName}>{friend.displayName}</Text>
                </View>
                {targetId === friend.id && <Check size={20} color="#6366f1" />}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Add a message (optional)</Text>
      
      {/* Venue preview */}
      <View style={styles.venuePreview}>
        <MapPin size={16} color="#6366f1" />
        <Text style={styles.venueName}>{venue?.name}</Text>
      </View>

      <TextInput
        style={styles.messageInput}
        value={message}
        onChangeText={setMessage}
        placeholder="e.g., Getting drinks at 9, come through!"
        placeholderTextColor="#555"
        multiline
        maxLength={280}
      />

      <Text style={styles.charCount}>{message.length}/280</Text>

      <TouchableOpacity
        style={[styles.sendButton, sending && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={sending}
      >
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Send size={20} color="#fff" />
            <Text style={styles.sendButtonText}>Send Ping</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#888" />
            </TouchableOpacity>
          </View>

          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[
                  styles.stepDot,
                  step >= s && styles.stepDotActive,
                  s === 2 && targetType === 'all_friends' && styles.stepDotSkipped,
                ]}
              />
            ))}
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#6366f1" />
            </View>
          ) : (
            <>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </>
          )}

          {/* Back button */}
          {step > 1 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(step === 3 && targetType === 'all_friends' ? 1 : step - 1)}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    minHeight: 400,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: -5,
    padding: 5,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  stepDotActive: {
    backgroundColor: '#6366f1',
  },
  stepDotSkipped: {
    backgroundColor: '#333',
    opacity: 0.3,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  typeOptions: {
    gap: 12,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  typeIconSelected: {
    backgroundColor: '#6366f1',
  },
  typeContent: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  typeLabelSelected: {
    color: '#fff',
  },
  typeDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  targetList: {
    maxHeight: 300,
  },
  targetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#252525',
  },
  targetItemSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupEmoji: {
    fontSize: 20,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  friendAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendInitials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  targetInfo: {
    flex: 1,
  },
  targetName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  targetMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  venuePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  venueName: {
    color: '#6366f1',
    fontSize: 15,
    fontWeight: '500',
  },
  messageInput: {
    backgroundColor: '#252525',
    borderRadius: 16,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 20,
    gap: 10,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#888',
    fontSize: 15,
  },
});

export default PingSheet;
