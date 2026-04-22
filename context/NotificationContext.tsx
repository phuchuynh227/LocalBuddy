import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { supabase } from '../lib/supabase';

type NotificationType = 'approval' | 'cancelled' | 'message';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  actionHref: string;
  read: boolean;
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markChatRead: (matchId: string) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const SEEN_KEY = 'localbuddy_notifications_seen';
const CHAT_READ_KEY = 'localbuddy_chat_last_read';

type MatchRow = {
  id: string;
  user1_id: string;
  user2_id: string;
  plans: { title: string | null } | null;
};

type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [chatLastRead, setChatLastRead] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [seenRaw, chatRaw] = await Promise.all([
          AsyncStorage.getItem(SEEN_KEY),
          AsyncStorage.getItem(CHAT_READ_KEY),
        ]);

        if (!active) return;
        setSeenIds(seenRaw ? JSON.parse(seenRaw) : []);
        setChatLastRead(chatRaw ? JSON.parse(chatRaw) : {});
      } catch {
        if (!active) return;
        setSeenIds([]);
        setChatLastRead({});
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const labels = useMemo(() => {
    if (language === 'vn') {
      return {
        approvalTitle: 'Can phe duyet',
        approvalBody: (planTitle: string, requesterId: string) =>
          `${requesterId.slice(0, 8)} muon tham gia "${planTitle}".`,
        cancelledTitle: 'Lich da huy',
        cancelledBody: (planTitle: string) => `Plan "${planTitle}" da bi huy.`,
        messageTitle: 'Tin nhan moi',
        messageBody: (planTitle: string, content: string) =>
          `${planTitle}: ${content}`,
      };
    }

    return {
      approvalTitle: 'Approval needed',
      approvalBody: (planTitle: string, requesterId: string) =>
        `${requesterId.slice(0, 8)} wants to join "${planTitle}".`,
      cancelledTitle: 'Plan cancelled',
      cancelledBody: (planTitle: string) => `"${planTitle}" has been cancelled.`,
      messageTitle: 'New message',
      messageBody: (planTitle: string, content: string) =>
        `${planTitle}: ${content}`,
    };
  }, [language]);

  const persistSeen = useCallback(async (nextSeen: string[]) => {
    setSeenIds(nextSeen);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(nextSeen));
  }, []);

  const persistChatRead = useCallback(async (nextMap: Record<string, string>) => {
    setChatLastRead(nextMap);
    await AsyncStorage.setItem(CHAT_READ_KEY, JSON.stringify(nextMap));
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [hostPlansRes, requesterRes, matchesRes] = await Promise.all([
        supabase
          .from('plans')
          .select('id, title, plan_requests(id, requester_id, status, created_at)')
          .eq('host_id', user.id),
        supabase
          .from('plan_requests')
          .select('id, created_at, status, plans(id, title, status)')
          .eq('requester_id', user.id)
          .in('status', ['pending', 'accepted']),
        supabase
          .from('matches')
          .select('id, user1_id, user2_id, plans(title)')
          .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
      ]);

      const nextNotifications: AppNotification[] = [];

      if (hostPlansRes.data) {
        for (const plan of hostPlansRes.data as any[]) {
          for (const request of plan.plan_requests ?? []) {
            if (request.status !== 'pending') continue;
            const id = `approval-${request.id}`;
            nextNotifications.push({
              id,
              type: 'approval',
              title: labels.approvalTitle,
              body: labels.approvalBody(plan.title ?? 'Plan', request.requester_id),
              createdAt: request.created_at,
              actionHref: '/my-plans',
              read: seenIds.includes(id),
            });
          }
        }
      }

      if (requesterRes.data) {
        for (const request of requesterRes.data as any[]) {
          if (request.plans?.status !== 'cancelled') continue;
          const id = `cancelled-${request.id}`;
          nextNotifications.push({
            id,
            type: 'cancelled',
            title: labels.cancelledTitle,
            body: labels.cancelledBody(request.plans?.title ?? 'Plan'),
            createdAt: request.created_at,
            actionHref: '/my-matches',
            read: seenIds.includes(id),
          });
        }
      }

      const matches = (matchesRes.data as MatchRow[] | null) ?? [];
      if (matches.length > 0) {
        const matchIds = matches.map((match) => match.id);
        const { data: messages } = await supabase
          .from('messages')
          .select('id, match_id, sender_id, content, created_at')
          .in('match_id', matchIds)
          .neq('sender_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200);

        if (messages) {
          const latestPerMatch = new Map<string, MessageRow>();
          for (const message of messages as MessageRow[]) {
            if (!latestPerMatch.has(message.match_id)) {
              latestPerMatch.set(message.match_id, message);
            }
          }

          latestPerMatch.forEach((message, matchId) => {
            const lastReadAt = chatLastRead[matchId];
            const isUnread = !lastReadAt || new Date(message.created_at).getTime() > new Date(lastReadAt).getTime();
            const match = matches.find((item) => item.id === matchId);
            const planTitle = match?.plans?.title ?? 'Chat';
            const id = `message-${matchId}-${message.id}`;
            nextNotifications.push({
              id,
              type: 'message',
              title: labels.messageTitle,
              body: labels.messageBody(planTitle, message.content),
              createdAt: message.created_at,
              actionHref: `/chat?matchUserId=${match ? (match.user1_id === user.id ? match.user2_id : match.user1_id) : ''}&planTitle=${encodeURIComponent(planTitle)}`,
              read: !isUnread || seenIds.includes(id),
            });
          });
        }
      }

      nextNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(nextNotifications);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [chatLastRead, labels, seenIds, user?.id]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_requests' }, refreshNotifications)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans' }, refreshNotifications)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refreshNotifications)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, refreshNotifications)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshNotifications, user?.id]);

  const markAllRead = useCallback(async () => {
    const ids = notifications
      .filter((notification) => notification.type !== 'message')
      .map((notification) => notification.id);

    const nextSeen = Array.from(new Set([...seenIds, ...ids]));
    await persistSeen(nextSeen);
    setNotifications((prev) => prev.map((notification) => (
      notification.type === 'message' ? notification : { ...notification, read: true }
    )));
  }, [notifications, persistSeen, seenIds]);

  const markChatRead = useCallback(async (matchId: string) => {
    const nextMap = { ...chatLastRead, [matchId]: new Date().toISOString() };
    await persistChatRead(nextMap);
    setNotifications((prev) => prev.map((notification) => (
      notification.type === 'message' && notification.id.includes(`message-${matchId}-`)
        ? { ...notification, read: true }
        : notification
    )));
  }, [chatLastRead, persistChatRead]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markAllRead,
    markChatRead,
  }), [loading, markAllRead, markChatRead, notifications, refreshNotifications, unreadCount]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
