import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    SafeAreaView,
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

type Request = {
  id: string;
  requester_id: string;
  status: string;
  message: string;
  created_at: string;
  requester_email?: string;
};

type Plan = {
  id: string;
  category: string;
  title: string;
  location_text: string;
  scheduled_at: string;
  max_buddies: number;
  status: string;
  plan_requests: Request[];
};

export default function MyPlansScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from('plans')
      .select(`
        *,
        plan_requests (
          id, requester_id, status, message, created_at
        )
      `)
      .eq('host_id', user?.id)
      .order('scheduled_at', { ascending: true });

    if (!error && data) setPlans(data as Plan[]);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const onRefresh = () => { setRefreshing(true); fetchPlans(); };

  const handleAccept = async (request: Request, plan: Plan) => {
    const acceptedCount = plan.plan_requests.filter(r => r.status === 'accepted').length;
    if (acceptedCount >= plan.max_buddies) {
      Alert.alert('Đầy chỗ', 'Plan đã đủ buddy rồi!');
      return;
    }
    setProcessing(request.id);

    const { error } = await supabase
      .from('plan_requests')
      .update({ status: 'accepted' })
      .eq('id', request.id);

    if (!error) {
      // Tạo match record
      await supabase.from('matches').upsert ({
        plan_id: plan.id,
        user1_id: user?.id,
        user2_id: request.requester_id,
      });

      // Nếu đã đủ buddy → đóng plan
      if (acceptedCount + 1 >= plan.max_buddies) {
        await supabase.from('plans').update({ status: 'full' }).eq('id', plan.id);
      }

      fetchPlans();
    } else {
      Alert.alert('Lỗi', 'Không thể xác nhận, thử lại nhé!');
    }
    setProcessing(null);
  };

  const handleDecline = async (request: Request) => {
    Alert.alert('Từ chối?', 'Bạn chắc chắn muốn từ chối request này?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Từ chối', style: 'destructive',
        onPress: async () => {
          setProcessing(request.id);
          await supabase
            .from('plan_requests')
            .update({ status: 'declined' })
            .eq('id', request.id);
          fetchPlans();
          setProcessing(null);
        }
      }
    ]);
  };

  const handleCancelPlan = async (planId: string) => {
    Alert.alert('Huỷ plan?', 'Bạn chắc chắn muốn huỷ plan này?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Huỷ plan', style: 'destructive',
        onPress: async () => {
          await supabase.from('plans').update({ status: 'cancelled' }).eq('id', planId);
          fetchPlans();
        }
      }
    ]);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} — ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const getStatusStyle = (status: string) => {
    if (status === 'open') return { bg: '#D1FAE5', color: '#065F46', label: 'Đang mở' };
    if (status === 'full') return { bg: '#FEF3C7', color: '#92400E', label: 'Đã đầy' };
    if (status === 'cancelled') return { bg: '#FEE2E2', color: '#991B1B', label: 'Đã huỷ' };
    return { bg: '#F3F4F6', color: '#374151', label: status };
  };

  const renderRequest = (request: Request, plan: Plan) => {
    const isPending = request.status === 'pending';
    const isAccepted = request.status === 'accepted';
    const isDeclined = request.status === 'declined';

    return (
      <View key={request.id} style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requesterAvatar}>
            <Text style={styles.requesterAvatarText}>
              {request.requester_id.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.requestInfo}>
            <Text style={styles.requesterId} numberOfLines={1}>
              Buddy #{request.requester_id.slice(0, 8)}
            </Text>
            <Text style={styles.requestTime}>
              {new Date(request.created_at).toLocaleDateString('vi-VN')}
            </Text>
          </View>
          {/* Status badge */}
          {isAccepted && (
            <View style={[styles.statusChip, { backgroundColor: '#D1FAE5' }]}>
              <Text style={[styles.statusChipText, { color: '#065F46' }]}>Đã accept</Text>
            </View>
          )}
          {isDeclined && (
            <View style={[styles.statusChip, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.statusChipText, { color: '#991B1B' }]}>Đã từ chối</Text>
            </View>
          )}
        </View>

        {!!request.message && (
          <Text style={styles.requestMessage}>"{request.message}"</Text>
        )}

        {isPending && (
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => handleDecline(request)}
              disabled={processing === request.id}
            >
              <Text style={styles.declineButtonText}>✕ Từ chối</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAccept(request, plan)}
              disabled={processing === request.id}
            >
              <Text style={styles.acceptButtonText}>
                {processing === request.id ? '...' : `✓ ${t('myPlans.accept')}`}
            </Text>
            </TouchableOpacity>
          </View>
        )}

        {isAccepted && (
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => router.push(`/chat?matchUserId=${request.requester_id}&planTitle=${encodeURIComponent(plan.title)}` as any)}
          >
            <Text style={styles.chatButtonText}>💬 Nhắn tin</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderPlan = ({ item }: { item: Plan }) => {
    const statusStyle = getStatusStyle(item.status);
    const pendingRequests = item.plan_requests.filter(r => r.status === 'pending');
    const acceptedRequests = item.plan_requests.filter(r => r.status === 'accepted');

    return (
      <View style={styles.planCard}>
        {/* Plan header */}
        <View style={styles.planHeader}>
          <Text style={styles.planEmoji}>{CATEGORY_EMOJI[item.category] ?? '📍'}</Text>
          <View style={styles.planInfo}>
            <Text style={styles.planTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.planMeta}>📍 {item.location_text}</Text>
            <Text style={styles.planMeta}>🕐 {formatTime(item.scheduled_at)}</Text>
          </View>
          <View style={[styles.planStatusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.planStatusText, { color: statusStyle.color }]}>
              {statusStyle.label}
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{acceptedRequests.length}/{item.max_buddies}</Text>
            <Text style={styles.statLabel}>Buddy</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, pendingRequests.length > 0 && styles.statValueAlert]}>
              {pendingRequests.length}
            </Text>
            <Text style={styles.statLabel}>Chờ duyệt</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.plan_requests.length}</Text>
            <Text style={styles.statLabel}>Tổng requests</Text>
          </View>
        </View>

        {/* Requests */}
        {item.plan_requests.length > 0 && (
          <View style={styles.requestsSection}>
            <Text style={styles.requestsSectionTitle}>Requests</Text>
            {item.plan_requests.map(req => renderRequest(req, item))}
          </View>
        )}

        {/* Cancel plan */}
        {item.status === 'open' && (
          <TouchableOpacity
            style={styles.cancelPlanButton}
            onPress={() => handleCancelPlan(item.id)}
          >
            <Text style={styles.cancelPlanText}>Huỷ plan</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Plans của tôi</Text>
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E88E5']} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyTitle}>Chưa có plan nào</Text>
                <Text style={styles.emptySubtitle}>Tạo plan đầu tiên để tìm buddy nhé!</Text>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => router.push('/create-plan' as any)}
                >
                  <Text style={styles.createButtonText}>➕ Tạo plan</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { width: 36, height: 36, backgroundColor: '#F5F7FB', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  backText: { fontSize: 18, color: PRIMARY_BLUE, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  list: { paddingBottom: 32 },
  planCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  planEmoji: { fontSize: 28, marginRight: 12 },
  planInfo: { flex: 1 },
  planTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  planMeta: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  planStatusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  planStatusText: { fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  statValueAlert: { color: '#1E88E5' },
  statLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 8 },
  requestsSection: { marginBottom: 12 },
  requestsSectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  requestCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  requestHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  requesterAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: LIGHT_BLUE, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  requesterAvatarText: { fontSize: 16, fontWeight: '700', color: PRIMARY_BLUE },
  requestInfo: { flex: 1 },
  requesterId: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  requestTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  statusChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusChipText: { fontSize: 12, fontWeight: '600' },
  requestMessage: { fontSize: 13, color: '#4B5563', fontStyle: 'italic', marginBottom: 10, paddingLeft: 46 },
  requestActions: { flexDirection: 'row', gap: 8 },
  declineButton: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 10, padding: 10, alignItems: 'center' },
  declineButtonText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  acceptButton: { flex: 1, backgroundColor: '#D1FAE5', borderRadius: 10, padding: 10, alignItems: 'center' },
  acceptButtonText: { fontSize: 14, fontWeight: '600', color: '#065F46' },
  chatButton: { backgroundColor: LIGHT_BLUE, borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 4 },
  chatButtonText: { fontSize: 14, fontWeight: '600', color: PRIMARY_BLUE },
  cancelPlanButton: { alignItems: 'center', paddingVertical: 8 },
  cancelPlanText: { fontSize: 13, color: '#DC2626', fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  createButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  createButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});