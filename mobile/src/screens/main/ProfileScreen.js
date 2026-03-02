import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Settings, 
  Bell, 
  Shield, 
  HelpCircle, 
  LogOut,
  ChevronRight,
  Moon,
  Zap,
} from 'lucide-react-native';

import { useAuthStore } from '../../context/authStore';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import { palette } from '../../theme/palette';

const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();

  const initials = user?.displayName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  const handleLogout = async () => {
    await logout();
  };

  const MenuItem = ({ icon: Icon, title, subtitle, onPress, danger }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Icon size={20} color={danger ? '#ef4444' : '#36d0c6'} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <ChevronRight size={20} color="#547186" />
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
    >
      {/* Header */}
      <ScreenHeader title="Profile" />

      {/* Profile Card */}
      <Card style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}
        </View>
        <Text style={styles.userName}>{user?.displayName}</Text>
        <Text style={styles.userPhone}>{user?.phone}</Text>

        {/* Vibe Preference */}
        <View style={styles.vibeContainer}>
          {user?.vibePreference === 'lively' ? (
            <View style={[styles.vibeBadge, styles.vibeLively]}>
              <Zap size={14} color="#f97316" />
              <Text style={styles.vibeLivelyText}>Lively Vibe</Text>
            </View>
          ) : user?.vibePreference === 'lowkey' ? (
            <View style={[styles.vibeBadge, styles.vibeLowkey]}>
              <Moon size={14} color="#36d0c6" />
              <Text style={styles.vibeLowkeyText}>Lowkey Vibe</Text>
            </View>
          ) : (
            <View style={styles.vibeBadge}>
              <Text style={styles.vibeAnyText}>Any Vibe</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </Card>

      {/* Stats */}
      <Card style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{user?.friendCount || 0}</Text>
          <Text style={styles.statLabel}>Friends</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{user?.groupCount || 0}</Text>
          <Text style={styles.statLabel}>Groups</Text>
        </View>
      </Card>

      {/* Menu */}
      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <MenuItem 
          icon={Bell} 
          title="Notifications" 
          subtitle="Manage alerts and sounds"
        />
        <MenuItem 
          icon={Shield} 
          title="Privacy" 
          subtitle="Control who can see you"
        />
        <MenuItem 
          icon={Settings} 
          title="Preferences" 
          subtitle="App settings and defaults"
        />
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.sectionTitle}>Support</Text>
        <MenuItem 
          icon={HelpCircle} 
          title="Help Center" 
        />
      </View>

      <View style={styles.menuSection}>
        <MenuItem 
          icon={LogOut} 
          title="Log Out" 
          onPress={handleLogout}
          danger
        />
      </View>

      <Text style={styles.version}>CrowdPulse v1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginHorizontal: 20,
    borderWidth: 0,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: palette.text,
    fontSize: 36,
    fontWeight: '600',
  },
  userName: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '700',
  },
  userPhone: {
    color: '#8faac0',
    fontSize: 14,
    marginTop: 4,
  },
  vibeContainer: {
    marginTop: 12,
  },
  vibeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#122b40',
    gap: 6,
  },
  vibeLively: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  vibeLowkey: {
    backgroundColor: 'rgba(54, 208, 198, 0.15)',
  },
  vibeLivelyText: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '500',
  },
  vibeLowkeyText: {
    color: '#36d0c6',
    fontSize: 13,
    fontWeight: '500',
  },
  vibeAnyText: {
    color: '#8faac0',
    fontSize: 13,
    fontWeight: '500',
  },
  editButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  editButtonText: {
    color: '#36d0c6',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 0,
    padding: 20,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    color: '#8faac0',
    fontSize: 13,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#18354e',
    marginHorizontal: 20,
  },
  menuSection: {
    marginTop: 24,
    marginHorizontal: 20,
  },
  sectionTitle: {
    color: '#8faac0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d2233',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuIconDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  menuTitleDanger: {
    color: '#ef4444',
  },
  menuSubtitle: {
    color: '#6f879b',
    fontSize: 13,
    marginTop: 2,
  },
  version: {
    color: '#547186',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
  },
});

export default ProfileScreen;
