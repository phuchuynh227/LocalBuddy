import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

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

const CATEGORY_LABELS: Record<string, string> = {
  cafe: '☕ Cafe',
  gym: '🏋️ Gym',
  movies: '🎬 Movies',
  park: '🌳 Park',
  food: '🍽️ Food',
  study: '📚 Study',
};

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: '☕', gym: '🏋️', movies: '🎬',
  park: '🌳', food: '🍽️', study: '📚',
};

const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00',
];

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);

  // Create plan modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [description, setPlanDescription] = useState('');
  const [maxBuddies, setMaxBuddies] = useState(1);
  const [creating, setCreating] = useState(false);

  const dayRef = React.useRef<TextInput>(null);
  const monthRef = React.useRef<TextInput>(null);
  const yearRef = React.useRef<TextInput>(null);

  useEffect(() => {
    const fetchPlace = async () => {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) setPlace(data);
      setLoading(false);
    };
    fetchPlace();
  }, [id]);

  const handleCreatePlan = async () => {
    if (!day || !month || !year) {
      Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorDate'));
      return;
    }
    const dateStr = `${day}/${month}/${year}`;
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorInvalidDate'));
      return;
    }
    setCreating(true);
    const timeStr = timeSlot || '09:00';
    const scheduledAt = new Date(`${year}-${month}-${day}T${timeStr}:00`);
    const { error } = await supabase.from('plans').insert({
      host_id: user?.id,
      category: place?.category,
      title: place?.name,
      description: description.trim() || null,
      location_text: place?.address,
      scheduled_at: scheduledAt.toISOString(),
      max_buddies: maxBuddies,
      status: 'open',
    });
    if (error) {
      Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorCreate'));
    } else {
      Alert.alert(t('createPlan.planCreated'), t('createPlan.waitForBuddy'), [
        { text: t('common.ok'), onPress: () => setShowPlanModal(false) }
      ]);
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  if (!place) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('placeDetail.notFound')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>

        {/* Header */}
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderEmoji}>
            {CATEGORY_EMOJI[place.category] ?? '📍'}
          </Text>
        </View>

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{CATEGORY_LABELS[place.category]}</Text>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.placeName}>{place.name}</Text>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>⭐ {place.rating}</Text>
            </View>
          </View>

          <Text style={styles.reviewCount}>
            {t('placeDetail.reviewsCount', { count: place.review_count })}
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>{place.address}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>🕐</Text>
            <Text style={styles.infoText}>{place.opening_hours}</Text>
          </View>

          <Text style={styles.sectionTitle}>{t('placeDetail.description')}</Text>
          <Text style={styles.description}>{place.description}</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>🗺️ {t('placeDetail.viewMap')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]}>
              <Text style={styles.actionButtonSecondaryText}>🔖 {t('placeDetail.save')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => router.push(`/write-review?placeId=${place.id}&placeName=${encodeURIComponent(place.name)}` as any)}
          >
            <Text style={styles.reviewButtonText}>✏️ {t('placeDetail.writeReview')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky bottom — Tạo kế hoạch */}
      <View style={styles.stickyBottom}>
        <TouchableOpacity
          style={styles.createPlanButton}
          onPress={() => setShowPlanModal(true)}
        >
          <Text style={styles.createPlanButtonText}>
            📋 {t('placeDetail.createPlan')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Create Plan Modal */}
      <Modal visible={showPlanModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

              {/* Modal header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowPlanModal(false)} style={styles.closeButton}>
                  <Text style={styles.backText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{t('placeDetail.createPlan')}</Text>
              </View>

              {/* Auto-filled summary */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryEmoji}>{CATEGORY_EMOJI[place.category]}</Text>
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryName}>{place.name}</Text>
                  <Text style={styles.summaryAddr} numberOfLines={1}>{place.address}</Text>
                </View>
              </View>

              {/* Date */}
              <Text style={styles.label}>{t('createPlan.date')}</Text>
              <View style={styles.dateRow}>
                <TextInput
                  ref={dayRef}
                  style={[styles.input, styles.dateInput]}
                  placeholder="DD"
                  value={day}
                  onChangeText={text => {
                    const c = text.replace(/\D/g, '').slice(0, 2);
                    setDay(c);
                    if (c.length === 2) monthRef.current?.focus();
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.dateSep}>/</Text>
                <TextInput
                  ref={monthRef}
                  style={[styles.input, styles.dateInput]}
                  placeholder="MM"
                  value={month}
                  onChangeText={text => {
                    const c = text.replace(/\D/g, '').slice(0, 2);
                    setMonth(c);
                    if (c.length === 2) yearRef.current?.focus();
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.dateSep}>/</Text>
                <TextInput
                  ref={yearRef}
                  style={[styles.input, styles.dateInputYear]}
                  placeholder="YYYY"
                  value={year}
                  onChangeText={text => setYear(text.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="numeric"
                  maxLength={4}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Time */}
              <Text style={styles.label}>
                {t('createPlan.time')} <Text style={styles.optional}>{t('createPlan.timeOptional')}</Text>
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeSlotList}>
                <TouchableOpacity
                  style={[styles.timeSlot, timeSlot === '' && styles.timeSlotActive]}
                  onPress={() => setTimeSlot('')}
                >
                  <Text style={[styles.timeSlotText, timeSlot === '' && styles.timeSlotTextActive]}>
                    {t('createPlan.anyTime')}
                  </Text>
                </TouchableOpacity>
                {TIME_SLOTS.map(slot => (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.timeSlot, timeSlot === slot && styles.timeSlotActive]}
                    onPress={() => setTimeSlot(slot)}
                  >
                    <Text style={[styles.timeSlotText, timeSlot === slot && styles.timeSlotTextActive]}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Description */}
              <Text style={styles.label}>{t('createPlan.descriptionLabel')}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder={t('createPlan.descriptionPlaceholder')}
                value={description}
                onChangeText={setPlanDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor="#9CA3AF"
              />

              {/* Max buddies */}
              <Text style={styles.label}>{t('createPlan.maxBuddies')}</Text>
              <View style={styles.buddyRow}>
                <TouchableOpacity
                  style={styles.buddyButton}
                  onPress={() => setMaxBuddies(Math.max(1, maxBuddies - 1))}
                >
                  <Text style={styles.buddyButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.buddyCount}>{maxBuddies}</Text>
                <TouchableOpacity
                  style={styles.buddyButton}
                  onPress={() => setMaxBuddies(Math.min(10, maxBuddies + 1))}
                >
                  <Text style={styles.buddyButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreatePlan}
                disabled={creating}
              >
                <Text style={styles.submitButtonText}>
                  {creating ? t('createPlan.publishing') : `🚀 ${t('createPlan.publish')}`}
                </Text>
              </TouchableOpacity>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const PRIMARY_BLUE = '#1E88E5';
const LIGHT_BLUE = '#E3F2FD';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#9CA3AF' },
  imagePlaceholder: { width: '100%', height: 220, backgroundColor: LIGHT_BLUE, justifyContent: 'center', alignItems: 'center' },
  imagePlaceholderEmoji: { fontSize: 72 },
  backButton: { position: 'absolute', top: 48, left: 20, backgroundColor: '#fff', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  backText: { fontSize: 18, color: PRIMARY_BLUE, fontWeight: '700' },
  content: { padding: 20 },
  categoryBadge: { alignSelf: 'flex-start', backgroundColor: LIGHT_BLUE, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  categoryBadgeText: { fontSize: 13, fontWeight: '600', color: PRIMARY_BLUE },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  placeName: { fontSize: 22, fontWeight: '700', color: '#1A1A1A', flex: 1, marginRight: 12 },
  ratingBadge: { backgroundColor: LIGHT_BLUE, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  ratingText: { fontSize: 15, fontWeight: '700', color: PRIMARY_BLUE },
  reviewCount: { fontSize: 13, color: '#9CA3AF', marginBottom: 20 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  infoIcon: { fontSize: 16, marginRight: 10, marginTop: 1 },
  infoText: { fontSize: 14, color: '#374151', flex: 1, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginTop: 16, marginBottom: 8 },
  description: { fontSize: 14, color: '#4B5563', lineHeight: 22, marginBottom: 24 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  actionButton: { flex: 1, backgroundColor: PRIMARY_BLUE, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  actionButtonSecondary: { backgroundColor: '#F5F7FB', borderWidth: 1, borderColor: '#E5E7EB' },
  actionButtonSecondaryText: { color: '#374151', fontSize: 14, fontWeight: '600' },
  reviewButton: { backgroundColor: '#F5F7FB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  reviewButtonText: { color: '#374151', fontSize: 14, fontWeight: '600' },
  stickyBottom: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  createPlanButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 14, padding: 16, alignItems: 'center' },
  createPlanButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalContent: { padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  closeButton: { width: 36, height: 36, backgroundColor: '#F5F7FB', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: LIGHT_BLUE, borderRadius: 14, padding: 14, marginBottom: 8 },
  summaryEmoji: { fontSize: 32, marginRight: 12 },
  summaryInfo: { flex: 1 },
  summaryName: { fontSize: 16, fontWeight: '700', color: PRIMARY_BLUE, marginBottom: 4 },
  summaryAddr: { fontSize: 13, color: '#374151' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 14 },
  optional: { fontSize: 12, color: '#9CA3AF', fontWeight: '400' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A1A', backgroundColor: '#F9FAFB' },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateSep: { marginHorizontal: 8, color: '#9CA3AF', fontWeight: '700', fontSize: 16 },
  dateInput: { flex: 0, width: 72, textAlign: 'center' },
  dateInputYear: { flex: 0, width: 110, textAlign: 'center' },
  inputMultiline: { minHeight: 80 },
  timeSlotList: { marginBottom: 4 },
  timeSlot: { backgroundColor: '#F5F7FB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1.5, borderColor: 'transparent' },
  timeSlotActive: { backgroundColor: LIGHT_BLUE, borderColor: PRIMARY_BLUE },
  timeSlotText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  timeSlotTextActive: { color: PRIMARY_BLUE },
  buddyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  buddyButton: { width: 40, height: 40, backgroundColor: '#F5F7FB', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  buddyButtonText: { fontSize: 20, color: PRIMARY_BLUE, fontWeight: '700' },
  buddyCount: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginHorizontal: 20 },
  submitButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});