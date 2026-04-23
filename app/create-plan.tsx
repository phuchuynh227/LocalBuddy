import { Entypo } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
import { UserAvatar } from '../components/UserAvatar';
import { useLanguage } from '../context/LanguageContext';
import { getProfileDisplayName, normalizeUserProfile, UserProfile } from '../lib/user-profile';
import { supabase } from '../lib/supabase';

const CATEGORIES = [
  { key: 'cafe', icon: 'cup' },
  { key: 'gym', icon: 'sports-club' },
  { key: 'movies', icon: 'clapperboard' },
  { key: 'park', icon: 'tree' },
  { key: 'food', icon: 'bowl' },
  { key: 'study', icon: 'open-book' },
];

const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00',
];

const CATEGORY_ICON: Record<string, string> = {
  cafe: 'cup',
  gym: 'sports-club',
  movies: 'clapperboard',
  park: 'tree',
  food: 'bowl',
  study: 'open-book',
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
  host_profile?: UserProfile | null;
};

function toIsoDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
    .toISOString()
    .split('T')[0];
}

function formatDateLabel(iso: string, language: 'en' | 'vn') {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString(language === 'vn' ? 'vi-VN' : 'en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function calcMatch(plan: any, category: string, timeSlot: string, selectedDateIso: string): { match: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (plan.category !== category) return { match: false, reasons: [] };
  reasons.push('activity');

  if (selectedDateIso) {
    const planDate = new Date(plan.scheduled_at).toISOString().split('T')[0];
    if (planDate !== selectedDateIso) return { match: false, reasons: [] };
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

export default function CreatePlanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { language, t } = useLanguage();

  const [category, setCategory] = useState('');
  const [errors, setErrors] = useState<{ category?: string; date?: string }>({});
  const [selectedDateIso, setSelectedDateIso] = useState('');
  const [showNativeDatePicker, setShowNativeDatePicker] = useState(false);
  const [timeSlot, setTimeSlot] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const [suggestions, setSuggestions] = useState<Plan[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [pendingRequestPlanIds, setPendingRequestPlanIds] = useState<string[]>([]);
  const [selectedHostProfile, setSelectedHostProfile] = useState<UserProfile | null>(null);
  const [zoomedAvatarUrl, setZoomedAvatarUrl] = useState<string | null>(null);

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
  const webDateInputRef = useRef<any>(null);

  const minDateIso = useMemo(() => toIsoDate(new Date()), []);
  const selectedDateLabel = useMemo(
    () => formatDateLabel(selectedDateIso, language),
    [language, selectedDateIso],
  );
  const categoryIcon = CATEGORY_ICON[category] ?? 'location-pin';
  const summaryTime = timeSlot || t('createPlan.anyTime');
  const editLabel = language === 'vn' ? 'Sua' : 'Edit';

  const NativeDateTimePicker = useMemo(() => {
    if (Platform.OS === 'web') return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('@react-native-community/datetimepicker').default;
    } catch {
      return null;
    }
  }, []);

  const selectedNativeDate = useMemo(
    () => new Date(`${(selectedDateIso || minDateIso)}T12:00:00`),
    [minDateIso, selectedDateIso],
  );

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

  useEffect(() => {
    const fetchMyPendingRequests = async () => {
      if (!user?.id) return;

      const { data } = await supabase
        .from('plan_requests')
        .select('plan_id')
        .eq('requester_id', user.id)
        .in('status', ['pending', 'accepted']);

      setPendingRequestPlanIds((data ?? []).map((item: any) => item.plan_id));
    };

    fetchMyPendingRequests();
  }, [user?.id]);

  const setPickedDate = useCallback((iso: string) => {
    setSelectedDateIso(iso);
    setErrors((prev) => ({ ...prev, date: undefined }));
  }, []);

  const handleOpenDatePicker = () => {
    if (Platform.OS === 'web') {
      if (typeof webDateInputRef.current?.showPicker === 'function') {
        webDateInputRef.current.showPicker();
        return;
      }
      if (typeof webDateInputRef.current?.click === 'function') {
        webDateInputRef.current.click();
      }
      return;
    }
    if (!NativeDateTimePicker) {
      Alert.alert(
        'Date picker missing',
        'Install @react-native-community/datetimepicker to use the native date picker on Android and iOS.',
      );
      return;
    }
    setShowNativeDatePicker(true);
  };

  const handleFindSuggestions = async () => {
    const newErrors: { category?: string; date?: string } = {};
    if (!category) newErrors.category = t('createPlan.errorCategory');
    if (!selectedDateIso) newErrors.date = t('createPlan.errorDate');
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
          const { match, reasons } = calcMatch(plan, category, timeSlot, selectedDateIso);
          if (!match) return null;
          const joinedCount = (plan.plan_requests ?? []).filter((request: any) => request.status === 'accepted').length;
          return { ...plan, matchReasons: reasons, joined_count: joinedCount };
        })
        .filter(Boolean) as Plan[];

      const hostIds = Array.from(new Set(matched.map((plan) => plan.host_id).filter(Boolean)));
      let hostProfileMap = new Map<string, UserProfile>();

      if (hostIds.length > 0) {
        const { data: hostProfiles } = await supabase
          .from('user_profiles')
          .select('*')
          .in('user_id', hostIds);

        hostProfileMap = new Map(
          (hostProfiles ?? [])
            .map((row: any) => normalizeUserProfile(row))
            .filter((row): row is UserProfile => Boolean(row))
            .map((row) => [row.user_id, row]),
        );
      }

      setSuggestions(
        matched.map((plan) => ({
          ...plan,
          host_profile: hostProfileMap.get(plan.host_id) ?? null,
        })),
      );
    }

    setLoadingSuggest(false);
  };

  const handleRequestJoin = async (plan: Plan) => {
    const remaining = plan.max_buddies - (plan.joined_count ?? 0);
    if (remaining <= 0) {
      Alert.alert(t('createPlan.full'), t('createPlan.fullAlert'));
      return;
    }
    if (pendingRequestPlanIds.includes(plan.id)) {
      Alert.alert(t('createPlan.requestPendingTitle'), t('createPlan.requestPending'));
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
      if (error.code === '23505') {
        setPendingRequestPlanIds((current) => (current.includes(plan.id) ? current : [...current, plan.id]));
      }
    } else {
      setPendingRequestPlanIds((current) => (current.includes(plan.id) ? current : [...current, plan.id]));
      setSuggestions((current) =>
        current.map((item) => (item.id === plan.id ? { ...item } : item)),
      );
      Alert.alert(t('createPlan.requestSent'), t('createPlan.waitForHost'));
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
    if (!selectedDateIso) {
      Alert.alert(t('writeReview.errorTitle'), t('createPlan.errorDate'));
      return;
    }

    setCreating(true);
    const timeStr = timeSlot || '09:00';
    const scheduledAt = new Date(`${selectedDateIso}T${timeStr}:00`);

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
    if (!selectedDateIso) newErrors.date = t('createPlan.errorDate');
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setShowCreateModal(true);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const renderVisibleFields = (profile: UserProfile | null) => {
    const visibility = profile?.visibility_settings;
    const rows: string[] = [];

    if (visibility?.fullName && profile?.full_name) rows.push(`${t('personalInfo.fullName')}: ${profile.full_name}`);
    if (visibility?.nickname && profile?.nickname) rows.push(`${t('personalInfo.nickname')}: ${profile.nickname}`);
    if (visibility?.gender && profile?.gender) rows.push(`${t('personalInfo.gender')}: ${t(`personalInfo.genderOptions.${profile.gender}`)}`);
    if (visibility?.birthYear && profile?.birth_year) rows.push(`${t('personalInfo.birthYear')}: ${profile.birth_year}`);
    if (visibility?.interests && profile?.interests) rows.push(`${t('personalInfo.interests')}: ${profile.interests}`);

    if (rows.length === 0) {
      return <Text style={styles.previewEmpty}>{t('myPlans.profilePreviewEmpty')}</Text>;
    }

    return rows.map((row) => (
      <Text key={row} style={styles.previewField}>
        {row}
      </Text>
    ));
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
            <Entypo name="chevron-thin-left" size={18} color={PRIMARY_BLUE} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('createPlan.title')}</Text>
        </View>

        {collapsed ? (
          <View style={styles.compactRow}>
            <View style={styles.compactLeft}>
              <View style={styles.compactBadge}>
                <Entypo name={categoryIcon as any} size={20} color={PRIMARY_BLUE} />
              </View>
              <View style={styles.compactTextCol}>
                <Text style={styles.compactLine} numberOfLines={1}>
                  {selectedDateLabel} | {summaryTime}
                </Text>
                <Text style={styles.compactSubLine}>{t(`categories.${category}`)}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editButton} onPress={() => setCollapsed(false)}>
              <Entypo name="edit" size={14} color={PRIMARY_BLUE} />
              <Text style={styles.editButtonText}>{editLabel}</Text>
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
                  <Entypo name={item.icon as any} size={22} color={category === item.key ? PRIMARY_BLUE : '#6B7280'} />
                  <Text style={[styles.categoryLabel, category === item.key && styles.categoryLabelActive]}>
                    {t(`categories.${item.key}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {!!errors.category && <Text style={styles.errorText}>{errors.category}</Text>}

            <Text style={styles.sectionTitle}>{t('createPlan.when')}</Text>
            <Text style={styles.label}>{t('createPlan.date')}</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.datePickerField, !!errors.date && styles.inputError]}
              onPress={handleOpenDatePicker}
            >
              <View style={styles.datePickerLeft}>
                <Entypo name="calendar" size={18} color={PRIMARY_BLUE} />
                <Text style={[styles.datePickerText, !selectedDateIso && styles.datePickerPlaceholder]}>
                  {selectedDateIso ? selectedDateLabel : t('createPlan.selectDate')}
                </Text>
              </View>

              {Platform.OS === 'web' ? (
                <View style={styles.webDateInputWrap}>
                  {React.createElement('input', {
                    ref: webDateInputRef,
                    type: 'date',
                    value: selectedDateIso,
                    min: minDateIso,
                    onChange: (event: any) => setPickedDate(event.target.value),
                    style: styles.webDateNativeInput,
                    'aria-label': t('createPlan.date'),
                    tabIndex: -1,
                  })}
                </View>
              ) : (
                <View style={styles.datePickerTap}>
                  <Text style={styles.datePickerAction}>{t('common.ok') === 'OK' ? 'Pick' : 'Chon'}</Text>
                </View>
              )}
            </TouchableOpacity>
            {!!errors.date && <Text style={styles.errorText}>{errors.date}</Text>}

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
          <Entypo name="magnifying-glass" size={18} color="#FFFFFF" />
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
                const hasPendingRequest = pendingRequestPlanIds.includes(item.id);
                return (
                  <View key={item.id} style={styles.planCard}>
                    <View style={styles.planHeader}>
                      <Entypo name={(CATEGORY_ICON[item.category] ?? 'location-pin') as any} size={22} color={PRIMARY_BLUE} style={styles.planIcon} />
                      <View style={styles.planHeaderText}>
                        <Text style={styles.planTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.planLocation}>{item.location_text}</Text>
                      </View>
                      <View style={[styles.slotBadge, isFull && styles.slotBadgeFull]}>
                        <Text style={[styles.slotText, isFull && styles.slotTextFull]}>
                          {isFull ? t('createPlan.full') : `${item.joined_count ?? 0}/${item.max_buddies} buddy`}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.hostRow}
                      activeOpacity={0.9}
                      onPress={() => setSelectedHostProfile(item.host_profile ?? null)}
                    >
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => item.host_profile?.avatar_url && setZoomedAvatarUrl(item.host_profile.avatar_url)}
                      >
                        <UserAvatar profile={item.host_profile} fallbackText={item.host_id} size={38} textSize={16} />
                      </TouchableOpacity>
                      <View style={styles.hostInfo}>
                        <Text style={styles.hostLabel}>{t('createPlan.hostInfo')}</Text>
                        <Text style={styles.hostName} numberOfLines={1}>
                          {getProfileDisplayName(item.host_profile, `${t('createPlan.hostFallback')} #${item.host_id.slice(0, 8)}`)}
                        </Text>
                      </View>
                      <Text style={styles.hostChevron}>{'>'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.planTime}>{formatTime(item.scheduled_at)}</Text>
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
                      style={[styles.joinButton, (isFull || hasPendingRequest) && styles.joinButtonDisabled]}
                      onPress={() => !isFull && !hasPendingRequest && handleRequestJoin(item)}
                      disabled={requesting === item.id || isFull || hasPendingRequest}
                    >
                      <Text style={styles.joinButtonText}>
                        {requesting === item.id
                          ? t('createPlan.joining')
                          : hasPendingRequest
                            ? t('createPlan.requestPending')
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
                  <Entypo name="cross" size={18} color={PRIMARY_BLUE} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('createPlan.modalTitle')}</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryText}>
                  {category ? `${t(`categories.${category}`)}` : ''}
                  {timeSlot ? ` | ${timeSlot}` : ` | ${t('createPlan.anyTime')}`}
                  {selectedDateLabel ? ` | ${selectedDateLabel}` : ''}
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
                        {place.name}
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

      {Platform.OS !== 'web' && showNativeDatePicker && NativeDateTimePicker ? (
        <NativeDateTimePicker
          value={selectedNativeDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date(`${minDateIso}T00:00:00`)}
          onChange={(event: any, value?: Date) => {
            if (Platform.OS === 'android') setShowNativeDatePicker(false);
            if (event?.type === 'dismissed') return;
            if (value) setPickedDate(toIsoDate(value));
          }}
        />
      ) : null}

      {selectedHostProfile && (
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelectedHostProfile(null)} />
          <View style={styles.previewCard}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => selectedHostProfile.avatar_url && setZoomedAvatarUrl(selectedHostProfile.avatar_url)}
              style={styles.previewAvatarWrap}
            >
              <UserAvatar profile={selectedHostProfile} fallbackText={selectedHostProfile.user_id} size={72} textSize={26} />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>
              {getProfileDisplayName(selectedHostProfile, t('createPlan.hostInfo'))}
            </Text>
            <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
              {renderVisibleFields(selectedHostProfile)}
            </ScrollView>
            <TouchableOpacity style={styles.previewCloseButton} onPress={() => setSelectedHostProfile(null)}>
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
const LIGHT_BLUE = '#E3F2FD';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 20, paddingBottom: 20 },
  modalContent: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backButton: {
    width: 36,
    height: 36,
    backgroundColor: '#F5F7FB',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 14 },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 24 },
  categoryCard: {
    width: '48%',
    backgroundColor: '#F5F7FB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
  },
  categoryCardActive: { borderColor: PRIMARY_BLUE, backgroundColor: LIGHT_BLUE },
  categoryLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  categoryLabelActive: { color: PRIMARY_BLUE },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 14 },
  optional: { fontSize: 12, color: '#9CA3AF', fontWeight: '400' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#F9FAFB',
  },
  inputError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  fieldError: { borderRadius: 14, borderWidth: 1.5, borderColor: '#DC2626' },
  errorText: { color: '#DC2626', fontSize: 12, fontWeight: '500', marginTop: 6 },
  datePickerField: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  datePickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  datePickerText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  datePickerPlaceholder: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
  datePickerTap: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  datePickerAction: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY_BLUE,
  },
  webDateInputWrap: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
  },
  webDateNativeInput: {
    width: '100%',
    height: '100%',
    cursor: 'pointer',
  },
  inputMultiline: { minHeight: 80 },
  timeSlotList: { marginBottom: 4 },
  timeSlot: {
    backgroundColor: '#F5F7FB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  timeSlotActive: { backgroundColor: LIGHT_BLUE, borderColor: PRIMARY_BLUE },
  timeSlotText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  timeSlotTextActive: { color: PRIMARY_BLUE },
  findButton: {
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  findButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: LIGHT_BLUE,
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
  },
  compactLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  compactBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  compactTextCol: { flex: 1 },
  compactLine: { fontSize: 14, fontWeight: '700', color: PRIMARY_BLUE },
  compactSubLine: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  editButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButtonText: { fontSize: 13, fontWeight: '700', color: PRIMARY_BLUE },
  suggestSection: { marginTop: 28 },
  suggestTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 14 },
  planCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  planIcon: { marginRight: 10 },
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
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginBottom: 10,
  },
  hostInfo: { flex: 1, marginLeft: 10, marginRight: 10 },
  hostLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 },
  hostName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginTop: 2 },
  hostChevron: { fontSize: 16, fontWeight: '700', color: '#9CA3AF' },
  joinButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 12, padding: 12, alignItems: 'center' },
  joinButtonDisabled: { backgroundColor: '#E5E7EB' },
  joinButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  stickyBottom: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  createOwnButton: { borderWidth: 1.5, borderColor: PRIMARY_BLUE, borderRadius: 14, padding: 14, alignItems: 'center' },
  createOwnText: { color: PRIMARY_BLUE, fontSize: 15, fontWeight: '700' },
  summaryCard: { backgroundColor: LIGHT_BLUE, borderRadius: 12, padding: 14, marginBottom: 8 },
  summaryText: { fontSize: 15, fontWeight: '600', color: PRIMARY_BLUE },
  placeSuggestBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  placeSuggestItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  placeSuggestName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  placeSuggestAddr: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  buddyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  buddyButton: {
    width: 40,
    height: 40,
    backgroundColor: '#F5F7FB',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  buddyButtonText: { fontSize: 20, color: PRIMARY_BLUE, fontWeight: '700' },
  buddyCount: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginHorizontal: 20 },
  submitButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
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
    maxHeight: '72%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
  },
  previewAvatarWrap: { alignSelf: 'center' },
  previewTitle: {
    marginTop: 12,
    marginBottom: 14,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  previewScroll: { maxHeight: 220 },
  previewField: { fontSize: 14, color: '#374151', marginBottom: 10, lineHeight: 20 },
  previewEmpty: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  previewCloseButton: {
    marginTop: 18,
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  previewCloseText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  zoomCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    overflow: 'hidden',
  },
  zoomImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
});
