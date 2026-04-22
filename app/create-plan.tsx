import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
  { key: 'cafe', emoji: '\u2615' },
  { key: 'gym', emoji: '\u{1F3CB}\uFE0F' },
  { key: 'movies', emoji: '\u{1F3AC}' },
  { key: 'park', emoji: '\u{1F333}' },
  { key: 'food', emoji: '\u{1F37D}\uFE0F' },
  { key: 'study', emoji: '\u{1F4DA}' },
];

const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00',
];

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: '\u2615', gym: '\u{1F3CB}\uFE0F', movies: '\u{1F3AC}',
  park: '\u{1F333}', food: '\u{1F37D}\uFE0F', study: '\u{1F4DA}',
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
    const myHour = parseInt(timeSlot.split(':')[0], 10);
    if (Math.abs(planHour - myHour) === 0) reasons.push('timeExact');
    else if (Math.abs(planHour - myHour) <= 1) reasons.push('timeNear');
  }

  return { match: true, reasons };
}

function parsePlanDate(day: string, month: string, year: string) {
  if (!day || !month || !year) return null;
  if (!/^\d{2}$/.test(day) || !/^\d{2}$/.test(month) || !/^\d{4}$/.test(year)) return null;

  const parsed = new Date(`${year}-${month}-${day}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getDate() !== Number(day) ||
    parsed.getMonth() + 1 !== Number(month) ||
    parsed.getFullYear() !== Number(year)
  ) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed < today) return null;

  return parsed;
}

export default function CreatePlanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [category, setCategory] = useState('');
  const [errors, setErrors] = useState<{ category?: string; date?: string }>({});
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const [suggestions, setSuggestions] = useState<Plan[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [locationText, setLocationText] = useState('');
  const [description, setDescription] = useState('');
  const [maxBuddies, setMaxBuddies] = useState(1);
  const [creating, setCreating] = useState(false);

  const [placeSearch, setPlaceSearch] = useState('');
  const [placeSuggestions, setPlaceSuggestions] = useState<any[]>([]);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const placeSearchTimer = useRef<any>(null);
  const dayRef = useRef<TextInput>(null);
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const date = useMemo(() => {
    if (!day || !month || !year) return '';
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }, [day, month, year]);

  const categoryEmoji = CATEGORY_EMOJI[category] ?? '\u{1F4CD}';
  const summaryTime = timeSlot || t('createPlan.anyTime');

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

  useEffect(() => {
    return () => {
      if (placeSearchTimer.current) clearTimeout(placeSearchTimer.current);
    };
  }, []);

  const handleFindSuggestions = async () => {
    const newErrors: { category?: string; date?: string } = {};
    if (!category) newErrors.category = t('createPlan.errorCategory');
    if (!date) newErrors.date = t('createPlan.errorDate');
    else if (!parsePlanDate(day, month, year)) newErrors.date = t('createPlan.errorInvalidDate');
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
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
        .map((plan) => {
          const { match, reasons } = calcMatch(plan, category, timeSlot, date);
          if (!match) return null;
          const joinedCount = (plan.plan_requests ?? []).filter((request: any) => request.status === 'accepted').length;
          return { ...plan, matchReasons: reasons, joined_count: joinedCount };
        })
        .filter(Boolean) as Plan[];
      setSuggestions(matched);
    }

    setLoadingSuggest(false);
  };

  const handleRequestJoin = async (plan: Plan) => {
    const remaining = plan.max_buddies - (plan.joined_count ?? 0);
    if (remaining <= 0) {
      Alert.alert(t('createPlan.full'), t('createPlan.fullAlert'));
      return;
    }

    setRequesting(plan.id);
    const { error } = await supabase.from('plan_requests').insert({
      plan_id: plan.id,
      requester_id: user?.id,
      message: `[join] ${t('createPlan.join')}`,
    });

    if (error) {
      Alert.alert(
        error.code === '23505' ? t('createPlan.requestSent') : t('writeReview.errorTitle'),
        error.code === '23505' ? t('createPlan.alreadyRequested') : t('createPlan.errorRequest'),
      );
    } else {
      Alert.alert(t('createPlan.requestSent'), t('createPlan.waitForHost'), [
        { text: t('common.ok'), onPress: () => router.replace('/(tabs)/' as any) },
      ]);
    }

    setRequesting(null);
  };

  const handlePlaceSearch = useCallback(async (text: string) => {
    setPlaceSearch(text);
    setTitle(text);

    if (placeSearchTimer.current) clearTimeout(placeSearchTimer.current);
    if (text.length < 2) {
      setPlaceSuggestions([]);
      return;
    }

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
    if (!title.trim()) {
      Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorTitle'));
      return;
    }
    if (!locationText.trim()) {
      Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorArea'));
      return;
    }

    setCreating(true);
    const parsedDate = parsePlanDate(day, month, year);
    if (!parsedDate) {
      setCreating(false);
      Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorInvalidDate'));
      return;
    }

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
        { text: t('common.ok'), onPress: () => router.replace('/(tabs)/' as any) },
      ]);
    }

    setCreating(false);
    setShowCreateModal(false);
  };

  const openCreateModal = () => {
    const newErrors: { category?: string; date?: string } = {};
    if (!category) newErrors.category = t('createPlan.errorCategory');
    if (!date) newErrors.date = t('createPlan.errorDate');
    else if (!parsePlanDate(day, month, year)) newErrors.date = t('createPlan.errorInvalidDate');
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setShowCreateModal(true);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} â€” ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>â†</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('createPlan.title')}</Text>
        </View>

        {collapsed ? (
          <View style={styles.compactRow}>
            <View style={styles.compactLeft}>
              <View style={styles.compactBadge}>
                <Text style={styles.compactEmoji}>{categoryEmoji}</Text>
              </View>
              <View style={styles.compactTextCol}>
                <Text style={styles.compactLine} numberOfLines={1}>
                  {date} | {summaryTime}
                </Text>
                <Text style={styles.compactSubLine}>{t(`categories.${category}`)}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editButton} onPress={() => setCollapsed(false)}>
              <Text style={styles.editButtonText}>âœï¸ Edit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{t('createPlan.whatToDo')}</Text>
            <View style={[styles.categoriesGrid, !!errors.category && styles.fieldError]}>
              {CATEGORIES.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.categoryCard, category === item.key && styles.categoryCardActive]}
                  onPress={() => {
                    setCategory(item.key);
                    setErrors((prev) => ({ ...prev, category: undefined }));
                  }}
                >
                  <Text style={styles.categoryEmoji}>{item.emoji}</Text>
                  <Text style={[styles.categoryLabel, category === item.key && styles.categoryLabelActive]}>
                    {t(`categories.${item.key}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {!!errors.category && <Text style={styles.errorText}>Warning: {errors.category}</Text>}

            <Text style={styles.sectionTitle}>{t('createPlan.when')}</Text>
            <Text style={styles.label}>{t('createPlan.date')}</Text>
            <View style={styles.dateRow}>
              <TextInput
                ref={dayRef}
                style={[styles.input, styles.dateInput, !!errors.date && styles.inputError]}
                placeholder="DD"
                value={day}
                onChangeText={(text) => {
                  const next = text.replace(/\D/g, '').slice(0, 2);
                  setDay(next);
                  if (next.length === 2) monthRef.current?.focus();
                  setErrors((prev) => ({ ...prev, date: undefined }));
                }}
                keyboardType="numeric"
                maxLength={2}
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.dateSep}>/</Text>
              <TextInput
                ref={monthRef}
                style={[styles.input, styles.dateInput, !!errors.date && styles.inputError]}
                placeholder="MM"
                value={month}
                onChangeText={(text) => {
                  const next = text.replace(/\D/g, '').slice(0, 2);
                  setMonth(next);
                  if (next.length === 2) yearRef.current?.focus();
                  setErrors((prev) => ({ ...prev, date: undefined }));
                }}
                keyboardType="numeric"
                maxLength={2}
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.dateSep}>/</Text>
              <TextInput
                ref={yearRef}
                style={[styles.input, styles.dateInputYear, !!errors.date && styles.inputError]}
                placeholder="YYYY"
                value={year}
                onChangeText={(text) => {
                  setYear(text.replace(/\D/g, '').slice(0, 4));
                  setErrors((prev) => ({ ...prev, date: undefined }));
                }}
                keyboardType="numeric"
                maxLength={4}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            {!!date && <Text style={styles.dateFormatHint}>Date: {date}</Text>}
            {!!errors.date && <Text style={styles.errorText}>Warning: {errors.date}</Text>}

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
              {TIME_SLOTS.map((slot) => (
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

        <TouchableOpacity style={styles.findButton} onPress={handleFindSuggestions}>
          <Text style={styles.findButtonText}>{t('createPlan.findButton')}</Text>
        </TouchableOpacity>

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
              suggestions.map((item) => {
                const remaining = item.max_buddies - (item.joined_count ?? 0);
                const isFull = remaining <= 0;
                return (
                  <View key={item.id} style={styles.planCard}>
                    <View style={styles.planHeader}>
                      <Text style={styles.planEmoji}>{CATEGORY_EMOJI[item.category] ?? '\u{1F4CD}'}</Text>
                      <View style={styles.planHeaderText}>
                        <Text style={styles.planTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.planLocation}>Location: {item.location_text}</Text>
                      </View>
                      <View style={[styles.slotBadge, isFull && styles.slotBadgeFull]}>
                        <Text style={[styles.slotText, isFull && styles.slotTextFull]}>
                          {isFull ? t('createPlan.full') : `${item.joined_count ?? 0}/${item.max_buddies} buddy`}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.planTime}>Time: {formatTime(item.scheduled_at)}</Text>
                    <View style={styles.reasonsRow}>
                      {item.matchReasons.map((reason, index) => (
                        <View key={`${item.id}-${reason}-${index}`} style={styles.reasonChip}>
                          <Text style={styles.reasonText}>{reasonLabel(reason)}</Text>
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
                            : t('createPlan.join')}
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

      {!loadingSuggest && (
        <View style={styles.stickyBottom}>
          <TouchableOpacity style={styles.createOwnButton} onPress={openCreateModal}>
            <Text style={styles.createOwnText}>{t('createPlan.createOwn')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.backButton}>
                  <Text style={styles.backText}>âœ•</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{t('createPlan.modalTitle')}</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryText}>
                  {CATEGORY_EMOJI[category]} {t(`categories.${category}`)}
                  {timeSlot ? ` | ${timeSlot}` : ` | ${t('createPlan.anyTime')}`}
                  {date ? ` | ${date}` : ''}
                </Text>
              </View>

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

              {placeSuggestions.length > 0 && (
                <View style={styles.placeSuggestBox}>
                  {placeSuggestions.map((place) => (
                    <TouchableOpacity
                      key={place.id}
                      style={styles.placeSuggestItem}
                      onPress={() => handleSelectPlace(place)}
                    >
                      <Text style={styles.placeSuggestName} numberOfLines={1}>
                        {CATEGORY_EMOJI[place.category] ?? '\u{1F4CD}'} {place.name}
                      </Text>
                      <Text style={styles.placeSuggestAddr} numberOfLines={1}>
                        {place.address}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>{t('createPlan.area')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('createPlan.areaPlaceholder')}
                value={locationText}
                onChangeText={setLocationText}
                placeholderTextColor="#9CA3AF"
              />

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

              <Text style={styles.label}>{t('createPlan.maxBuddies')}</Text>
              <View style={styles.buddyRow}>
                <TouchableOpacity
                  style={styles.buddyButton}
                  onPress={() => setMaxBuddies(Math.max(1, maxBuddies - 1))}
                >
                  <Text style={styles.buddyButtonText}>-</Text>
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
                  {creating ? t('createPlan.publishing') : t('createPlan.publish')}
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
  inputError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  fieldError: { borderRadius: 14, borderWidth: 1.5, borderColor: '#DC2626' },
  errorText: { color: '#DC2626', fontSize: 12, fontWeight: '500', marginTop: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateSep: { marginHorizontal: 8, color: '#9CA3AF', fontWeight: '700', fontSize: 16 },
  dateInput: { width: 72, textAlign: 'center' },
  dateInputYear: { width: 110, textAlign: 'center' },
  dateFormatHint: { fontSize: 13, color: '#1E88E5', fontWeight: '600', marginTop: 6 },
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
