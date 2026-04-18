import { Link, router } from 'expo-router'
import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native'
import { useLanguage } from '../../context/LanguageContext'
import { supabase } from '../../lib/supabase'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { t } = useLanguage()

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      globalThis.alert?.(`${title}\n${message}`)
      return
    }
    Alert.alert(title, message)
  }

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert(t('writeReview.errorTitle'), t('auth.missingEmailPassword'))
      return
    }
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        showAlert(t('auth.loginFailed'), error.message)
        return
      }
      // Route via root so AuthContext resolves session first on web/native.
      router.replace('/' as any)
    } catch (error: any) {
      showAlert(t('auth.loginFailed'), error?.message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t('auth.loginTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? t('auth.loggingIn') : t('auth.login')}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkText}>
              {t('auth.noAccount')}
              <Text style={styles.linkBold}>{t('auth.registerNow')}</Text>
            </Text>
          </TouchableOpacity>
        </Link>

        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkText}>{t('forgotPassword.link')}</Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },
  title: { fontSize: 36, fontWeight: '700', color: '#1E88E5', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 40, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, backgroundColor: '#F9FAFB' },
  button: { backgroundColor: '#1E88E5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#6B7280', fontSize: 14 },
  linkBold: { color: '#1E88E5', fontWeight: '600' },
})