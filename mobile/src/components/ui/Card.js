import React from 'react';
import { View, StyleSheet } from 'react-native';
import { palette, radius, spacing } from '../../theme/palette';

const variantStyles = {
  default: {
    backgroundColor: palette.bgSoft,
    borderColor: palette.stroke,
  },
  soft: {
    backgroundColor: palette.bgCard,
    borderColor: 'transparent',
  },
  elevated: {
    backgroundColor: palette.bgElevated,
    borderColor: palette.stroke,
  },
};

export default function Card({ children, variant = 'default', style, padded = true }) {
  return (
    <View style={[styles.base, variantStyles[variant] || variantStyles.default, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  padded: {
    padding: spacing.xl,
  },
});
