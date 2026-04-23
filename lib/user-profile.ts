export type ProfileGender = 'male' | 'female' | 'other';

export type ProfileVisibilitySettings = {
  fullName: boolean;
  nickname: boolean;
  gender: boolean;
  birthYear: boolean;
  interests: boolean;
};

export type UserProfile = {
  user_id: string;
  full_name: string | null;
  nickname: string | null;
  gender: ProfileGender | null;
  birth_year: number | null;
  interests: string | null;
  avatar_url: string | null;
  visibility_settings: ProfileVisibilitySettings;
  is_profile_completed: boolean;
  has_skipped_profile_setup: boolean;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_VISIBILITY_SETTINGS: ProfileVisibilitySettings = {
  fullName: false,
  nickname: true,
  gender: false,
  birthYear: false,
  interests: true,
};

export function normalizeVisibilitySettings(value: unknown): ProfileVisibilitySettings {
  const input = typeof value === 'object' && value ? (value as Partial<ProfileVisibilitySettings>) : {};
  return {
    fullName: Boolean(input.fullName ?? DEFAULT_VISIBILITY_SETTINGS.fullName),
    nickname: Boolean(input.nickname ?? DEFAULT_VISIBILITY_SETTINGS.nickname),
    gender: Boolean(input.gender ?? DEFAULT_VISIBILITY_SETTINGS.gender),
    birthYear: Boolean(input.birthYear ?? DEFAULT_VISIBILITY_SETTINGS.birthYear),
    interests: Boolean(input.interests ?? DEFAULT_VISIBILITY_SETTINGS.interests),
  };
}

export function isUserProfileComplete(input: Partial<UserProfile> | null | undefined) {
  if (!input) return false;

  return Boolean(
    input.full_name?.trim() &&
      input.nickname?.trim() &&
      input.gender &&
      input.birth_year &&
      input.interests?.trim(),
  );
}

export function normalizeUserProfile(input: any): UserProfile | null {
  if (!input?.user_id) return null;

  return {
    user_id: String(input.user_id),
    full_name: input.full_name ?? null,
    nickname: input.nickname ?? null,
    gender: input.gender ?? null,
    birth_year:
      typeof input.birth_year === 'number'
        ? input.birth_year
        : input.birth_year
          ? Number(input.birth_year)
          : null,
    interests: input.interests ?? null,
    avatar_url: input.avatar_url ?? null,
    visibility_settings: normalizeVisibilitySettings(input.visibility_settings),
    is_profile_completed:
      typeof input.is_profile_completed === 'boolean'
        ? input.is_profile_completed
        : isUserProfileComplete(input),
    has_skipped_profile_setup: Boolean(input.has_skipped_profile_setup),
    created_at: input.created_at ?? undefined,
    updated_at: input.updated_at ?? undefined,
  };
}

export function getProfileDisplayName(profile: UserProfile | null | undefined, fallback?: string | null) {
  const nickname = profile?.nickname?.trim();
  const fullName = profile?.full_name?.trim();

  return nickname || fullName || fallback || 'Local Buddy';
}

export function getProfileInitials(profile: Partial<UserProfile> | null | undefined, fallback?: string | null) {
  const source = profile?.nickname?.trim() || profile?.full_name?.trim() || fallback || 'LB';
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}
