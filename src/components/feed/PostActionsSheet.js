import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { REPORT_REASONS } from '../../services/moderation';

// Two-step bottom sheet opened from the feed's "..." rail button: a small
// menu (Report Post / Block User), and — only when Report Post is tapped —
// the list of report reasons. Kept as one component/one modal (rather than
// two) so the reason list can slide in without a jarring close+reopen, and
// so FeedScreen only has to track a single "which post is this sheet for"
// piece of state.
export default function PostActionsSheet({ visible, post, onClose, onReport, onBlock }) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('menu'); // 'menu' | 'reasons'
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setMode('menu');
      setSubmitting(false);
    }
  }, [visible]);

  function handleBlockPress() {
    Alert.alert(
      'Block this user?',
      `You won't see @${post?.user ?? 'this user'}'s posts in your feed anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            onBlock(post);
            onClose();
          },
        },
      ]
    );
  }

  async function handleSelectReason(reason) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onReport(post, reason);
    } finally {
      setSubmitting(false);
      onClose();
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />

          {mode === 'menu' ? (
            <>
              <Text style={styles.title}>Post options</Text>
              <TouchableOpacity style={styles.row} onPress={() => setMode('reasons')}>
                <Ionicons name="flag-outline" size={20} color={colors.white} />
                <Text style={styles.rowText}>Report Post</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.row} onPress={handleBlockPress}>
                <Ionicons name="person-remove-outline" size={20} color={colors.red} />
                <Text style={[styles.rowText, styles.destructiveText]}>Block User</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.reasonsHeader}>
                <TouchableOpacity onPress={() => setMode('menu')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="arrow-back" size={20} color={colors.muted} />
                </TouchableOpacity>
                <Text style={styles.title}>Why are you reporting this?</Text>
              </View>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={styles.row}
                  onPress={() => handleSelectReason(reason)}
                  disabled={submitting}
                >
                  <Text style={styles.rowText}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <TouchableOpacity style={styles.cancelRow} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.navyBorder,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  title: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reasonsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
  },
  rowText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  destructiveText: {
    color: colors.red,
  },
  cancelRow: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
  },
  cancelText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
  },
});
