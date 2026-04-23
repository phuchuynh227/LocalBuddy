import { Entypo } from '@expo/vector-icons'
import { Redirect, Tabs } from 'expo-router'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'

export default function TabLayout() {
  const { session, loading, profileLoading, requiresProfileSetup } = useAuth()
  const { t } = useLanguage()

  if (loading || profileLoading) return null

  if (!session) return <Redirect href={"/(auth)/login" as any} />
  if (requiresProfileSetup) return <Redirect href={"/personal-info" as any} />

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1E88E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { borderTopColor: '#E5E7EB' },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Entypo name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.explore'),
          tabBarLabel: t('tabs.explore'),
          tabBarIcon: ({ color, size }) => <Entypo name="magnifying-glass" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <Entypo name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
