import { Entypo } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';

export default function NotificationsScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { notifications, unreadCount, loading, markAllRead, refreshNotifications } = useNotifications();

  useFocusEffect(
    React.useCallback(() => {
      refreshNotifications();
    }, [refreshNotifications]),
  );

  const labels = useMemo(() => {
    if (language === 'vn') {
      return {
        title: 'Thong bao',
        empty: 'Chua co thong bao nao',
        emptySubtitle: 'Khi co request, huy lich, hoac tin nhan moi, thong bao se hien o day.',
        markRead: 'Danh dau da doc',
      };
    }

    return {
      title: 'Notifications',
      empty: 'No notifications yet',
      emptySubtitle: 'Approvals, cancellations, and new messages will appear here.',
      markRead: 'Mark read',
    };
  }, [language]);

  const renderItem = ({ item }: { item: typeof notifications[number] }) => (
    <TouchableOpacity
      style={[styles.card, !item.read && styles.cardUnread]}
      activeOpacity={0.9}
      onPress={() => router.push(item.actionHref as any)}
    >
      <View style={styles.iconWrap}>
        {item.type === 'approval' && (
          <Entypo name="hour-glass" size={18} color="#1E88E5" />
        )}
        {item.type === 'cancelled' && (
          <Entypo name="circle-with-cross" size={18} color="#1E88E5" />
        )}
        {item.type === 'message' && (
          <Entypo name="message" size={18} color="#1E88E5" />
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          {!item.read && <View style={styles.dot} />}
        </View>
        <Text style={styles.itemBody}>{item.body}</Text>
        <Text style={styles.itemTime}>
          {new Date(item.createdAt).toLocaleString(language === 'vn' ? 'vi-VN' : 'en-US')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Entypo name="chevron-thin-left" size={18} color="#1E88E5" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{labels.title}</Text>
          <Text style={styles.subtitle}>{unreadCount} unread</Text>
        </View>
        <TouchableOpacity onPress={() => { markAllRead(); refreshNotifications(); }}>
          <Text style={styles.markRead}>{labels.markRead}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E88E5" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Entypo name="notifications-off" size={32} color="#9CA3AF" style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>{labels.empty}</Text>
              <Text style={styles.emptySubtitle}>{labels.emptySubtitle}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 36,
    height: 36,
    backgroundColor: '#F5F7FB',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  subtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  markRead: { fontSize: 12, fontWeight: '700', color: '#1E88E5' },
  list: { padding: 20, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1, padding: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyIcon: { marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  card: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  cardUnread: { borderColor: '#BFDBFE', backgroundColor: '#F8FBFF' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', flex: 1, marginRight: 8 },
  itemBody: { fontSize: 13, color: '#4B5563', lineHeight: 18, marginBottom: 6 },
  itemTime: { fontSize: 11, color: '#9CA3AF' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1E88E5' },
});
