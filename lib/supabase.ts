import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'
import { Platform } from 'react-native'

const supabaseUrl = 'https://rfzedxvzycqzmnxcyrlu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmemVkeHZ6eWNxem1ueGN5cmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjEzNzEsImV4cCI6MjA4OTE5NzM3MX0.zDj-RvkDpTB4IO6NpPKzC6W6iSWs93-OblCHIree29s'

// Storage adapter cho cả web và native
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return globalThis.sessionStorage?.getItem(key) ?? null
    }
    return AsyncStorage.getItem(key)
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      globalThis.sessionStorage?.setItem(key, value)
    } else {
      await AsyncStorage.setItem(key, value)
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      globalThis.sessionStorage?.removeItem(key)
    } else {
      await AsyncStorage.removeItem(key)
    }
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})