import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, Users, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { palette, spacing, radius, type } from '../../theme/palette';

const { width } = Dimensions.get('window');

const WelcomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const fade = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('PhoneEntry');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.glowA} />
      <View style={styles.glowB} />
      {/* Logo / Brand */}
      <Animated.View style={[styles.header, { opacity: fade }]}>
        <View style={styles.logoContainer}>
          <MapPin size={48} color={palette.accent} strokeWidth={2.5} />
        </View>
        <Text style={styles.appName}>CrowdPulse</Text>
        <Text style={styles.tagline}>Know before you go</Text>
      </Animated.View>

      {/* Features */}
      <View style={styles.features}>
        <View style={styles.feature}>
          <View style={styles.featureIcon}>
            <Zap size={24} color={palette.accent} />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Real-time crowd levels</Text>
            <Text style={styles.featureDescription}>
              See how busy venues are before you arrive
            </Text>
          </View>
        </View>

        <View style={styles.feature}>
          <View style={styles.featureIcon}>
            <Users size={24} color={palette.accent} />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Find your friends</Text>
            <Text style={styles.featureDescription}>
              See who's out and where they're heading
            </Text>
          </View>
        </View>

        <View style={styles.feature}>
          <View style={styles.featureIcon}>
            <MapPin size={24} color={palette.accent} />
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Coordinate effortlessly</Text>
            <Text style={styles.featureDescription}>
              Ping friends to meet up at the perfect spot
            </Text>
          </View>
        </View>
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>

        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingHorizontal: spacing.xxl,
  },
  glowA: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(54, 208, 198, 0.18)',
    top: -70,
    left: -90,
  },
  glowB: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(243, 174, 101, 0.14)',
    bottom: -60,
    right: -80,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: radius.xxl,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.stroke,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  appName: {
    fontSize: type.display,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: type.lg,
    color: palette.textMuted,
    marginTop: spacing.sm,
  },
  features: {
    gap: spacing.xl,
    paddingVertical: spacing.huge,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: palette.bgCard,
    borderWidth: 1,
    borderColor: palette.stroke,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: type.md,
    fontWeight: '600',
    color: palette.text,
  },
  featureDescription: {
    fontSize: type.sm,
    color: palette.textMuted,
    marginTop: 2,
  },
  footer: {
    paddingBottom: spacing.xl,
  },
  button: {
    backgroundColor: palette.accent,
    paddingVertical: spacing.lg + 2,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  buttonText: {
    color: '#032824',
    fontSize: type.md,
    fontWeight: '700',
  },
  terms: {
    fontSize: type.xs,
    color: palette.textSoft,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
});

export default WelcomeScreen;
