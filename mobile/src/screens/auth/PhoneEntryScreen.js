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
import { ArrowLeft, Phone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '../../context/authStore';
import { palette, spacing, radius, type } from '../../theme/palette';
import PrimaryButton from '../../components/ui/PrimaryButton';

const PhoneEntryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { sendCode, error, clearError } = useAuthStore();

  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatPhone = (text) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = '';
    if (cleaned.length > 0) formatted = `(${cleaned.substring(0, 3)}`;
    if (cleaned.length >= 3) formatted += `) ${cleaned.substring(3, 6)}`;
    if (cleaned.length >= 6) formatted += `-${cleaned.substring(6, 10)}`;
    return formatted;
  };

  const handleContinue = async () => {
    const cleanedPhone = `+1${phone.replace(/\D/g, '')}`;
    if (cleanedPhone.length < 12) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const result = await sendCode(cleanedPhone);
      navigation.navigate('VerifyCode', {
        phone: cleanedPhone,
        isNewUser: result.isNewUser,
      });
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const isValidPhone = phone.replace(/\D/g, '').length === 10;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.glowA} />
      <View style={styles.glowB} />
      <View style={[styles.content, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={palette.text} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <View style={styles.iconContainer}>
            <Phone size={28} color={palette.accent} />
          </View>
          <Text style={styles.title}>Enter your phone</Text>
          <Text style={styles.subtitle}>We will text a 6-digit verification code.</Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.countryCode}>+1</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(text) => {
              clearError();
              setPhone(formatPhone(text));
            }}
            placeholder="(555) 555-5555"
            placeholderTextColor={palette.textSoft}
            keyboardType="phone-pad"
            autoFocus
            maxLength={14}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          title="Continue"
          onPress={handleContinue}
          disabled={!isValidPhone || isLoading}
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
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(54, 208, 198, 0.15)',
    top: -70,
    left: -80,
  },
  glowB: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(243, 174, 101, 0.12)',
    bottom: -70,
    right: -90,
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
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: type.sm + 1,
    color: palette.textMuted,
    marginTop: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.stroke,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  countryCode: {
    fontSize: type.lg + 1,
    color: palette.textMuted,
    marginRight: spacing.md,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: type.xl,
    color: palette.text,
    paddingVertical: spacing.lg + 2,
    fontWeight: '600',
  },
  error: {
    color: palette.danger,
    fontSize: type.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
});

export default PhoneEntryScreen;
