import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert(t('writeReview.errorTitle'), t('auth.missingInfo'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('writeReview.errorTitle'), t('auth.passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('writeReview.errorTitle'), t('auth.passwordTooShort'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      Alert.alert(t('writeReview.errorTitle'), error.message);
    } else {
      Alert.alert(t('writeReview.successTitle'), t('changePassword.successSubtitle'), [
        { text: t('common.ok'), onPress: () => router.back() }
      ]);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inner}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t('changePassword.title')}</Text>
          <Text style={styles.subtitle}>{t('changePassword.subtitle')}</Text>

          <TextInput
            style={styles.input}
            placeholder={t('changePassword.newPassword')}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder={t('changePassword.confirmPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.button} onPress={handleChange} disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? t('changePassword.updating') : t('changePassword.updateButton')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const PRIMARY_BLUE = '#1E88E5';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  backButton: { position: 'absolute', top: 20, left: 28, width: 36, height: 36, backgroundColor: '#F5F7FB', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 18, color: PRIMARY_BLUE, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 32, lineHeight: 22 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, backgroundColor: '#F9FAFB' },
  button: { backgroundColor: PRIMARY_BLUE, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});