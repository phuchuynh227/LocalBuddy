import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getProfileDisplayName, normalizeUserProfile, UserProfile } from '../lib/user-profile';
import { supabase } from '../lib/supabase';

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: '\u2615',
  gym: '\u{1F3CB}\uFE0F',
  movies: '\u{1F3AC}',
  park: '\u{1F333}',
  food: '\u{1F37D}\uFE0F',
  study: '\u{1F4DA}',
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
  buddy_profile?: UserProfile | null;
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
  const { language, t } = useLanguage();

  const [matches, setMatches] = useState<Match[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBuddyProfile, setSelectedBuddyProfile] = useState<UserProfile | null>(null);
  const [zoomedAvatarUrl, setZoomedAvatarUrl] = useState<string | null>(null);

  const labels = useMemo(() => ({
    empty: language === 'vn' ? 'Chưa có match nào' : 'No matches yet',
    emptySubtitle: language === 'vn'
      ? 'Tạo plan hoặc tham gia plan của người khác để tìm buddy.'
      : 'Create a plan or join someone else to find a buddy.',
    pendingSection: language === 'vn' ? 'Đang chờ xác nhận' : 'Waiting for confirmation',
    matchedSection: language === 'vn' ? 'Đã match' : 'Matched',
    pendingBadge: language === 'vn' ? 'Chờ duyệt' : 'Pending',
    matchedBadge: language === 'vn' ? 'Đã match' : 'Matched',
    yourBuddy: language === 'vn' ? 'Buddy của bạn' : 'Your buddy',
    chatWithBuddy: language === 'vn' ? 'Nhắn tin với buddy' : 'Message buddy',
    planFallback: 'Plan',
    locationPrefix: language === 'vn' ? 'Địa điểm:' : 'Location:',
    timePrefix: language === 'vn' ? 'Thời gian:' : 'Time:',
  }), [language]);

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

    if (matchRes.data) {
      const rawMatches = matchRes.data as Match[];
      const buddyIds = rawMatches.map((match) => (match.user1_id === user.id ? match.user2_id : match.user1_id));
      const { data: profileRows } = await supabase.from('user_profiles').select('*').in('user_id', buddyIds);
      const profileMap = new Map(
        (profileRows ?? [])
          .map((row: any) => normalizeUserProfile(row))
          .filter((row): row is UserProfile => Boolean(row))
          .map((row) => [row.user_id, row]),
      );

      setMatches(
        rawMatches.map((match) => ({
          ...match,
          buddy_profile: profileMap.get(match.user1_id === user.id ? match.user2_id : match.user1_id) ?? null,
        })),
      );
    }

    if (requestRes.data) setPendingRequests(requestRes.data as any);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getBuddyId = (match: Match) =>
    match.user1_id === user?.id ? match.user2_id : match.user1_id;

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} - ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const renderVisibleFields = () => {
    const profile = selectedBuddyProfile;
    const rows: string[] = [];

    if (profile?.visibility_settings?.fullName && profile.full_name) rows.push(`${t('personalInfo.fullName')}: ${profile.full_name}`);
    if (profile?.visibility_settings?.nickname && profile.nickname) rows.push(`${t('personalInfo.nickname')}: ${profile.nickname}`);
    if (profile?.visibility_settings?.gender && profile.gender) rows.push(`${t('personalInfo.gender')}: ${t(`personalInfo.genderOptions.${profile.gender}`)}`);
    if (profile?.visibility_settings?.birthYear && profile.birth_year) rows.push(`${t('personalInfo.birthYear')}: ${profile.birth_year}`);
    if (profile?.visibility_settings?.interests && profile.interests) rows.push(`${t('personalInfo.interests')}: ${profile.interests}`);

    if (rows.length === 0) {
      return <Text style={styles.previewEmpty}>{t('myPlans.profilePreviewEmpty')}</Text>;
    }

    return rows.map((row) => (
      <Text key={row} style={styles.previewField}>
        {row}
      </Text>
    ));
  };

  const isEmpty = matches.length === 0 && pendingRequests.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('profile.myMatches')}</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1E88E5" />
          </View>
        ) : isEmpty ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>...</Text>
            <Text style={styles.emptyTitle}>{labels.empty}</Text>
            <Text style={styles.emptySubtitle}>{labels.emptySubtitle}</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/create-plan' as any)}
            >
              <Text style={styles.createButtonText}>{t('home.findBuddy')}</Text>
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
            {pendingRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {labels.pendingSection} ({pendingRequests.length})
                </Text>
                {pendingRequests.map((request) => (
                  <View key={request.id} style={styles.pendingCard}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardEmoji}>
                        {CATEGORY_EMOJI[request.plans?.category ?? ''] ?? '\u{1F4CD}'}
                      </Text>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {request.plans?.title ?? labels.planFallback}
                        </Text>
                        <Text style={styles.cardMeta}>{labels.locationPrefix} {request.plans?.location_text ?? ''}</Text>
                        <Text style={styles.cardMeta}>
                          {labels.timePrefix} {request.plans?.scheduled_at ? formatTime(request.plans.scheduled_at) : ''}
                        </Text>
                      </View>
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>{labels.pendingBadge}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {matches.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {labels.matchedSection} ({matches.length})
                </Text>
                {matches.map((item) => {
                  const buddyId = getBuddyId(item);
                  const plan = item.plans;
                  return (
                    <View key={item.id} style={styles.matchCard}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardEmoji}>
                          {CATEGORY_EMOJI[plan?.category ?? ''] ?? '\u{1F4CD}'}
                        </Text>
                        <View style={styles.cardInfo}>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {plan?.title ?? labels.planFallback}
                          </Text>
                          <Text style={styles.cardMeta}>{labels.locationPrefix} {plan?.location_text ?? ''}</Text>
                          <Text style={styles.cardMeta}>
                            {labels.timePrefix} {plan?.scheduled_at ? formatTime(plan.scheduled_at) : ''}
                          </Text>
                        </View>
                        <View style={styles.matchedBadge}>
                          <Text style={styles.matchedBadgeText}>{labels.matchedBadge}</Text>
                        </View>
                      </View>

                      <TouchableOpacity style={styles.buddyRow} activeOpacity={0.9} onPress={() => setSelectedBuddyProfile(item.buddy_profile ?? null)}>
                        <UserAvatar profile={item.buddy_profile} fallbackText={buddyId} size={40} textSize={18} />
                        <View style={styles.buddyInfo}>
                          <Text style={styles.buddyLabel}>{labels.yourBuddy}</Text>
                          <Text style={styles.buddyId}>{getProfileDisplayName(item.buddy_profile, `#${buddyId.slice(0, 8)}`)}</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.chatButton}
                        onPress={() => router.push(
                          `/chat?matchUserId=${buddyId}&planTitle=${encodeURIComponent(plan?.title ?? labels.planFallback)}` as any
                        )}
                      >
                        <Text style={styles.chatButtonText}>{labels.chatWithBuddy}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {selectedBuddyProfile && (
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelectedBuddyProfile(null)} />
          <View style={styles.previewCard}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => selectedBuddyProfile.avatar_url && setZoomedAvatarUrl(selectedBuddyProfile.avatar_url)}
              style={styles.previewAvatarWrap}
            >
              <UserAvatar profile={selectedBuddyProfile} fallbackText={selectedBuddyProfile.user_id} size={72} textSize={26} />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>{getProfileDisplayName(selectedBuddyProfile, labels.yourBuddy)}</Text>
            <View style={styles.previewScroll}>
              {renderVisibleFields()}
            </View>
            <TouchableOpacity style={styles.previewCloseButton} onPress={() => setSelectedBuddyProfile(null)}>
              <Text style={styles.previewCloseText}>{t('common.ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {zoomedAvatarUrl && (
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setZoomedAvatarUrl(null)} />
          <View style={styles.zoomCard}>
            <Image source={{ uri: zoomedAvatarUrl }} style={styles.zoomImage} contentFit="contain" />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const PRIMARY_BLUE = '#1E88E5';

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
  buddyInfo: { flex: 1, marginLeft: 12 },
  buddyLabel: { fontSize: 13, color: '#6B7280' },
  buddyId: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginTop: 2 },
  chatButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 12, padding: 12, alignItems: 'center' },
  chatButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 32, marginBottom: 16, color: '#9CA3AF' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  createButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  createButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  previewCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
  },
  previewAvatarWrap: { alignSelf: 'center' },
  previewTitle: { marginTop: 12, marginBottom: 14, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  previewScroll: { maxHeight: 220 },
  previewField: { fontSize: 14, color: '#374151', marginBottom: 10, lineHeight: 20 },
  previewEmpty: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  previewCloseButton: { marginTop: 18, backgroundColor: PRIMARY_BLUE, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  previewCloseText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  zoomCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  zoomImage: { width: '100%', aspectRatio: 1, borderRadius: 18, backgroundColor: '#F3F4F6' },
});
