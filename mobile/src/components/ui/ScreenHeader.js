import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, spacing, type } from '../../theme/palette';

export default function ScreenHeader({ title, subtitle, left = null, right = null, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <View style={styles.side}>{left}</View>
        <View style={styles.center}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={[styles.side, styles.right]}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  right: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
  },
  title: {
    fontSize: type.hero + 2,
    fontWeight: '700',
    color: palette.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: type.sm,
    color: palette.textMuted,
  },
});
