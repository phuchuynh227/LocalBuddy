import { Entypo } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  DEFAULT_VISIBILITY_SETTINGS,
  isUserProfileComplete,
  normalizeVisibilitySettings,
  ProfileGender,
} from '../lib/user-profile';
import { supabase } from '../lib/supabase';

const PRIMARY_BLUE = '#1E88E5';
const LIGHT_BLUE = '#E3F2FD';
const GENDER_OPTIONS: ProfileGender[] = ['male', 'female', 'other'];

function getFriendlyProfileErrorMessage(error: any, fallbackMessage: string, backendSetupMessage: string) {
  const rawMessage = String(error?.message ?? '').toLowerCase();

  if (
    rawMessage.includes('user_profiles') ||
    rawMessage.includes('relation') ||
    rawMessage.includes('bucket not found') ||
    rawMessage.includes('avatars') ||
    rawMessage.includes('row-level security') ||
    rawMessage.includes('permission denied')
  ) {
    return backendSetupMessage;
  }

  return error?.message ?? fallbackMessage;
}

async function uploadAvatarAsync(userId: string, uri: string, mimeType?: string | null) {
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const contentType = mimeType ?? response.headers.get('content-type') ?? 'image/jpeg';
  const extension = contentType.split('/')[1] || uri.split('.').pop() || 'jpg';
  const path = `${userId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from('avatars').upload(path, arrayBuffer, {
    cacheControl: '3600',
    contentType,
    upsert: true,
  });

  if (error) throw error;

  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile, requiresProfileSetup } = useAuth();
  const { t } = useLanguage();

  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<ProfileGender | null>(null);
  const [birthYear, setBirthYear] = useState('');
  const [interests, setInterests] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const scrollRef = useRef<ScrollView | null>(null);
  const fieldPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setNickname(profile?.nickname ?? '');
    setGender(profile?.gender ?? null);
    setBirthYear(profile?.birth_year ? String(profile.birth_year) : '');
    setInterests(profile?.interests ?? '');
    setAvatarUrl(profile?.avatar_url ?? null);
    setVisibility(normalizeVisibilitySettings(profile?.visibility_settings));
  }, [profile]);

  const isEditingCompletedProfile = Boolean(profile?.is_profile_completed);

  const canSkip = useMemo(
    () => requiresProfileSetup || !isEditingCompletedProfile,
    [isEditingCompletedProfile, requiresProfileSetup],
  );

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      globalThis.alert?.(`${title}\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const registerFieldPosition = (field: string, y: number) => {
    fieldPositions.current[field] = y;
  };

  const scrollToField = (field: string) => {
    const y = fieldPositions.current[field];
    if (typeof y === 'number') {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
    }
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handlePickAvatar = async () => {
    if (!user?.id) return;

    try {
      setPickingImage(true);

      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          showMessage(t('writeReview.errorTitle'), t('personalInfo.permissionDenied'));
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const publicUrl = await uploadAvatarAsync(user.id, asset.uri, asset.mimeType);
      setAvatarUrl(publicUrl);
    } catch (error: any) {
      showMessage(
        t('writeReview.errorTitle'),
        getFriendlyProfileErrorMessage(
          error,
          t('personalInfo.avatarUploadFailed'),
          t('personalInfo.backendSetupRequired'),
        ),
      );
    } finally {
      setPickingImage(false);
    }
  };

  const clearOnboardingFlag = async () => {
    const currentMetadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const { error } = await supabase.auth.updateUser({
      data: {
        ...currentMetadata,
        requires_profile_setup: false,
      },
    });

    if (error) throw error;
  };

  const handleSkip = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const payload = {
        user_id: user.id,
        avatar_url: avatarUrl,
        visibility_settings: visibility,
        has_skipped_profile_setup: true,
        is_profile_completed: false,
      };

      const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;

      await clearOnboardingFlag();
      await refreshProfile();
      router.replace('/(tabs)/' as any);
    } catch (error: any) {
      showMessage(
        t('writeReview.errorTitle'),
        getFriendlyProfileErrorMessage(
          error,
          t('personalInfo.saveFailed'),
          t('personalInfo.backendSetupRequired'),
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    const parsedBirthYear = Number(birthYear);
    const nextProfile = {
      full_name: fullName.trim() || null,
      nickname: nickname.trim() || null,
      gender,
      birth_year: Number.isFinite(parsedBirthYear) ? parsedBirthYear : null,
      interests: interests.trim() || null,
      avatar_url: avatarUrl,
    };

    const nextErrors: Record<string, string | undefined> = {};

    if (!nextProfile.full_name) nextErrors.fullName = t('personalInfo.requiredField');
    if (!nextProfile.nickname) nextErrors.nickname = t('personalInfo.requiredField');
    if (!nextProfile.gender) nextErrors.gender = t('personalInfo.requiredField');
    if (!nextProfile.birth_year) nextErrors.birthYear = t('personalInfo.requiredField');
    if (!nextProfile.interests) nextErrors.interests = t('personalInfo.requiredField');

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      scrollToField(Object.keys(nextErrors)[0]);
      showMessage(t('writeReview.errorTitle'), t('personalInfo.fillRequired'));
      return;
    }

    const currentYear = new Date().getFullYear();
    const birthYearValue = nextProfile.birth_year as number;
    if (birthYearValue < 1900 || birthYearValue > currentYear) {
      setFieldErrors((current) => ({ ...current, birthYear: t('personalInfo.invalidBirthYear') }));
      scrollToField('birthYear');
      showMessage(t('writeReview.errorTitle'), t('personalInfo.invalidBirthYear'));
      return;
    }

    try {
      setLoading(true);
      setFieldErrors({});

      const payload = {
        user_id: user.id,
        ...nextProfile,
        visibility_settings: visibility,
        has_skipped_profile_setup: false,
        is_profile_completed: isUserProfileComplete(nextProfile),
      };

      const { error } = await supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;

      await clearOnboardingFlag();
      await refreshProfile();
      router.replace('/(tabs)/profile' as any);
    } catch (error: any) {
      showMessage(
        t('writeReview.errorTitle'),
        getFriendlyProfileErrorMessage(
          error,
          t('personalInfo.saveFailed'),
          t('personalInfo.backendSetupRequired'),
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.9}>
              <Text style={styles.backText}>{'<'}</Text>
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t('personalInfo.title')}</Text>
              <Text style={styles.subtitle}>
                {requiresProfileSetup ? t('personalInfo.onboardingSubtitle') : t('personalInfo.subtitle')}
              </Text>
            </View>
          </View>

          <View style={styles.avatarCard}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Entypo name="user" size={36} color={PRIMARY_BLUE} />
              </View>
            )}

            <TouchableOpacity style={styles.avatarButton} onPress={handlePickAvatar} disabled={pickingImage}>
              <Text style={styles.avatarButtonText}>
                {pickingImage ? t('personalInfo.uploadingAvatar') : t('personalInfo.pickAvatar')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formSection}>
            <View onLayout={(event) => registerFieldPosition('fullName', event.nativeEvent.layout.y)}>
              <Text style={styles.label}>{t('personalInfo.fullName')}</Text>
              <TextInput
                style={[styles.input, fieldErrors.fullName && styles.inputError]}
                value={fullName}
                onChangeText={(value) => {
                  setFullName(value);
                  if (value.trim()) clearFieldError('fullName');
                }}
                placeholder={t('personalInfo.fullNamePlaceholder')}
              />
              {!!fieldErrors.fullName && <Text style={styles.errorText}>{fieldErrors.fullName}</Text>}
            </View>

            <View onLayout={(event) => registerFieldPosition('nickname', event.nativeEvent.layout.y)}>
              <Text style={styles.label}>{t('personalInfo.nickname')}</Text>
              <TextInput
                style={[styles.input, fieldErrors.nickname && styles.inputError]}
                value={nickname}
                onChangeText={(value) => {
                  setNickname(value);
                  if (value.trim()) clearFieldError('nickname');
                }}
                placeholder={t('personalInfo.nicknamePlaceholder')}
              />
              {!!fieldErrors.nickname && <Text style={styles.errorText}>{fieldErrors.nickname}</Text>}
            </View>

            <View onLayout={(event) => registerFieldPosition('gender', event.nativeEvent.layout.y)}>
              <Text style={styles.label}>{t('personalInfo.gender')}</Text>
              <View style={[styles.genderRow, fieldErrors.gender && styles.genderRowError]}>
                {GENDER_OPTIONS.map((option) => {
                  const active = gender === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.genderChip, active && styles.genderChipActive]}
                      onPress={() => {
                        setGender(option);
                        clearFieldError('gender');
                      }}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.genderChipText, active && styles.genderChipTextActive]}>
                        {t(`personalInfo.genderOptions.${option}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!!fieldErrors.gender && <Text style={styles.errorText}>{fieldErrors.gender}</Text>}
            </View>

            <View onLayout={(event) => registerFieldPosition('birthYear', event.nativeEvent.layout.y)}>
              <Text style={styles.label}>{t('personalInfo.birthYear')}</Text>
              <TextInput
                style={[styles.input, fieldErrors.birthYear && styles.inputError]}
                value={birthYear}
                onChangeText={(value) => {
                  setBirthYear(value);
                  if (value.trim()) clearFieldError('birthYear');
                }}
                placeholder={t('personalInfo.birthYearPlaceholder')}
                keyboardType="number-pad"
                maxLength={4}
              />
              {!!fieldErrors.birthYear && <Text style={styles.errorText}>{fieldErrors.birthYear}</Text>}
            </View>

            <View onLayout={(event) => registerFieldPosition('interests', event.nativeEvent.layout.y)}>
              <Text style={styles.label}>{t('personalInfo.interests')}</Text>
              <TextInput
                style={[styles.input, styles.multilineInput, fieldErrors.interests && styles.inputError]}
                value={interests}
                onChangeText={(value) => {
                  setInterests(value);
                  if (value.trim()) clearFieldError('interests');
                }}
                placeholder={t('personalInfo.interestsPlaceholder')}
                multiline
                textAlignVertical="top"
              />
              {!!fieldErrors.interests && <Text style={styles.errorText}>{fieldErrors.interests}</Text>}
            </View>
          </View>

          <View style={styles.visibilitySection}>
            <Text style={styles.sectionTitle}>{t('personalInfo.visibilityTitle')}</Text>
            <Text style={styles.sectionSubtitle}>{t('personalInfo.visibilitySubtitle')}</Text>

            {([
              ['fullName', 'fullName'],
              ['nickname', 'nickname'],
              ['gender', 'gender'],
              ['birthYear', 'birthYear'],
              ['interests', 'interests'],
            ] as const).map(([key, labelKey]) => (
              <View key={key} style={styles.visibilityRow}>
                <Text style={styles.visibilityLabel}>{t(`personalInfo.${labelKey}`)}</Text>
                <Switch
                  value={visibility[key]}
                  onValueChange={(value) => setVisibility((current) => ({ ...current, [key]: value }))}
                  trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                  thumbColor={visibility[key] ? PRIMARY_BLUE : '#FFFFFF'}
                />
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>{t('personalInfo.save')}</Text>
            )}
          </TouchableOpacity>

          {canSkip && (
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={loading}>
              <Text style={styles.skipButtonText}>{t('personalInfo.skip')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F7FB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backText: { fontSize: 18, fontWeight: '700', color: PRIMARY_BLUE },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 21, color: '#6B7280' },
  avatarCard: {
    alignItems: 'center',
    backgroundColor: LIGHT_BLUE,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  avatarImage: { width: 104, height: 104, borderRadius: 52, backgroundColor: '#FFFFFF' },
  avatarPlaceholder: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarButton: {
    marginTop: 14,
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  avatarButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  formSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
    color: '#111827',
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  multilineInput: { minHeight: 96, paddingTop: 14 },
  genderRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  genderRowError: {
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#FEF2F2',
  },
  genderChip: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  genderChipActive: {
    backgroundColor: PRIMARY_BLUE,
    borderColor: PRIMARY_BLUE,
  },
  genderChipText: { fontSize: 14, fontWeight: '600', color: PRIMARY_BLUE },
  genderChipTextActive: { color: '#FFFFFF' },
  visibilitySection: {
    marginTop: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  visibilityLabel: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  errorText: { color: '#DC2626', fontSize: 12, fontWeight: '500', marginTop: 6 },
  saveButton: {
    marginTop: 24,
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  skipButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipButtonText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
});
