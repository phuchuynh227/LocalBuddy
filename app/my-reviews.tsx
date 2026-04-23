import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppBottomNav } from '../components/AppBottomNav';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

type ReviewRow = {
  id: string;
  rating: number;
  comment: string;
  created_at?: string;
  place_id?: string;
  place?: { id?: string; name?: string } | null;
};

export default function MyReviewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);

  const dateFormatter = useMemo(() => {
    const locale = language === 'vn' ? 'vi-VN' : 'en-US';
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: '2-digit' });
  }, [language]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!user?.id) {
        if (!alive) return;
        setReviews([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data } = await supabase
        .from('reviews')
        // tries to pull related place name if FK relationship exists
        .select('id, rating, comment, created_at, place_id, place:places(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!alive) return;
      setReviews((data as any) ?? []);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const renderItem = ({ item }: { item: ReviewRow }) => {
    const placeName = item.place?.name ?? t('myReviews.unknownPlace');
    const createdAt = item.created_at ? new Date(item.created_at) : null;
    const dateText = createdAt && !isNaN(createdAt.getTime()) ? dateFormatter.format(createdAt) : '';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          const placeId = item.place?.id ?? item.place_id;
          if (placeId) router.push(`/place-detail?id=${placeId}` as any);
        }}
      >
        <View style={styles.cardTop}>
          <Text style={styles.placeName} numberOfLines={1}>{placeName}</Text>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>⭐ {item.rating}</Text>
          </View>
        </View>
        {!!dateText && <Text style={styles.dateText}>{dateText}</Text>}
        <Text style={styles.comment} numberOfLines={3}>{item.comment}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.9}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('myReviews.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY_BLUE} />
          <Text style={styles.loadingText}>{t('myReviews.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={reviews.length === 0 ? styles.emptyContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>✏️</Text>
              <Text style={styles.emptyText}>{t('myReviews.empty')}</Text>
            </View>
          }
        />
      )}
      <AppBottomNav />
    </SafeAreaView>
  );
}

const PRIMARY_BLUE = '#1E88E5';
const LIGHT_BLUE = '#E3F2FD';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 36,
    height: 36,
    backgroundColor: '#F5F7FB',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backText: { fontSize: 18, color: PRIMARY_BLUE, fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  loadingText: { marginTop: 10, fontSize: 13, color: '#9CA3AF' },
  listContent: { padding: 20, paddingBottom: 104 },
  emptyContainer: { flexGrow: 1, padding: 20, paddingBottom: 104 },
  emptyEmoji: { fontSize: 44, marginBottom: 10 },
  emptyText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  placeName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', flex: 1 },
  ratingBadge: { backgroundColor: LIGHT_BLUE, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  ratingText: { fontSize: 13, fontWeight: '700', color: PRIMARY_BLUE },
  dateText: { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },
  comment: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
});
