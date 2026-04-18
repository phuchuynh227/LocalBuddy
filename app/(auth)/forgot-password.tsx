import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../context/LanguageContext';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert(t('writeReview.errorTitle'), t('forgotPassword.emailRequired'));
      return;
    }
    setLoading(true);
    const webRedirectTo =
      Platform.OS === 'web'
        ? `${globalThis.location?.origin ?? ''}/change-password`
        : 'localbuddy://reset-password';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: webRedirectTo,
    });
    if (error) {
      Alert.alert(t('writeReview.errorTitle'), error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.successEmoji}>📧</Text>
          <Text style={styles.successTitle}>{t('forgotPassword.successTitle')}</Text>
          <Text style={styles.successSubtitle}>{t('forgotPassword.successSubtitle', { email })}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>{t('forgotPassword.backToLogin')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{t('forgotPassword.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('forgotPassword.title')}</Text>
        <Text style={styles.subtitle}>{t('forgotPassword.subtitle')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('forgotPassword.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? t('forgotPassword.sending') : t('forgotPassword.sendButton')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const PRIMARY_BLUE = '#1E88E5';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  backButton: { position: 'absolute', top: 60, left: 28 },
  backText: { fontSize: 14, color: PRIMARY_BLUE, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 32, lineHeight: 22 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, backgroundColor: '#F9FAFB' },
  button: { backgroundColor: PRIMARY_BLUE, borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  successEmoji: { fontSize: 56, textAlign: 'center', marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', textAlign: 'center', marginBottom: 12 },
  successSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
});