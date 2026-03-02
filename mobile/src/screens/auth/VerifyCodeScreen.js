import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '../../context/authStore';
import { palette, spacing, radius, type } from '../../theme/palette';

const CODE_LENGTH = 6;

const VerifyCodeScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { phone, isNewUser } = route.params;
  const { verify, sendCode, error, clearError } = useAuthStore();

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputRef = useRef(null);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  useEffect(() => {
    if (code.length === CODE_LENGTH) handleVerify();
  }, [code]);

  const handleVerify = async () => {
    if (code.length !== CODE_LENGTH) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      if (isNewUser) {
        navigation.navigate('CreateProfile', { phone, code });
      } else {
        await verify(phone, code);
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await sendCode(phone);
      setResendTimer(30);
    } catch (err) {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
      <View style={styles.glow} />
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <ArrowLeft size={24} color={palette.text} />
      </TouchableOpacity>

      <View style={styles.titleContainer}>
        <View style={styles.iconContainer}>
          <Shield size={28} color={palette.accent} />
        </View>
        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to {phone}</Text>
      </View>

      <TouchableOpacity style={styles.codeContainer} activeOpacity={1} onPress={() => inputRef.current?.focus()}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => {
          const digit = code[i];
          const isFocused = code.length === i;
          return (
            <View key={i} style={[styles.codeBox, digit && styles.codeBoxFilled, isFocused && styles.codeBoxFocused]}>
              <Text style={styles.codeDigit}>{digit || ''}</Text>
            </View>
          );
        })}
      </TouchableOpacity>

      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={code}
        onChangeText={(text) => {
          clearError();
          setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH));
        }}
        keyboardType="number-pad"
        autoFocus
        maxLength={CODE_LENGTH}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isLoading ? <ActivityIndicator color={palette.accent} style={styles.loader} /> : null}

      <TouchableOpacity style={styles.resendButton} onPress={handleResend} disabled={resendTimer > 0}>
        <Text style={[styles.resendText, resendTimer > 0 && styles.resendTextDisabled]}>
          {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingHorizontal: spacing.xxl,
  },
  glow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: radius.round,
    backgroundColor: 'rgba(54, 208, 198, 0.14)',
    top: -70,
    right: -80,
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
    marginBottom: spacing.xxxl + spacing.sm,
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
    textAlign: 'center',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  codeBox: {
    width: 48,
    height: 60,
    borderRadius: radius.md + 2,
    backgroundColor: palette.bgCard,
    borderWidth: 2,
    borderColor: palette.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeBoxFilled: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(54, 208, 198, 0.14)',
  },
  codeBoxFocused: {
    borderColor: palette.accent,
  },
  codeDigit: {
    fontSize: type.xxl,
    fontWeight: '700',
    color: palette.text,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
  },
  error: {
    color: palette.danger,
    fontSize: type.sm,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  loader: {
    marginTop: spacing.xl,
  },
  resendButton: {
    marginTop: spacing.xxxl - spacing.sm,
    alignItems: 'center',
  },
  resendText: {
    color: palette.accent,
    fontSize: type.sm + 1,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: palette.textSoft,
  },
});

export default VerifyCodeScreen;
