import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const CATEGORIES = [
  { key: 'cafe', emoji: '☕' },
  { key: 'gym', emoji: '🏋️' },
  { key: 'movies', emoji: '🎬' },
  { key: 'park', emoji: '🌳' },
  { key: 'food', emoji: '🍽️' },
  { key: 'study', emoji: '📚' },
];

const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00',
];

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
  matchReasons: string[];
  joined_count?: number;
};

function calcMatch(plan: any, category: string, timeSlot: string, date: string): { match: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (plan.category !== category) return { match: false, reasons: [] };
  reasons.push('activity');
  if (date) {
    const [day, month, year] = date.split('/');
    const myDate = `${year}-${month}-${day}`;
    const planDate = new Date(plan.scheduled_at).toISOString().split('T')[0];
    if (planDate !== myDate) return { match: false, reasons: [] };
    reasons.push('date');
  }
  if (timeSlot) {
    const planHour = new Date(plan.scheduled_at).getHours();
    const myHour = parseInt(timeSlot.split(':')[0]);
    if (Math.abs(planHour - myHour) === 0) reasons.push('timeExact');
    else if (Math.abs(planHour - myHour) <= 1) reasons.push('timeNear');
  }
  return { match: true, reasons };
}

export default function CreatePlanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Step 1 & 2 state
  const [category, setCategory] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const date = useMemo(() => {
    if (day.length !== 2 || month.length !== 2 || year.length !== 4) return '';
    return `${day}/${month}/${year}`;
  }, [day, month, year]);
  const [timeSlot, setTimeSlot] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Plan[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);

  // Create plan modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [locationText, setLocationText] = useState('');
  const [description, setDescription] = useState('');
  const [maxBuddies, setMaxBuddies] = useState(1);
  const [creating, setCreating] = useState(false);

  // Place search state
  const [placeSearch, setPlaceSearch] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<any[]>([]);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const placeSearchTimer = useRef<any>(null);

  const dayRef = useRef<TextInput>(null);
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const categoryEmoji = CATEGORY_EMOJI[category] ?? '📍';
  const summaryTime = timeSlot ? timeSlot : t('createPlan.anyTime');

  const reasonLabel = (key: string) => {
    if (key === 'activity') return t('createPlan.reasonActivity');
    if (key === 'date') return t('createPlan.reasonDate');
    if (key === 'timeExact') return t('createPlan.reasonTimeExact');
    if (key === 'timeNear') return t('createPlan.reasonTimeNear');
    return key;
  };

  useEffect(() => {
    if (showSuggestions) setCollapsed(true);
  }, [showSuggestions]);

  const handleFindSuggestions = async () => {
    if (!category) { Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorCategory')); return; }
    if (!date) { Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorDate')); return; }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) { Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorInvalidDate')); return; }
    setLoadingSuggest(true);
    setShowSuggestions(true);
    const { data, error } = await supabase
      .from('plans')
      .select('*, plan_requests(id, status)')
      .eq('status', 'open')
      .neq('host_id', user?.id)
      .order('created_at', { ascending: false });
    if (!error && data) {
      const matched = data
        .map(p => {
          const { match, reasons } = calcMatch(p, category, timeSlot, date);
          if (!match) return null;
          const joinedCount = (p.plan_requests ?? []).filter((r: any) => r.status === 'accepted').length;
          return { ...p, matchReasons: reasons, joined_count: joinedCount };
        })
        .filter(Boolean) as Plan[];
      setSuggestions(matched);
    }
    setLoadingSuggest(false);
  };

  const handleRequestJoin = async (plan: Plan) => {
    const remaining = plan.max_buddies - (plan.joined_count ?? 0);
    if (remaining <= 0) { Alert.alert(t('createPlan.full'), t('createPlan.fullAlert')); return; }
    setRequesting(plan.id);
    const { error } = await supabase.from('plan_requests').insert({
      plan_id: plan.id,
      requester_id: user?.id,
      message: `👋 ${t('createPlan.join')}`,
    });
    if (error) {
      Alert.alert(
        error.code === '23505' ? t('createPlan.requestSent') : t('writeReview.errorTitle'),
        error.code === '23505' ? t('createPlan.alreadyRequested') : t('createPlan.errorRequest'),
      );
    } else {
      Alert.alert(t('createPlan.requestSent'), t('createPlan.waitForHost'), [
        { text: t('common.ok'), onPress: () => router.replace('/(tabs)/' as any) }
      ]);
    }
    setRequesting(null);
  };

  // Place search handler
  const handlePlaceSearch = useCallback(async (text: string) => {
    setPlaceSearch(text);
    setTitle(text);
    if (placeSearchTimer.current) clearTimeout(placeSearchTimer.current);
    if (text.length < 2) { setPlaceSuggestions([]); return; }
    placeSearchTimer.current = setTimeout(async () => {
      setSearchingPlace(true);
      const query = supabase
        .from('places')
        .select('id, name, address, category')
        .ilike('name', `%${text}%`)
        .limit(6);
      if (category) query.eq('category', category);
      const { data } = await query;
      setPlaceSuggestions(data ?? []);
      setSearchingPlace(false);
    }, 300);
  }, [category]);

  const handleSelectPlace = (place: any) => {
    setTitle(place.name);
    setLocationText(place.address ?? '');
    setPlaceSearch(place.name);
    setPlaceSuggestions([]);
  };

  const handleCreatePlan = async () => {
    if (!title.trim()) { Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorTitle')); return; }
    if (!locationText.trim()) { Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorArea')); return; }
    setCreating(true);
    const [d, m, y] = date.split('/');
    const timeStr = timeSlot || '09:00';
    const scheduledAt = new Date(`${y}-${m}-${d}T${timeStr}:00`);
    const { error } = await supabase.from('plans').insert({
      host_id: user?.id,
      category,
      title: title.trim(),
      description: description.trim() || null,
      location_text: locationText.trim(),
      scheduled_at: scheduledAt.toISOString(),
      max_buddies: maxBuddies,
      status: 'open',
    });
    if (error) {
      Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorCreate'));
    } else {
      Alert.alert(t('createPlan.planCreated'), t('createPlan.waitForBuddy'), [
        { text: t('common.ok'), onPress: () => router.replace('/(tabs)/' as any) }
      ]);
    }
    setCreating(false);
    setShowCreateModal(false);
  };

  const openCreateModal = () => {
    if (!category) { Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorCategory')); return; }
    if (!date) { Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorDate')); return; }
    setShowCreateModal(true);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} — ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('createPlan.title')}</Text>
        </View>

        {/* Collapsed summary or full form */}
        {collapsed ? (
          <View style={styles.compactRow}>
            <View style={styles.compactLeft}>
              <View style={styles.compactBadge}>
                <Text style={styles.compactEmoji}>{categoryEmoji}</Text>
              </View>
              <View style={styles.compactTextCol}>
                <Text style={styles.compactLine} numberOfLines={1}>
                  {date} • {summaryTime}
                </Text>
                <Text style={styles.compactSubLine}>{t(`categories.${category}`)}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editButton} onPress={() => setCollapsed(false)}>
              <Text style={styles.editButtonText}>✏️ Edit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Category */}
            <Text style={styles.sectionTitle}>{t('createPlan.whatToDo')}</Text>
            <View style={styles.categoriesGrid}>
              {CATEGORIES.map(item => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.categoryCard, category === item.key && styles.categoryCardActive]}
                  onPress={() => setCategory(item.key)}
                >
                  <Text style={styles.categoryEmoji}>{item.emoji}</Text>
                  <Text style={[styles.categoryLabel, category === item.key && styles.categoryLabelActive]}>
                    {t(`categories.${item.key}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date + Time */}
            <Text style={styles.sectionTitle}>{t('createPlan.when')}</Text>
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
          </>
        )}

        {/* Find button */}
        <TouchableOpacity style={styles.findButton} onPress={handleFindSuggestions}>
          <Text style={styles.findButtonText}>🔍 {t('createPlan.findButton')}</Text>
        </TouchableOpacity>

        {/* Suggestions */}
        {showSuggestions && (
          <View style={styles.suggestSection}>
            <Text style={styles.suggestTitle}>
              {loadingSuggest
                ? t('createPlan.searching')
                : suggestions.length > 0
                  ? t('createPlan.foundPlans', { count: suggestions.length })
                  : t('createPlan.noPlans')}
            </Text>
            {loadingSuggest ? (
              <ActivityIndicator size="large" color="#1E88E5" style={{ marginTop: 20 }} />
            ) : (
              suggestions.map(item => {
                const remaining = item.max_buddies - (item.joined_count ?? 0);
                const isFull = remaining <= 0;
                return (
                  <View key={item.id} style={styles.planCard}>
                    <View style={styles.planHeader}>
                      <Text style={styles.planEmoji}>{CATEGORY_EMOJI[item.category] ?? '📍'}</Text>
                      <View style={styles.planHeaderText}>
                        <Text style={styles.planTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.planLocation}>📍 {item.location_text}</Text>
                      </View>
                      <View style={[styles.slotBadge, isFull && styles.slotBadgeFull]}>
                        <Text style={[styles.slotText, isFull && styles.slotTextFull]}>
                            {isFull
                            ? t('createPlan.full')
                            : `${item.joined_count ?? 0}/${item.max_buddies} buddy`}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.planTime}>🕐 {formatTime(item.scheduled_at)}</Text>
                    <View style={styles.reasonsRow}>
                      {item.matchReasons.map((r, i) => (
                        <View key={i} style={styles.reasonChip}>
                          <Text style={styles.reasonText}>{reasonLabel(r)}</Text>
                        </View>
                      ))}
                    </View>
                    {!!item.description && (
                      <Text style={styles.planDescription} numberOfLines={2}>{item.description}</Text>
                    )}
                    <TouchableOpacity
                      style={[styles.joinButton, isFull && styles.joinButtonDisabled]}
                      onPress={() => !isFull && handleRequestJoin(item)}
                      disabled={requesting === item.id || isFull}
                    >
                      <Text style={styles.joinButtonText}>
                        {requesting === item.id
                          ? t('createPlan.joining')
                          : isFull
                            ? t('createPlan.full')
                            : `👋 ${t('createPlan.join')}`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Sticky bottom — hiện từ đầu */}
      {!loadingSuggest && (
        <View style={styles.stickyBottom}>
          <TouchableOpacity style={styles.createOwnButton} onPress={openCreateModal}>
            <Text style={styles.createOwnText}>➕ {t('createPlan.createOwn')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Create Plan Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.backButton}>
                  <Text style={styles.backText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{t('createPlan.modalTitle')}</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryText}>
                  {CATEGORY_EMOJI[category]} {t(`categories.${category}`)}
                  {timeSlot ? ` • ${timeSlot}` : ` • ${t('createPlan.anyTime')}`}
                  {date ? ` • ${date}` : ''}
                </Text>
              </View>

              {/* Place search = title */}
              <Text style={styles.label}>{t('createPlan.planTitleLabel')}</Text>
              <View>
                <TextInput
                  style={styles.input}
                  placeholder={t('createPlan.planTitlePlaceholder')}
                  value={placeSearch}
                  onChangeText={handlePlaceSearch}
                  placeholderTextColor="#9CA3AF"
                />
                {searchingPlace && (
                  <ActivityIndicator
                    size="small"
                    color="#1E88E5"
                    style={{ position: 'absolute', right: 14, top: 14 }}
                  />
                )}
              </View>

              {/* Place suggestions dropdown */}
              {placeSuggestions.length > 0 && (
                <View style={styles.placeSuggestBox}>
                  {placeSuggestions.map(place => (
                    <TouchableOpacity
                      key={place.id}
                      style={styles.placeSuggestItem}
                      onPress={() => handleSelectPlace(place)}
                    >
                      <Text style={styles.placeSuggestName} numberOfLines={1}>
                        {CATEGORY_EMOJI[place.category] ?? '📍'} {place.name}
                      </Text>
                      <Text style={styles.placeSuggestAddr} numberOfLines={1}>
                        {place.address}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Area */}
              <Text style={styles.label}>{t('createPlan.area')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('createPlan.areaPlaceholder')}
                value={locationText}
                onChangeText={setLocationText}
                placeholderTextColor="#9CA3AF"
              />

              {/* Description */}
              <Text style={styles.label}>{t('createPlan.descriptionLabel')}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder={t('createPlan.descriptionPlaceholder')}
                value={description}
                onChangeText={setDescription}
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

              <TouchableOpacity style={styles.submitButton} onPress={handleCreatePlan} disabled={creating}>
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
  scrollContent: { padding: 20, paddingBottom: 20 },
  modalContent: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: { width: 36, height: 36, backgroundColor: '#F5F7FB', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  backText: { fontSize: 18, color: PRIMARY_BLUE, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 14 },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 24 },
  categoryCard: { width: '48%', backgroundColor: '#F5F7FB', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  categoryCardActive: { borderColor: PRIMARY_BLUE, backgroundColor: LIGHT_BLUE },
  categoryEmoji: { fontSize: 26, marginBottom: 4 },
  categoryLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  categoryLabelActive: { color: PRIMARY_BLUE },
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
  findButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 },
  findButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  compactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: LIGHT_BLUE, borderRadius: 14, padding: 12, marginBottom: 18 },
  compactLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  compactBadge: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  compactEmoji: { fontSize: 22 },
  compactTextCol: { flex: 1 },
  compactLine: { fontSize: 14, fontWeight: '700', color: PRIMARY_BLUE },
  compactSubLine: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  editButton: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  editButtonText: { fontSize: 13, fontWeight: '700', color: PRIMARY_BLUE },
  suggestSection: { marginTop: 28 },
  suggestTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 14 },
  planCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  planEmoji: { fontSize: 26, marginRight: 10 },
  planHeaderText: { flex: 1 },
  planTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  planLocation: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  slotBadge: { backgroundColor: LIGHT_BLUE, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  slotBadgeFull: { backgroundColor: '#FEE2E2' },
  slotText: { fontSize: 13, fontWeight: '700', color: PRIMARY_BLUE },
  slotTextFull: { color: '#DC2626' },
  planTime: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  reasonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  reasonChip: { backgroundColor: LIGHT_BLUE, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  reasonText: { fontSize: 12, color: PRIMARY_BLUE, fontWeight: '600' },
  planDescription: { fontSize: 13, color: '#4B5563', lineHeight: 18, marginBottom: 10 },
  joinButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 12, padding: 12, alignItems: 'center' },
  joinButtonDisabled: { backgroundColor: '#E5E7EB' },
  joinButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  stickyBottom: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  createOwnButton: { borderWidth: 1.5, borderColor: PRIMARY_BLUE, borderRadius: 14, padding: 14, alignItems: 'center' },
  createOwnText: { color: PRIMARY_BLUE, fontSize: 15, fontWeight: '700' },
  summaryCard: { backgroundColor: LIGHT_BLUE, borderRadius: 12, padding: 14, marginBottom: 8 },
  summaryText: { fontSize: 15, fontWeight: '600', color: PRIMARY_BLUE },
  placeSuggestBox: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 4, marginBottom: 8, overflow: 'hidden' },
  placeSuggestItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  placeSuggestName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  placeSuggestAddr: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  buddyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  buddyButton: { width: 40, height: 40, backgroundColor: '#F5F7FB', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  buddyButtonText: { fontSize: 20, color: PRIMARY_BLUE, fontWeight: '700' },
  buddyCount: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginHorizontal: 20 },
  submitButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});