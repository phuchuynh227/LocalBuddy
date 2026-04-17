import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

// Lazy load maps chỉ cho native
let MapView: any, Marker: any, Callout: any, PROVIDER_DEFAULT: any;
if (Platform.OS !== 'web') {
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    Callout = maps.Callout;
    PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
}

type Place = {
  id: string;
  name: string;
  description: string;
  category: string;
  address: string;
  rating: number;
  lat: number;
  lng: number;
};

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: '☕',
  gym: '🏋️',
  movies: '🎬',
  park: '🌳',
  food: '🍽️',
  study: '📚',
};

export default function MapScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlaces = async () => {
      const { data, error } = await supabase
        .from('places')
        .select('id, name, description, category, address, rating, lat, lng')
        .not('lat', 'is', null);
      if (!error && data) setPlaces(data);
      setLoading(false);
    };
    fetchPlaces();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  // Web: hiển thị danh sách thay vì map
  if (Platform.OS === 'web' || !MapView) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('map.title')}</Text>
          <Text style={styles.count}>{t('map.count', { count: places.length })}</Text>
        </View>
        <View style={styles.webList}>
          <Text style={styles.webNote}>📍 Danh sách địa điểm ({places.length})</Text>
          {places.slice(0, 20).map(place => (
            <TouchableOpacity
              key={place.id}
              style={styles.webItem}
              onPress={() => router.push(`/place-detail?id=${place.id}` as any)}
            >
              <Text style={styles.webItemEmoji}>{CATEGORY_EMOJI[place.category] ?? '📍'}</Text>
              <View style={styles.webItemInfo}>
                <Text style={styles.webItemName}>{place.name}</Text>
                <Text style={styles.webItemAddr}>{place.address}</Text>
                <Text style={styles.webItemRating}>⭐ {place.rating}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('map.title')}</Text>
        <Text style={styles.count}>{t('map.count', { count: places.length })}</Text>
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: 16.0544,
          longitude: 108.2022,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
      >
        {places.map(place => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            title={place.name}
          >
            {/* Custom emoji marker */}
            <View style={styles.marker}>
              <Text style={styles.markerEmoji}>{CATEGORY_EMOJI[place.category] ?? '📍'}</Text>
            </View>

            {/* Callout khi bấm vào marker */}
            <Callout onPress={() => router.push(`/place-detail?id=${place.id}` as any)}>
              <View style={styles.callout}>
                <Text style={styles.calloutName}>{place.name}</Text>
                <Text style={styles.calloutAddress} numberOfLines={1}>{place.address}</Text>
                <Text style={styles.calloutRating}>⭐ {place.rating}</Text>
                <Text style={styles.calloutAction}>{t('map.viewDetail')}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { width: 36, height: 36, backgroundColor: '#F5F7FB', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  backText: { fontSize: 18, color: '#1E88E5', fontWeight: '700' },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', flex: 1 },
  count: { fontSize: 13, color: '#9CA3AF' },
  map: { flex: 1 },
  marker: { backgroundColor: '#fff', borderRadius: 20, padding: 4, borderWidth: 2, borderColor: '#1E88E5', elevation: 3 },
  markerEmoji: { fontSize: 20 },
  callout: { width: 200, padding: 10 },
  calloutName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  calloutAddress: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  calloutRating: { fontSize: 13, fontWeight: '600', color: '#1E88E5', marginBottom: 6 },
  calloutAction: { fontSize: 12, color: '#1E88E5', fontWeight: '600', textAlign: 'right' },
  webList: { flex: 1, padding: 16 },
  webNote: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 16 },
  webItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  webItemEmoji: { fontSize: 24, marginRight: 12 },
  webItemInfo: { flex: 1 },
  webItemName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  webItemAddr: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  webItemRating: { fontSize: 12, fontWeight: '600', color: '#1E88E5', marginTop: 2 },
});