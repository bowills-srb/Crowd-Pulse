import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '../../context/authStore';
import { palette, spacing, radius, type } from '../../theme/palette';
import PrimaryButton from '../../components/ui/PrimaryButton';

const CreateProfileScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { phone, code } = route.params;
  const { verify, error, clearError } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (displayName.trim().length < 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      await verify(phone, code, displayName.trim());
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = displayName.trim().length >= 2;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.glowA} />
      <View style={[styles.content, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={palette.text} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <View style={styles.iconContainer}>
            <User size={28} color={palette.accent} />
          </View>
          <Text style={styles.title}>What should friends call you?</Text>
          <Text style={styles.subtitle}>You can always change this later.</Text>
        </View>

        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={(text) => {
            clearError();
            setDisplayName(text);
          }}
          placeholder="Your name"
          placeholderTextColor={palette.textSoft}
          autoFocus
          autoCapitalize="words"
          maxLength={50}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          title="Continue"
          onPress={handleCreate}
          disabled={!isValid || isLoading}
          loading={isLoading}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  glowA: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: radius.round,
    backgroundColor: 'rgba(243, 174, 101, 0.12)',
    top: -60,
    left: -90,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginLeft: -8,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: spacing.huge + spacing.xs,
    marginBottom: spacing.huge,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: radius.xl + 2,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.stroke,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: type.hero,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: type.sm + 1,
    color: palette.textMuted,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.stroke,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg + 2,
    fontSize: type.lg,
    color: palette.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontWeight: '600',
  },
  error: {
    color: palette.danger,
    fontSize: type.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
});

export default CreateProfileScreen;
