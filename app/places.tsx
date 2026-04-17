import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

type Place = {
  id: string;
  name: string;
  description: string;
  category: string;
  address: string;
  rating: number;
  review_count: number;
  opening_hours: string;
};

export default function PlacesScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(category ?? 'cafe');

  const CATEGORIES = ['cafe', 'gym', 'movies', 'park', 'food', 'study'] as const;

  const categoryLabel = (cat: string) => {
    const emoji =
      cat === 'cafe' ? '☕' :
      cat === 'gym' ? '🏋️' :
      cat === 'movies' ? '🎬' :
      cat === 'park' ? '🌳' :
      cat === 'food' ? '🍽️' :
      cat === 'study' ? '📚' : '📍';
    return `${emoji} ${t(`categories.${cat}`)}`;
  };

  const fetchPlaces = async (cat: string) => {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('category', cat)
      .order('rating', { ascending: false });
    if (!error && data) setPlaces(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchPlaces(selectedCategory);
  }, [selectedCategory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlaces(selectedCategory);
  };

  const renderPlace = ({ item }: { item: Place }) => (
    <TouchableOpacity
    style={styles.placeCard}
    activeOpacity={0.9}
    onPress={() => router.push(`/place-detail?id=${item.id}` as any)}
  >
      <View style={styles.placeHeader}>
        <Text style={styles.placeName}>{item.name}</Text>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>⭐ {item.rating}</Text>
        </View>
      </View>
      <Text style={styles.placeAddress}>📍 {item.address}</Text>
      <Text style={styles.placeDescription} numberOfLines={2}>{item.description}</Text>
      <View style={styles.placeFooter}>
        <Text style={styles.placeHours}>🕐 {item.opening_hours}</Text>
        <Text style={styles.placeReviews}>{t('places.reviewsCount', { count: item.review_count })}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← {t('places.backToHome')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.pageTitle}>{categoryLabel(selectedCategory)}</Text>

        {/* Category filter tabs */}
        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item}
          style={styles.categoryList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.categoryChip, selectedCategory === item && styles.categoryChipActive]}
              onPress={() => {
                setSelectedCategory(item);
                setLoading(true);
              }}
            >
              <Text style={[styles.categoryChipText, selectedCategory === item && styles.categoryChipTextActive]}>
                {categoryLabel(item)}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Places list */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1E88E5" />
          </View>
        ) : (
          <FlatList
            data={places}
            keyExtractor={item => item.id}
            renderItem={renderPlace}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.placesList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E88E5']} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>{t('places.empty')}</Text>
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
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8, backgroundColor: '#FFFFFF' },
  header: { marginBottom: 8 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { fontSize: 14, color: PRIMARY_BLUE, fontWeight: '600' },
  pageTitle: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },
  categoryList: { marginBottom: 16, flexGrow: 0 },
  categoryChip: { backgroundColor: '#F5F7FB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  categoryChipActive: { backgroundColor: PRIMARY_BLUE },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  categoryChipTextActive: { color: '#FFFFFF' },
  placesList: { paddingBottom: 32 },
  placeCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  placeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  placeName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', flex: 1, marginRight: 8 },
  ratingBadge: { backgroundColor: LIGHT_BLUE, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  ratingText: { fontSize: 13, fontWeight: '600', color: PRIMARY_BLUE },
  placeAddress: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  placeDescription: { fontSize: 13, color: '#4B5563', marginBottom: 8, lineHeight: 18 },
  placeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  placeHours: { fontSize: 12, color: '#6B7280' },
  placeReviews: { fontSize: 12, color: '#9CA3AF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
});