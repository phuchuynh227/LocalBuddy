import { Entypo } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

export function AppBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { key: 'home', label: t('tabs.home'), icon: 'home', href: '/(tabs)/' as any, active: pathname === '/(tabs)' || pathname === '/' || pathname === '/(tabs)/index' },
    { key: 'explore', label: t('tabs.explore'), icon: 'magnifying-glass', href: '/(tabs)/explore' as any, active: pathname === '/(tabs)/explore' || pathname === '/explore' },
    { key: 'profile', label: t('tabs.profile'), icon: 'user', href: '/(tabs)/profile' as any, active: pathname === '/(tabs)/profile' || pathname === '/profile' },
  ];

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.bar}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.item}
            activeOpacity={0.9}
            onPress={() => router.replace(item.href)}
          >
            <Entypo name={item.icon as any} size={20} color={item.active ? '#1E88E5' : '#9CA3AF'} />
            <Text style={[styles.label, item.active && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 10,
    shadowColor: '#020617',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  labelActive: {
    color: '#1E88E5',
  },
});
