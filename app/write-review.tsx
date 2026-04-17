import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
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

export default function WriteReviewScreen() {
  const { placeId, placeName } = useLocalSearchParams<{ placeId: string; placeName: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert(t('writeReview.errorTitle'), t('writeReview.pickStars'));
      return;
    }
    if (!comment.trim()) {
      Alert.alert(t('writeReview.errorTitle'), t('writeReview.enterComment'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('reviews').insert({
      place_id: placeId,
      user_id: user?.id,
      rating,
      comment: comment.trim(),
    });
    if (error) {
      Alert.alert(t('writeReview.errorTitle'), t('writeReview.submitFailed'));
    } else {
      Alert.alert(t('writeReview.successTitle'), t('writeReview.thanks'), [
        { text: t('common.ok'), onPress: () => router.back() }
      ]);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('writeReview.title')}</Text>
          </View>

          {/* Place name */}
          <View style={styles.placeCard}>
            <Text style={styles.placeLabel}>{t('writeReview.place')}</Text>
            <Text style={styles.placeName}>{placeName}</Text>
          </View>

          {/* Star rating */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('writeReview.yourRating')}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starButton}>
                  <Text style={styles.starEmoji}>{star <= rating ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingLabel}>
              {rating === 0 ? t('writeReview.notSelected') :
               rating === 1 ? t('writeReview.ratingBad') :
               rating === 2 ? t('writeReview.ratingNotGood') :
               rating === 3 ? t('writeReview.ratingOkay') :
               rating === 4 ? t('writeReview.ratingGood') : t('writeReview.ratingExcellent')}
            </Text>
          </View>

          {/* Comment */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('writeReview.comment')}</Text>
            <TextInput
              style={styles.commentInput}
              placeholder={t('writeReview.commentPlaceholder')}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.charCount}>{t('writeReview.chars', { count: comment.length })}</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.submitText}>
              {loading ? t('writeReview.sending') : t('writeReview.submit')}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const PRIMARY_BLUE = '#1E88E5';
const LIGHT_BLUE = '#E3F2FD';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backButton: { width: 36, height: 36, backgroundColor: '#F5F7FB', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  backText: { fontSize: 18, color: PRIMARY_BLUE, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  placeCard: { backgroundColor: LIGHT_BLUE, borderRadius: 14, padding: 16, marginBottom: 24 },
  placeLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  placeName: { fontSize: 16, fontWeight: '700', color: PRIMARY_BLUE },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  starsRow: { flexDirection: 'row', marginBottom: 8 },
  starButton: { marginRight: 8 },
  starEmoji: { fontSize: 36 },
  ratingLabel: { fontSize: 14, color: '#6B7280', fontStyle: 'italic' },
  commentInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A1A', backgroundColor: '#F9FAFB', minHeight: 120 },
  charCount: { fontSize: 12, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
  submitButton: { backgroundColor: PRIMARY_BLUE, borderRadius: 14, padding: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});