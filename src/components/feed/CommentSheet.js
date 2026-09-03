import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import MentionTextInput from '../social/MentionTextInput';
import MentionText from '../social/MentionText';
import {
  getComments,
  addComment,
  deleteComment,
  getLikedCommentIds,
  likeComment,
  unlikeComment,
} from '../../services/comments';

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

export default function CommentSheet({
  visible,
  onClose,
  post,
  currentUserId,
  onCommentPosted,
  onCommentDeleted,
  onMentionPress,
}) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [posting, setPosting] = useState(false);
  const [likedCommentIds, setLikedCommentIds] = useState(new Set());

  useEffect(() => {
    if (!visible || !post?.id) return;
    setLoading(true);
    getComments(post.id)
      .then(async (loaded) => {
        setComments(loaded);
        if (currentUserId) {
          try {
            const liked = await getLikedCommentIds(currentUserId, loaded.map((c) => c.id));
            setLikedCommentIds(new Set(liked));
          } catch (err) {
            console.error('Failed to load comment likes:', err);
          }
        }
      })
      .catch((err) => console.error('Failed to load comments:', err))
      .finally(() => setLoading(false));
  }, [visible, post?.id, currentUserId]);

  useEffect(() => {
    if (!visible) {
      setInputText('');
      setLikedCommentIds(new Set());
    }
  }, [visible]);

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
      onCommentPosted?.(post.id);
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setPosting(false);
    }
  }

  async function handleToggleCommentLike(commentId) {
    if (!currentUserId) return;
    const isLiked = likedCommentIds.has(commentId);
    setLikedCommentIds((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    try {
      if (isLiked) {
        await unlikeComment(currentUserId, commentId);
      } else {
        await likeComment(currentUserId, commentId);
      }
    } catch (err) {
      console.error('Failed to toggle comment like:', err);
      setLikedCommentIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.add(commentId);
        else next.delete(commentId);
        return next;
      });
    }
  }

  // RLS already blocks deleting someone else's comment, but the trash icon
  // is only ever rendered on the caller's own rows and long-press bails
  // early below, so this never even attempts the request for others' rows.
  async function handleDeleteComment(commentId) {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentDeleted?.(post.id);
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  }

  function confirmDeleteComment(comment) {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this comment?')) {
        handleDeleteComment(comment.id);
      }
      return;
    }
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteComment(comment.id) },
    ]);
  }

  function handleLongPress(comment) {
    if (comment.userId !== currentUserId) return;
    confirmDeleteComment(comment);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      supportedOrientations={['portrait']}
      onRequestClose={onClose}
    >
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
              renderItem={({ item }) => {
                const isOwnComment = item.userId === currentUserId;
                return (
                  <View style={styles.commentRow}>
                    <TouchableOpacity
                      style={styles.commentMain}
                      activeOpacity={1}
                      onLongPress={() => handleLongPress(item)}
                      delayLongPress={400}
                    >
                      <CommentAvatar avatarUrl={item.avatarUrl} name={item.fullName || item.username} />
                      <View style={styles.commentBody}>
                        <View style={styles.commentMetaRow}>
                          <Text style={styles.commentUsername}>{item.username}</Text>
                          <Text style={styles.commentTime}>{item.timeAgo}</Text>
                        </View>
                        <MentionText
                          text={item.commentText}
                          style={styles.commentText}
                          onMentionPress={onMentionPress}
                        />
                      </View>
                    </TouchableOpacity>
                    <View style={styles.commentActions}>
                      <TouchableOpacity
                        style={styles.commentLikeButton}
                        onPress={() => handleToggleCommentLike(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={likedCommentIds.has(item.id) ? 'heart' : 'heart-outline'}
                          size={14}
                          color={likedCommentIds.has(item.id) ? colors.red : colors.muted}
                        />
                      </TouchableOpacity>
                      {isOwnComment && (
                        <TouchableOpacity
                          style={styles.commentDeleteButton}
                          onPress={() => confirmDeleteComment(item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={14} color={colors.red} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}

          <View style={styles.inputRow}>
            <MentionTextInput
              containerStyle={styles.mentionInputWrapper}
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              currentUserId={currentUserId}
              placeholder="Add a comment"
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
  commentMain: {
    flex: 1,
    flexDirection: 'row',
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
  commentActions: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    marginLeft: 8,
    gap: 10,
  },
  commentLikeButton: {
    paddingTop: 2,
  },
  commentDeleteButton: {
    paddingTop: 2,
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
  mentionInputWrapper: {
    flex: 1,
  },
  input: {
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
