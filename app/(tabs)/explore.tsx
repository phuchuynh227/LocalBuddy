import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type Place = {
  id: string;
  name: string;
  description: string;
  category: string;
  address: string;
  rating: number;
  review_count: number;
  opening_hours: string;
  lat: number;
  lng: number;
};

type PhotonResult = {
  properties: {
    name: string;
    city?: string;
    street?: string;
    district?: string;
    country?: string;
  };
  geometry: {
    coordinates: [number, number]; // [lng, lat]
  };
};

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: '☕',
  gym: '🏋️',
  movies: '🎬',
  park: '🌳',
  food: '🍽️',
  study: '📚',
};

export default function ExploreScreen() {
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [filtered, setFiltered] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Photon autocomplete
  const [suggestions, setSuggestions] = useState<PhotonResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [selectedArea, setSelectedArea] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const debounceTimer = useRef<any>(null);

  const fetchPlaces = async (lat?: number, lng?: number) => {
    let query = supabase
      .from('places')
      .select('*')
      .order('rating', { ascending: false });

    // Nếu có tọa độ → filter theo khu vực (bán kính ~5km)
    if (lat && lng) {
      query = query
        .gte('lat', lat - 0.05)
        .lte('lat', lat + 0.05)
        .gte('lng', lng - 0.05)
        .lte('lng', lng + 0.05);
    }

    const { data, error } = await query;
    if (!error && data) {
      setPlaces(data);
      setFiltered(data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchPlaces();
  }, []);

  // Filter local search
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(places);
      return;
    }
    const keyword = search.toLowerCase();
    setFiltered(places.filter(p =>
      p.name.toLowerCase().includes(keyword) ||
      p.address.toLowerCase().includes(keyword) ||
      p.description.toLowerCase().includes(keyword)
    ));
  }, [search, places]);

  // Photon autocomplete debounce
  const handleSearchChange = (text: string) => {
    setSearch(text);
    setSelectedArea(null);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (text.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceTimer.current = setTimeout(async () => {
      setSearchingAddress(true);
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=5&lang=vi&bbox=107.8,15.8,108.6,16.4`
        );
        const json = await res.json();
        setSuggestions(json.features ?? []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
      setSearchingAddress(false);
    }, 400);
  };

  const handleSelectSuggestion = (item: PhotonResult) => {
    const [lng, lat] = item.geometry.coordinates;
    const name = [
      item.properties.name,
      item.properties.street,
      item.properties.district,
      item.properties.city,
    ].filter(Boolean).join(', ');

    setSearch(name);
    setSelectedArea({ lat, lng, name });
    setSuggestions([]);
    setShowSuggestions(false);
    setLoading(true);
    fetchPlaces(lat, lng);
  };

  const clearSearch = () => {
    setSearch('');
    setSelectedArea(null);
    setSuggestions([]);
    setShowSuggestions(false);
    fetchPlaces();
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPlaces(selectedArea?.lat, selectedArea?.lng);
  };

  const renderPlace = ({ item }: { item: Place }) => (
    <TouchableOpacity
      style={styles.placeCard}
      activeOpacity={0.9}
      onPress={() => router.push(`/place-detail?id=${item.id}` as any)}
    >
      <View style={styles.placeLeft}>
        <Text style={styles.placeEmoji}>{CATEGORY_EMOJI[item.category] ?? '📍'}</Text>
      </View>
      <View style={styles.placeRight}>
        <View style={styles.placeHeader}>
          <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.ratingText}>⭐ {item.rating}</Text>
        </View>
        <Text style={styles.placeAddress} numberOfLines={1}>📍 {item.address}</Text>
        <Text style={styles.placeDescription} numberOfLines={1}>{item.description}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSuggestion = ({ item }: { item: PhotonResult }) => {
    const name = item.properties.name ?? '';
    const detail = [item.properties.street, item.properties.district, item.properties.city]
      .filter(Boolean).join(', ');
    return (
      <TouchableOpacity
        style={styles.suggestionItem}
        onPress={() => handleSelectSuggestion(item)}
      >
        <Text style={styles.suggestionIcon}>📍</Text>
        <View style={styles.suggestionText}>
          <Text style={styles.suggestionName} numberOfLines={1}>{name}</Text>
          {!!detail && <Text style={styles.suggestionDetail} numberOfLines={1}>{detail}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.pageTitle}>Khám phá</Text>
        <Text style={styles.pageSubtitle}>Tìm địa điểm tại Đà Nẵng</Text>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm địa chỉ, tên địa điểm..."
            value={search}
            onChangeText={handleSearchChange}
            placeholderTextColor="#9CA3AF"
          />
          {searchingAddress && <ActivityIndicator size="small" color="#1E88E5" style={{ marginRight: 8 }} />}
          {search.length > 0 && !searchingAddress && (
            <TouchableOpacity onPress={clearSearch}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Selected area badge */}
        {selectedArea && (
          <View style={styles.areaBadge}>
            <Text style={styles.areaBadgeText}>📍 {selectedArea.name}</Text>
          </View>
        )}

        {/* Photon suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            <FlatList
              data={suggestions}
              keyExtractor={(_, i) => i.toString()}
              renderItem={renderSuggestion}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Result count */}
        {!loading && !showSuggestions && (
          <Text style={styles.resultCount}>
            {filtered.length} địa điểm{selectedArea ? ` gần "${selectedArea.name}"` : ''}
          </Text>
        )}

        {/* List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1E88E5" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={renderPlace}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.placesList}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E88E5']} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyText}>
                  {selectedArea ? 'Chưa có địa điểm trong khu vực này' : 'Không tìm thấy địa điểm nào'}
                </Text>
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
  pageTitle: { fontSize: 26, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  pageSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1A1A1A' },
  clearText: { fontSize: 14, color: '#9CA3AF', paddingLeft: 8 },
  areaBadge: { backgroundColor: LIGHT_BLUE, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 8 },
  areaBadgeText: { fontSize: 12, color: PRIMARY_BLUE, fontWeight: '600' },
  suggestionsBox: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8, elevation: 4 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  suggestionIcon: { fontSize: 16, marginRight: 10 },
  suggestionText: { flex: 1 },
  suggestionName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  suggestionDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  resultCount: { fontSize: 13, color: '#9CA3AF', marginBottom: 12 },
  placesList: { paddingBottom: 32 },
  placeCard: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  placeLeft: { width: 48, height: 48, backgroundColor: LIGHT_BLUE, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  placeEmoji: { fontSize: 22 },
  placeRight: { flex: 1, justifyContent: 'center' },
  placeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  placeName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', flex: 1, marginRight: 8 },
  ratingText: { fontSize: 13, fontWeight: '600', color: PRIMARY_BLUE },
  placeAddress: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  placeDescription: { fontSize: 12, color: '#9CA3AF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
});