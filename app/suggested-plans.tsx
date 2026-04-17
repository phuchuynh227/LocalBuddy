import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: '☕', gym: '🏋️', movies: '🎬',
  park: '🌳', food: '🍽️', study: '📚',
};

type Plan = {
  id: string;
  host_id: string;
  category: string;
  title: string;
  description: string;
  location_text: string;
  scheduled_at: string;
  max_buddies: number;
  status: string;
  matchScore: number;
  matchReasons: string[];
  host_email?: string;
};

function calcMatchScore(plan: any, category: string, locationText: string, timeSlot: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Same category: 40%
  if (plan.category === category) {
    score += 40;
    reasons.push('Cùng hoạt động');
  }

  // Same area (simple text match): 30%
  const planLoc = (plan.location_text ?? '').toLowerCase();
  const myLoc = locationText.toLowerCase();
  if (planLoc && myLoc && (planLoc.includes(myLoc) || myLoc.includes(planLoc))) {
    score += 30;
    reasons.push('Cùng khu vực');
  }

  // Same time slot (±1 hour): 30%
  if (plan.scheduled_at && timeSlot) {
    const planHour = new Date(plan.scheduled_at).getHours();
    const myHour = parseInt(timeSlot.split(':')[0]);
    if (Math.abs(planHour - myHour) <= 1) {
      score += 30;
      reasons.push('Cùng khung giờ');
    }
  }

  return { score, reasons };
}

export default function SuggestedPlansScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { planId, category, locationText, timeSlot } = useLocalSearchParams<{
    planId: string;
    category: string;
    locationText: string;
    timeSlot: string;
  }>();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);

  useEffect(() => {
    fetchSuggestedPlans();
  }, []);

  const fetchSuggestedPlans = async () => {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('status', 'open')
      .neq('host_id', user?.id)   // không hiện plan của chính mình
      .neq('id', planId)           // không hiện plan vừa tạo
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Tính match score cho từng plan
      const scored = data
        .map(p => {
          const { score, reasons } = calcMatchScore(p, category, locationText ?? '', timeSlot ?? '');
          return { ...p, matchScore: score, matchReasons: reasons };
        })
        .filter(p => p.matchScore > 0)   // chỉ hiện plan có match
        .sort((a, b) => b.matchScore - a.matchScore);  // sort score giảm dần
      setPlans(scored);
    }
    setLoading(false);
  };

  const handleRequestJoin = async (plan: Plan) => {
    setRequesting(plan.id);
    const { error } = await supabase.from('plan_requests').insert({
      plan_id: plan.id,
      requester_id: user?.id,
      message: 'Tôi muốn tham gia plan của bạn!',
    });
    if (error) {
      if (error.code === '23505') {
        Alert.alert('Thông báo', 'Bạn đã gửi request cho plan này rồi!');
      } else {
        Alert.alert('Lỗi', 'Không thể gửi request, thử lại nhé!');
      }
    } else {
      Alert.alert('Đã gửi!', 'Chờ host xác nhận nhé!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/' as any) }
      ]);
    }
    setRequesting(null);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#065F46';
    if (score >= 50) return '#92400E';
    return '#374151';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return '#D1FAE5';
    if (score >= 50) return '#FEF3C7';
    return '#F3F4F6';
  };

  const renderPlan = ({ item }: { item: Plan }) => (
    <View style={styles.planCard}>
      {/* Header */}
      <View style={styles.planHeader}>
        <Text style={styles.planEmoji}>{CATEGORY_EMOJI[item.category] ?? '📍'}</Text>
        <View style={styles.planHeaderText}>
          <Text style={styles.planTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.planLocation}>📍 {item.location_text}</Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: getScoreBg(item.matchScore) }]}>
          <Text style={[styles.scoreText, { color: getScoreColor(item.matchScore) }]}>
            {item.matchScore}%
          </Text>
        </View>
      </View>

      {/* Time */}
      <Text style={styles.planTime}>🕐 {formatTime(item.scheduled_at)}</Text>

      {/* Match reasons */}
      <View style={styles.reasonsRow}>
        {item.matchReasons.map((r, i) => (
          <View key={i} style={styles.reasonChip}>
            <Text style={styles.reasonText}>{r}</Text>
          </View>
        ))}
      </View>

      {/* Description */}
      {!!item.description && (
        <Text style={styles.planDescription} numberOfLines={2}>{item.description}</Text>
      )}

      {/* Join button */}
      <TouchableOpacity
        style={styles.joinButton}
        onPress={() => handleRequestJoin(item)}
        disabled={requesting === item.id}
      >
        <Text style={styles.joinButtonText}>
          {requesting === item.id ? 'Đang gửi...' : '👋 Muốn tham gia'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Buddy gợi ý</Text>
            <Text style={styles.subtitle}>Dựa trên plan vừa tạo của bạn</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1E88E5" />
          </View>
        ) : (
          <FlatList
            data={plans}
            keyExtractor={item => item.id}
            renderItem={renderPlan}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              plans.length > 0 ? (
                <Text style={styles.resultCount}>{plans.length} plan phù hợp được tìm thấy</Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>Chưa có buddy phù hợp</Text>
                <Text style={styles.emptySubtitle}>Plan của bạn đã được đăng — chờ người khác tìm thấy bạn nhé!</Text>
                <TouchableOpacity
                  style={styles.homeButton}
                  onPress={() => router.replace('/(tabs)/' as any)}
                >
                  <Text style={styles.homeButtonText}>Về trang chủ</Text>
                </TouchableOpacity>
              </View>
            }
          />
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
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backButton: { width: 36, height: 36, backgroundColor: '#F5F7FB', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  backText: { fontSize: 18, color: PRIMARY_BLUE, fontWeight: '700' },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  resultCount: { fontSize: 13, color: '#9CA3AF', marginBottom: 12 },
  list: { paddingBottom: 32 },
  planCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  planEmoji: { fontSize: 28, marginRight: 10 },
  planHeaderText: { flex: 1 },
  planTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  planLocation: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  scoreBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  scoreText: { fontSize: 14, fontWeight: '700' },
  planTime: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  reasonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  reasonChip: { backgroundColor: LIGHT_BLUE, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  reasonText: { fontSize: 12, color: PRIMARY_BLUE, fontWeight: '600' },
  planDescription: { fontSize: 13, color: '#4B5563', lineHeight: 18, marginBottom: 12 },
  joinButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 12, padding: 12, alignItems: 'center' },
  joinButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 20 },
  homeButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  homeButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});