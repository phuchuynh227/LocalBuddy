import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '../context/AuthContext'

export default function Index() {
  const { session, loading, profileLoading, requiresProfileSetup } = useAuth()

  if (loading || profileLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    )
  }

  if (!session) return <Redirect href={"/(auth)/login" as any} />
  if (requiresProfileSetup) return <Redirect href={"/personal-info" as any} />

  return <Redirect href={"/(tabs)/" as any} />
}
