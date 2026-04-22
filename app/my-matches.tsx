import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: '☕', gym: '🏋️', movies: '🎬',
  park: '🌳', food: '🍽️', study: '📚',
};

type PlanInfo = {
  id: string;
  title: string;
  category: string;
  location_text: string;
  scheduled_at: string;
} | null;

type Match = {
  id: string;
  plan_id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  plans: PlanInfo;
};

type PendingRequest = {
  id: string;
  status: string;
  created_at: string;
  plans: PlanInfo;
};

export default function MyMatchesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [matches, setMatches] = useState<Match[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      setMatches([]);
      setPendingRequests([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [matchRes, requestRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*, plans(id, title, category, location_text, scheduled_at)')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('created_at', { ascending: false }),
      supabase
        .from('plan_requests')
        .select('id, status, created_at, plans(id, title, category, location_text, scheduled_at)')
        .eq('requester_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

    if (matchRes.data) setMatches(matchRes.data as any);
    if (requestRes.data) setPendingRequests(requestRes.data as any);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const getBuddyId = (match: Match) =>
    match.user1_id === user?.id ? match.user2_id : match.user1_id;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} — ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const isEmpty = matches.length === 0 && pendingRequests.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('profile.myMatches')}</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1E88E5" />
          </View>
        ) : isEmpty ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>🤝</Text>
            <Text style={styles.emptyTitle}>Chưa có match nào</Text>
            <Text style={styles.emptySubtitle}>
              Tạo plan hoặc join plan của người khác để có buddy!
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/create-plan' as any)}
            >
              <Text style={styles.createButtonText}>➕ Tìm buddy</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E88E5']} />
            }
          >
            {/* Pending section */}
            {pendingRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  ⏳ Đang chờ xác nhận ({pendingRequests.length})
                </Text>
                {pendingRequests.map(req => (
                  <View key={req.id} style={styles.pendingCard}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardEmoji}>
                        {CATEGORY_EMOJI[req.plans?.category ?? ''] ?? '📍'}
                      </Text>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {req.plans?.title ?? 'Plan'}
                        </Text>
                        <Text style={styles.cardMeta}>📍 {req.plans?.location_text ?? ''}</Text>
                        <Text style={styles.cardMeta}>
                          🕐 {req.plans?.scheduled_at ? formatTime(req.plans.scheduled_at) : ''}
                        </Text>
                      </View>
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>⏳ Chờ duyệt</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Matched section */}
            {matches.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  🤝 Đã match ({matches.length})
                </Text>
                {matches.map(item => {
                  const buddyId = getBuddyId(item);
                  const plan = item.plans;
                  return (
                    <View key={item.id} style={styles.matchCard}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardEmoji}>
                          {CATEGORY_EMOJI[plan?.category ?? ''] ?? '📍'}
                        </Text>
                        <View style={styles.cardInfo}>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {plan?.title ?? 'Plan'}
                          </Text>
                          <Text style={styles.cardMeta}>📍 {plan?.location_text ?? ''}</Text>
                          <Text style={styles.cardMeta}>
                            🕐 {plan?.scheduled_at ? formatTime(plan.scheduled_at) : ''}
                          </Text>
                        </View>
                        <View style={styles.matchedBadge}>
                          <Text style={styles.matchedBadgeText}>🤝 Matched</Text>
                        </View>
                      </View>

                      {/* Buddy row */}
                      <View style={styles.buddyRow}>
                        <View style={styles.buddyAvatar}>
                          <Text style={styles.buddyAvatarText}>
                            {buddyId.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.buddyInfo}>
                          <Text style={styles.buddyLabel}>Buddy của bạn</Text>
                          <Text style={styles.buddyId}>#{buddyId.slice(0, 8)}</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.chatButton}
                        onPress={() => router.push(
                          `/chat?matchUserId=${buddyId}&planTitle=${encodeURIComponent(plan?.title ?? 'Plan')}` as any
                        )}
                      >
                        <Text style={styles.chatButtonText}>💬 Nhắn tin với buddy</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const PRIMARY_BLUE = '#1E88E5';
const LIGHT_BLUE = '#E3F2FD';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { width: 36, height: 36, backgroundColor: '#F5F7FB', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  backText: { fontSize: 18, color: PRIMARY_BLUE, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  list: { paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  pendingCard: { backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#FDE68A' },
  matchCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  cardEmoji: { fontSize: 28, marginRight: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  matchedBadge: { backgroundColor: '#D1FAE5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  matchedBadgeText: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  pendingBadge: { backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pendingBadgeText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  buddyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  buddyAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: LIGHT_BLUE, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  buddyAvatarText: { fontSize: 18, fontWeight: '700', color: PRIMARY_BLUE },
  buddyInfo: { flex: 1 },
  buddyLabel: { fontSize: 13, color: '#6B7280' },
  buddyId: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginTop: 2 },
  chatButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 12, padding: 12, alignItems: 'center' },
  chatButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  createButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  createButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
