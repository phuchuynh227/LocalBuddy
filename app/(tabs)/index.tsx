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

const CATEGORIES = [
  { key: 'cafe', emoji: '\u2615' },
  { key: 'gym', emoji: '\u{1F3CB}\uFE0F' },
  { key: 'movies', emoji: '\u{1F3AC}' },
  { key: 'park', emoji: '\u{1F333}' },
  { key: 'food', emoji: '\u{1F37D}\uFE0F' },
  { key: 'study', emoji: '\u{1F4DA}' },
];

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { language, toggleLanguage, t } = useLanguage();
  const { unreadCount } = useNotifications();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>Local Buddy</Text>
            <Text style={styles.appSubtitle}>{t('home.subtitle')}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => router.push('/notifications' as any)}
              activeOpacity={0.9}
            >
              <Text style={styles.bellText}>{'\u{1F514}'}</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.langPill} onPress={toggleLanguage} activeOpacity={0.9}>
              <Text style={styles.langPillText}>
                {language === 'en' ? 'EN' : 'VN'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profile} onPress={signOut} activeOpacity={0.9}>
              <Text style={styles.profileInitials}>
                {user?.email?.charAt(0).toUpperCase() ?? 'LB'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.planCard}>
            <Text style={styles.planTitle}>{t('home.planTitle')}</Text>
            <Text style={styles.planSubtitle}>{t('home.planSubtitle')}</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.planButton}
                activeOpacity={0.9}
                onPress={() => router.push('/create-plan' as any)}>
                <Text style={styles.planButtonText}>{t('home.createPlan')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.findBuddyButton}
                activeOpacity={0.9}
                onPress={() => router.push('/create-plan' as any)}>
                <Text style={styles.findBuddyButtonText}>{t('home.findBuddy')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.browseTitle')}</Text>
            <Text style={styles.sectionSubtitle}>{t('home.browseSubtitle')}</Text>
          </View>

          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.categoryCard}
                activeOpacity={0.9}
                onPress={() => router.push(`/places?category=${item.key}` as any)}
              >
                <Text style={styles.categoryEmoji}>{item.emoji}</Text>
                <Text style={styles.categoryLabel}>{t(`categories.${item.key}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const PRIMARY_BLUE = '#1E88E5';
const LIGHT_BLUE = '#E3F2FD';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LIGHT_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellText: { fontSize: 18, color: PRIMARY_BLUE },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  langPill: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: LIGHT_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  langPillText: { fontSize: 13, fontWeight: '700', color: PRIMARY_BLUE },
  appName: { fontSize: 24, fontWeight: '700', color: PRIMARY_BLUE, letterSpacing: 0.5 },
  appSubtitle: { marginTop: 4, fontSize: 13, color: '#6B6B6B' },
  profile: { width: 40, height: 40, borderRadius: 20, backgroundColor: LIGHT_BLUE, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  profileInitials: { fontSize: 16, fontWeight: '700', color: PRIMARY_BLUE },
  scrollContent: { paddingBottom: 32 },
  planCard: { backgroundColor: LIGHT_BLUE, borderRadius: 20, padding: 20, marginBottom: 24 },
  planTitle: { fontSize: 20, fontWeight: '700', color: PRIMARY_BLUE, marginBottom: 4 },
  planSubtitle: { fontSize: 13, color: '#4F4F4F', marginBottom: 16 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  planButton: { alignSelf: 'flex-start', backgroundColor: PRIMARY_BLUE, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  planButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  findBuddyButton: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: PRIMARY_BLUE },
  findBuddyButtonText: { color: PRIMARY_BLUE, fontSize: 14, fontWeight: '600' },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
  sectionSubtitle: { marginTop: 4, fontSize: 13, color: '#7A7A7A' },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  categoryCard: { width: '48%', backgroundColor: '#F5F7FB', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'flex-start' },
  categoryEmoji: { fontSize: 24, marginBottom: 8 },
  categoryLabel: { fontSize: 14, fontWeight: '600', color: '#2C2C2C' },
});
