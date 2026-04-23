import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../context/LanguageContext';

type ProfileCompletionBannerProps = {
  onPress: () => void;
};

export function ProfileCompletionBanner({ onPress }: ProfileCompletionBannerProps) {
  const { t } = useLanguage();

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <TouchableOpacity style={styles.banner} activeOpacity={0.92} onPress={onPress}>
        <Text style={styles.text}>{t('personalInfo.reminder')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  banner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    textAlign: 'center',
  },
});
