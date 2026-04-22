import { Stack } from 'expo-router'
import React from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { AuthProvider } from '../context/AuthContext'
import { LanguageProvider } from '../context/LanguageContext'
import { NotificationProvider } from '../context/NotificationContext'

function AppFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>

  return (
    <View style={styles.webPage}>
      <View style={styles.phoneFrame}>{children}</View>
    </View>
  )
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppFrame>
            <Stack screenOptions={{ headerShown: false }} />
          </AppFrame>
        </NotificationProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}

const styles = StyleSheet.create({
  webPage: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    minHeight: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#020617',
    shadowOpacity: 0.32,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 18 },
  },
})
