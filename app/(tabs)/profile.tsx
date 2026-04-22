import { useRouter } from 'expo-router';
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNotifications } from '../../context/NotificationContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { language, t } = useLanguage();
  const { unreadCount } = useNotifications();
  const joinDate = new Date(user?.created_at ?? '');
  const joinDateText = isNaN(joinDate.getTime())
    ? ''
    : joinDate.toLocaleDateString(language === 'vn' ? 'vi-VN' : 'en-US', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.email?.charAt(0).toUpperCase() ?? 'LB'}
            </Text>
          </View>
          <Text style={styles.email}>{user?.email}</Text>
          {!!joinDateText && (
            <Text style={styles.joinDate}>
              {t('profile.memberSince', { date: joinDateText })}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.activity')}</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/my-plans' as any)}>
            <Text style={styles.menuIcon}>...</Text>
            <Text style={styles.menuLabel}>{t('myPlans.title')}</Text>
            <Text style={styles.menuArrow}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/my-matches' as any)}>
            <Text style={styles.menuIcon}>...</Text>
            <Text style={styles.menuLabel}>{t('profile.myMatches')}</Text>
            <Text style={styles.menuArrow}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/my-reviews' as any)}>
            <Text style={styles.menuIcon}>...</Text>
            <Text style={styles.menuLabel}>{t('profile.myReviews')}</Text>
            <Text style={styles.menuArrow}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notifications' as any)}>
            <Text style={styles.menuIcon}>!</Text>
            <Text style={styles.menuLabel}>{t('profile.notifications')}</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
            <Text style={styles.menuArrow}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/change-password' as any)}>
            <Text style={styles.menuIcon}>*</Text>
            <Text style={styles.menuLabel}>{t('profile.changePassword')}</Text>
            <Text style={styles.menuArrow}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const PRIMARY_BLUE = '#1E88E5';
const LIGHT_BLUE = '#E3F2FD';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: 32, backgroundColor: LIGHT_BLUE },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: PRIMARY_BLUE, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
  email: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  joinDate: { fontSize: 13, color: '#6B7280' },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  menuIcon: { fontSize: 20, marginRight: 12, width: 20, textAlign: 'center' },
  menuLabel: { flex: 1, fontSize: 15, color: '#1A1A1A', fontWeight: '500' },
  menuArrow: { fontSize: 16, color: '#9CA3AF' },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PRIMARY_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginRight: 10,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  logoutButton: { marginHorizontal: 20, marginTop: 32, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 16, alignItems: 'center' },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#DC2626' },
});
