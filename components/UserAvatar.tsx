import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getProfileInitials, UserProfile } from '../lib/user-profile';

type UserAvatarProps = {
  profile?: Partial<UserProfile> | null;
  fallbackText?: string | null;
  size?: number;
  textSize?: number;
};

export function UserAvatar({ profile, fallbackText, size = 40, textSize }: UserAvatarProps) {
  const avatarUrl = profile?.avatar_url?.trim();

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        contentFit="cover"
      />
    );
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.text, { fontSize: textSize ?? Math.max(14, size * 0.36) }]}>
        {getProfileInitials(profile, fallbackText)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#E3F2FD',
  },
  fallback: {
    backgroundColor: '#1E88E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
