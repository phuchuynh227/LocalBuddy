import { Stack } from 'expo-router'
import React from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { AuthProvider } from '../context/AuthContext'
import { LanguageProvider } from '../context/LanguageContext'

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
        <AppFrame>
          <Stack screenOptions={{ headerShown: false }} />
        </AppFrame>
      </AuthProvider>
    </LanguageProvider>
  )
}

const styles = StyleSheet.create({
  webPage: {
    flex: 1,
    backgroundColor: '#EEF3F8',
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
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
})
