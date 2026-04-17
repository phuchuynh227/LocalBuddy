import { Redirect, Tabs } from 'expo-router'
import { Text } from 'react-native'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'

export default function TabLayout() {
  const { session, loading } = useAuth()
  const { t } = useLanguage()

  if (loading) return null

  if (!session) return <Redirect href="/(auth)/login" />

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#1E88E5',
      tabBarInactiveTintColor: '#9CA3AF',
      tabBarStyle: { borderTopColor: '#E5E7EB' },
      headerShown: false,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>{color === '#1E88E5' ? '🏠' : '🏡'}</Text>,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.explore'),
          tabBarLabel: t('tabs.explore'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>{color === '#1E88E5' ? '🔍' : '🔎'}</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>{color === '#1E88E5' ? '👤' : '👥'}</Text>,
        }}
      />
    </Tabs>
  )
}