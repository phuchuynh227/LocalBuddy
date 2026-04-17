import { Link, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../context/LanguageContext'

export default function RegisterScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter() 
  const { t } = useLanguage()

  const handleRegister = async () => {
    if (!email || !password) {
      Alert.alert(t('writeReview.errorTitle'), t('auth.missingInfo'))
      return
    }
    if (password !== confirmPassword) {
      Alert.alert(t('writeReview.errorTitle'), t('auth.passwordMismatch'))
      return
    }
    if (password.length < 6) {
      Alert.alert(t('writeReview.errorTitle'), t('auth.passwordTooShort'))
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      Alert.alert(t('auth.registerFailed'), error.message)
    } else {
        Alert.alert(t('auth.accountCreatedTitle'), t('auth.accountCreated'), [
            { text: t('common.ok'), onPress: () => router.replace('/(auth)/login' as any) }
        ])
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.inner}>
        <Text style={styles.title}>{t('auth.registerTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>

        <TextInput style={styles.input} placeholder={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry />
        <TextInput style={styles.input} placeholder={t('auth.confirmPassword')} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? t('auth.registering') : t('auth.register')}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkText}>
              {t('auth.haveAccount')}
              <Text style={styles.linkBold}>{t('auth.signIn')}</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  title: { fontSize: 32, fontWeight: '700', color: '#1E88E5', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 40, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, backgroundColor: '#F9FAFB' },
  button: { backgroundColor: '#1E88E5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#6B7280', fontSize: 14 },
  linkBold: { color: '#1E88E5', fontWeight: '600' },
})