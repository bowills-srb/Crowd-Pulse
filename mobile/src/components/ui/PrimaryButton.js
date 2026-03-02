import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { palette, radius, spacing, type } from '../../theme/palette';

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  leftIcon = null,
  rightIcon = null,
  style,
}) {
  const isDisabled = disabled || loading;
  const variantStyle = variant === 'secondary' ? styles.secondary : styles.primary;
  const labelStyle = variant === 'secondary' ? styles.secondaryText : styles.primaryText;

  return (
    <TouchableOpacity style={[styles.base, variantStyle, isDisabled && styles.disabled, style]} onPress={onPress} disabled={isDisabled}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? palette.text : '#032824'} />
      ) : (
        <View style={styles.row}>
          {leftIcon}
          <Text style={[styles.text, labelStyle]}>{title}</Text>
          {rightIcon}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    paddingVertical: spacing.lg + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: palette.accent,
  },
  secondary: {
    backgroundColor: 'rgba(54, 208, 198, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(54, 208, 198, 0.24)',
  },
  disabled: {
    backgroundColor: palette.bgElevated,
    borderColor: palette.bgElevated,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    fontSize: type.md,
    fontWeight: '700',
  },
  primaryText: {
    color: '#032824',
  },
  secondaryText: {
    color: palette.accent,
  },
});
