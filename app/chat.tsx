import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppBottomNav } from '../components/AppBottomNav';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { getProfileDisplayName, normalizeUserProfile, UserProfile } from '../lib/user-profile';
import { supabase } from '../lib/supabase';

type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { markChatRead } = useNotifications();
  const { matchUserId, planTitle } = useLocalSearchParams<{
    matchUserId: string;
    planTitle: string;
    matchId?: string;
  }>();

  const [matchId, setMatchId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [buddyProfile, setBuddyProfile] = useState<UserProfile | null>(null);
  const [showBuddyProfile, setShowBuddyProfile] = useState(false);
  const [zoomedAvatarUrl, setZoomedAvatarUrl] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = async (currentMatchId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('match_id', currentMatchId)
      .order('created_at', { ascending: true });

    return data ?? [];
  };

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const findMatch = async () => {
      let resolvedMatchId = matchId ?? null;

      if (!resolvedMatchId) {
        const { data } = await supabase
          .from('matches')
          .select('id')
          .or(
            `and(user1_id.eq.${user?.id},user2_id.eq.${matchUserId}),and(user1_id.eq.${matchUserId},user2_id.eq.${user?.id})`
          )
          .limit(1)
          .single();

        resolvedMatchId = data?.id ?? null;
      }

      if (!active) return;

      if (!resolvedMatchId) {
        setLoading(false);
        return;
      }

      setMatchId(resolvedMatchId);
      const [messageRows, profileRes] = await Promise.all([
        fetchMessages(resolvedMatchId),
        supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', matchUserId)
          .maybeSingle(),
      ]);

      if (!active) return;
      setMessages(messageRows);
      setBuddyProfile(normalizeUserProfile(profileRes.data));
      setLoading(false);
      markChatRead(resolvedMatchId).catch(() => {});

      channel = supabase
        .channel(`chat-${resolvedMatchId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `match_id=eq.${resolvedMatchId}`,
          },
          (payload) => {
            setMessages((prev) => {
              if (prev.find((message) => message.id === payload.new.id)) return prev;
              return [...prev, payload.new as Message];
            });
            markChatRead(resolvedMatchId).catch(() => {});
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          }
        )
        .subscribe();
    };

    findMatch();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [markChatRead, matchId, matchUserId, user?.id]);

  const handleSend = async () => {
    if (!text.trim() || !matchId) return;

    setSending(true);
    const content = text.trim();
    setText('');

    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      match_id: matchId,
      sender_id: user?.id ?? '',
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        match_id: matchId,
        sender_id: user?.id,
        content,
      })
      .select()
      .single();

    if (!error && data) {
      setMessages((prev) => prev.map((message) => (message.id === optimisticMessage.id ? data : message)));
    } else {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
    }

    setSending(false);
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderVisibleFields = () => {
    const visibility = buddyProfile?.visibility_settings;
    const rows: string[] = [];

    if (visibility?.fullName && buddyProfile?.full_name) rows.push(`${t('personalInfo.fullName')}: ${buddyProfile.full_name}`);
    if (visibility?.nickname && buddyProfile?.nickname) rows.push(`${t('personalInfo.nickname')}: ${buddyProfile.nickname}`);
    if (visibility?.gender && buddyProfile?.gender) rows.push(`${t('personalInfo.gender')}: ${t(`personalInfo.genderOptions.${buddyProfile.gender}`)}`);
    if (visibility?.birthYear && buddyProfile?.birth_year) rows.push(`${t('personalInfo.birthYear')}: ${buddyProfile.birth_year}`);
    if (visibility?.interests && buddyProfile?.interests) rows.push(`${t('personalInfo.interests')}: ${buddyProfile.interests}`);

    if (rows.length === 0) {
      return <Text style={styles.previewEmpty}>{t('myPlans.profilePreviewEmpty')}</Text>;
    }

    return rows.map((row) => (
      <Text key={row} style={styles.previewField}>
        {row}
      </Text>
    ));
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === user?.id;
    const prevItem = index > 0 ? messages[index - 1] : null;
    const showTime = !prevItem ||
      new Date(item.created_at).getTime() - new Date(prevItem.created_at).getTime() > 5 * 60 * 1000;

    return (
      <View>
        {showTime && <Text style={styles.timeLabel}>{formatTime(item.created_at)}</Text>}
        <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
              {item.content}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerProfile} activeOpacity={0.9} onPress={() => setShowBuddyProfile(true)}>
          <UserAvatar profile={buddyProfile} fallbackText={matchUserId} size={42} textSize={16} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerInfo} activeOpacity={0.9} onPress={() => setShowBuddyProfile(true)}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {planTitle ? decodeURIComponent(planTitle) : 'Chat'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {getProfileDisplayName(buddyProfile, `Buddy #${matchUserId?.slice(0, 8)}`)}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1E88E5" />
          </View>
        ) : matchId === null ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>?</Text>
            <Text style={styles.emptyText}>{language === 'vn' ? 'Không tìm thấy cuộc trò chuyện' : 'Conversation not found'}</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatEmoji}>...</Text>
                <Text style={styles.emptyChatText}>
                  {language === 'vn' ? 'Bắt đầu cuộc trò chuyện với buddy!' : 'Start the conversation with your buddy!'}
                </Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={language === 'vn' ? 'Nhắn tin...' : 'Message...'}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            placeholderTextColor="#9CA3AF"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!text.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            <Text style={styles.sendButtonText}>{'>'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {showBuddyProfile && (
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowBuddyProfile(false)} />
          <View style={styles.previewCard}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => buddyProfile?.avatar_url && setZoomedAvatarUrl(buddyProfile.avatar_url)}
              style={styles.previewAvatarWrap}
            >
              <UserAvatar profile={buddyProfile} fallbackText={matchUserId} size={72} textSize={26} />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>
              {getProfileDisplayName(buddyProfile, `Buddy #${matchUserId?.slice(0, 8)}`)}
            </Text>
            <View style={styles.previewScroll}>
              {renderVisibleFields()}
            </View>
            <TouchableOpacity style={styles.previewCloseButton} onPress={() => setShowBuddyProfile(false)}>
              <Text style={styles.previewCloseText}>{t('common.ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {zoomedAvatarUrl && (
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setZoomedAvatarUrl(null)} />
          <View style={styles.zoomCard}>
            <Image source={{ uri: zoomedAvatarUrl }} style={styles.zoomImage} contentFit="contain" />
          </View>
        </View>
      )}
      <AppBottomNav />
    </SafeAreaView>
  );
}

const PRIMARY_BLUE = '#1E88E5';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { width: 36, height: 36, backgroundColor: '#F5F7FB', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  backText: { fontSize: 18, color: PRIMARY_BLUE, fontWeight: '700' },
  headerProfile: { marginRight: 10 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  headerSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
  messagesList: { padding: 16, paddingBottom: 96 },
  timeLabel: { textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginVertical: 8 },
  messageRow: { flexDirection: 'row', marginBottom: 4, justifyContent: 'flex-start' },
  messageRowMe: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: PRIMARY_BLUE, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#F3F4F6', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: '#1A1A1A', lineHeight: 20 },
  bubbleTextMe: { color: '#FFFFFF' },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyChatEmoji: { fontSize: 48, marginBottom: 12 },
  emptyChatText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  input: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#1A1A1A', backgroundColor: '#F9FAFB', maxHeight: 100, marginRight: 8 },
  sendButton: { width: 42, height: 42, backgroundColor: PRIMARY_BLUE, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: '#E5E7EB' },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  previewCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
  },
  previewAvatarWrap: { alignSelf: 'center' },
  previewTitle: { marginTop: 12, marginBottom: 14, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  previewScroll: { maxHeight: 220 },
  previewField: { fontSize: 14, color: '#374151', marginBottom: 10, lineHeight: 20 },
  previewEmpty: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  previewCloseButton: { marginTop: 18, backgroundColor: PRIMARY_BLUE, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  previewCloseText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  zoomCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    width: '100%',
    maxWidth: 390,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  zoomImage: { width: '100%', aspectRatio: 1, borderRadius: 18, backgroundColor: '#F3F4F6' },
});
