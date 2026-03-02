import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

export const PingDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { pingId } = route.params;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={() => navigation.goBack()}
      >
        <X size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.text}>Ping Detail: {pingId}</Text>
    </View>
  );
};

export const GroupDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { groupId } = route.params;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={() => navigation.goBack()}
      >
        <X size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.text}>Group Detail: {groupId}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    padding: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 40,
  },
});

export default PingDetailScreen;
