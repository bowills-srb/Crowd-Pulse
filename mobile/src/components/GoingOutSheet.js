import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  X, 
  Users, 
  UserCheck, 
  Globe, 
  EyeOff,
  Check,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { groupsApi } from '../services/api';
import { usePresenceStore } from '../context/presenceStore';
import { palette } from '../theme/palette';

const SHARING_MODES = [
  {
    id: 'all_friends',
    title: 'All Friends',
    description: 'Everyone you\'re connected with',
    icon: Globe,
  },
  {
    id: 'groups',
    title: 'Select Groups',
    description: 'Choose specific friend groups',
    icon: Users,
  },
  {
    id: 'none',
    title: 'Ghost Mode',
    description: 'See others without being seen',
    icon: EyeOff,
  },
];

const GoingOutSheet = ({ visible, onClose, onConfirm, currentPresence }) => {
  const insets = useSafeAreaInsets();
  const { stopSharing } = usePresenceStore();
  
  const [sharingMode, setSharingMode] = useState('all_friends');
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  const isCurrentlySharing = currentPresence?.status === 'going_out' || 
                              currentPresence?.status === 'at_venue';

  useEffect(() => {
    if (visible) {
      fetchGroups();
    }
  }, [visible]);

  const fetchGroups = async () => {
    try {
      const response = await groupsApi.getGroups();
      setGroups(response.data.groups);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const handleModeSelect = (mode) => {
    Haptics.selectionAsync();
    setSharingMode(mode);
    if (mode === 'groups') {
      setShowGroupPicker(true);
    }
  };

  const toggleGroup = (groupId) => {
    Haptics.selectionAsync();
    setSelectedGroups(prev => 
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const sharingWith = sharingMode === 'groups' ? selectedGroups : [];
    onConfirm(sharingMode, sharingWith);
  };

  const handleStop = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await stopSharing();
    onClose();
  };

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
              <X size={24} color={palette.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>
            {isCurrentlySharing ? 'Location Sharing' : 'Going Out Tonight?'}
          </Text>
          <Text style={styles.subtitle}>
            {isCurrentlySharing 
              ? 'You\'re currently visible to friends'
              : 'Let friends know you\'re available'}
          </Text>

          {/* Sharing mode options */}
          <View style={styles.options}>
            {SHARING_MODES.map((mode) => {
              const Icon = mode.icon;
              const isSelected = sharingMode === mode.id;
              
              return (
                <TouchableOpacity
                  key={mode.id}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => handleModeSelect(mode.id)}
                >
                  <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
                    <Icon size={22} color={isSelected ? '#032824' : palette.textMuted} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                      {mode.title}
                    </Text>
                    <Text style={styles.optionDescription}>
                      {mode.description}
                    </Text>
                  </View>
                  {isSelected && (
                    <Check size={20} color={palette.accent} />
                  )}
                  {mode.id === 'groups' && isSelected && selectedGroups.length > 0 && (
                    <View style={styles.groupCount}>
                      <Text style={styles.groupCountText}>{selectedGroups.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Group picker */}
          {sharingMode === 'groups' && groups.length > 0 && (
            <View style={styles.groupPicker}>
              <Text style={styles.groupPickerTitle}>Select Groups</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {groups.map((group) => {
                  const isSelected = selectedGroups.includes(group.id);
                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[styles.groupChip, isSelected && styles.groupChipSelected]}
                      onPress={() => toggleGroup(group.id)}
                    >
                      <Text style={styles.groupEmoji}>{group.emoji || '👥'}</Text>
                      <Text style={[styles.groupName, isSelected && styles.groupNameSelected]}>
                        {group.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {isCurrentlySharing ? (
              <>
                <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
                  <Text style={styles.stopButtonText}>Stop Sharing</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                  <Text style={styles.confirmButtonText}>Update Settings</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity 
                style={[
                  styles.confirmButton, 
                  sharingMode === 'groups' && selectedGroups.length === 0 && styles.confirmButtonDisabled
                ]}
                onPress={handleConfirm}
                disabled={sharingMode === 'groups' && selectedGroups.length === 0}
              >
                <Text style={styles.confirmButtonText}>Start Sharing</Text>
              </TouchableOpacity>
            )}
          </View>
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
    backgroundColor: palette.bgSoft,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: palette.stroke,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: palette.textSoft,
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: -5,
    padding: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  options: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bgCard,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(54, 208, 198, 0.14)',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconContainerSelected: {
    backgroundColor: palette.accent,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
  },
  optionTitleSelected: {
    color: '#032824',
  },
  optionDescription: {
    fontSize: 13,
    color: palette.textMuted,
    marginTop: 2,
  },
  groupCount: {
    backgroundColor: palette.accent,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  groupCountText: {
    color: '#032824',
    fontSize: 12,
    fontWeight: '700',
  },
  groupPicker: {
    marginTop: 20,
  },
  groupPickerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textMuted,
    marginBottom: 12,
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: palette.stroke,
  },
  groupChipSelected: {
    backgroundColor: 'rgba(54, 208, 198, 0.2)',
    borderColor: palette.accent,
  },
  groupEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  groupName: {
    fontSize: 14,
    color: palette.textMuted,
    fontWeight: '500',
  },
  groupNameSelected: {
    color: palette.text,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  stopButton: {
    flex: 1,
    backgroundColor: palette.bgElevated,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  stopButtonText: {
    color: palette.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: palette.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: palette.bgElevated,
  },
  confirmButtonText: {
    color: '#032824',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GoingOutSheet;
