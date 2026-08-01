import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { getComments, addComment } from '../../services/comments';
import { searchProfiles } from '../../services/social';

const MENTION_SEARCH_DEBOUNCE_MS = 250;
const TRAILING_MENTION_RE = /(?:^|\s)@(\w*)$/;
const HIGHLIGHT_RE = /(@\w+)/g;

function getInitials(name) {
  if (!name) return '?';
  return name.trim().slice(0, 1).toUpperCase();
}

function CommentAvatar({ avatarUrl, name }) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
    </View>
  );
}

function HighlightedCommentText({ text }) {
  const parts = text.split(HIGHLIGHT_RE);
  return (
    <Text style={styles.commentText}>
      {parts.map((part, i) =>
        HIGHLIGHT_RE.test(part) ? (
          <Text key={i} style={styles.mention}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

export default function CommentSheet({ visible, onClose, post, currentUserId, onCommentPosted }) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [posting, setPosting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionResults, setMentionResults] = useState([]);
  const mentionDebounce = useRef(null);

  useEffect(() => {
    if (!visible || !post?.id) return;
    setLoading(true);
    getComments(post.id)
      .then(setComments)
      .catch((err) => console.error('Failed to load comments:', err))
      .finally(() => setLoading(false));
  }, [visible, post?.id]);

  useEffect(() => {
    if (!visible) {
      setInputText('');
      setMentionQuery(null);
      setMentionResults([]);
      if (mentionDebounce.current) clearTimeout(mentionDebounce.current);
    }
  }, [visible]);

  function handleChangeText(text) {
    setInputText(text);
    const match = text.match(TRAILING_MENTION_RE);
    const query = match ? match[1] : null;
    setMentionQuery(query);

    if (mentionDebounce.current) clearTimeout(mentionDebounce.current);
    if (!query) {
      setMentionResults([]);
      return;
    }
    mentionDebounce.current = setTimeout(async () => {
      try {
        const results = await searchProfiles(query, currentUserId);
        setMentionResults(results);
      } catch (err) {
        setMentionResults([]);
      }
    }, MENTION_SEARCH_DEBOUNCE_MS);
  }

  function handleSelectMention(profile) {
    if (!profile.username) return;
    const next = inputText.replace(TRAILING_MENTION_RE, (match) =>
      match.startsWith(' ') ? ` @${profile.username} ` : `@${profile.username} `
    );
    setInputText(next);
    setMentionQuery(null);
    setMentionResults([]);
  }

  async function handlePost() {
    const trimmed = inputText.trim();
    if (!trimmed || !currentUserId || !post?.id || posting) return;
    setPosting(true);
    try {
      const saved = await addComment({
        postId: post.id,
        userId: currentUserId,
        commentText: trimmed,
        postOwnerId: post.userId,
      });
      setComments((prev) => [...prev, saved]);
      setInputText('');
      setMentionQuery(null);
      setMentionResults([]);
      onCommentPosted?.(post.id);
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView
          style={[styles.sheet, { paddingBottom: insets.bottom }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.red} style={{ marginVertical: 24 }} />
          ) : comments.length === 0 ? (
            <Text style={styles.emptyText}>No comments yet. Be the first to say something.</Text>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={{ paddingBottom: 12 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <CommentAvatar avatarUrl={item.avatarUrl} name={item.fullName || item.username} />
                  <View style={styles.commentBody}>
                    <View style={styles.commentMetaRow}>
                      <Text style={styles.commentUsername}>{item.username}</Text>
                      <Text style={styles.commentTime}>{item.timeAgo}</Text>
                    </View>
                    <HighlightedCommentText text={item.commentText} />
                  </View>
                </View>
              )}
            />
          )}

          {mentionQuery !== null && mentionResults.length > 0 && (
            <FlatList
              data={mentionResults}
              keyExtractor={(item) => item.user_id}
              style={styles.mentionDropdown}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.mentionRow} onPress={() => handleSelectMention(item)}>
                  <CommentAvatar avatarUrl={item.avatar_url} name={item.full_name || item.username} />
                  <Text style={styles.mentionUsername}>@{item.username}</Text>
                </TouchableOpacity>
              )}
            />
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={handleChangeText}
              placeholder="Add a comment... use @ to tag someone"
              placeholderTextColor={colors.muted}
              multiline
            />
            <TouchableOpacity
              style={[styles.postButton, (!inputText.trim() || posting) && styles.postButtonDisabled]}
              onPress={handlePost}
              disabled={!inputText.trim() || posting}
            >
              <Text style={styles.postButtonText}>{posting ? '…' : 'Post'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 14, 26, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.navy,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    minHeight: '45%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.navyBorder,
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  list: {
    flexGrow: 0,
  },
  commentRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  avatarFallback: {
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  commentBody: {
    flex: 1,
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentUsername: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
    marginRight: 8,
  },
  commentTime: {
    color: colors.muted,
    fontSize: 11,
  },
  commentText: {
    color: colors.offWhite,
    fontSize: 13,
    lineHeight: 18,
  },
  mention: {
    color: colors.red,
    fontWeight: '700',
  },
  mentionDropdown: {
    maxHeight: 180,
    backgroundColor: colors.navyCard,
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  mentionUsername: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 14,
    maxHeight: 90,
  },
  postButton: {
    backgroundColor: colors.red,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
