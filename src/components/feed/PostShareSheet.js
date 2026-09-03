import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import colors from '../../theme/colors';
import { saveMediaToDevice } from '../../utils/saveMedia';

const POST_LINK_BASE = 'https://saveitgolf.com/post';

// Downloads the post's media into the cache dir and hands it to the native
// share sheet (Sharing.shareAsync) so the user can send the actual image —
// not just a link — via iMessage or any other app. Native-only: only
// reachable from the bottom-sheet UI below, which doesn't render this row
// on web.
async function shareViaText(mediaUrl) {
  const Sharing = require('expo-sharing');
  const { File, Paths, Directory } = require('expo-file-system');

  const downloaded = await File.downloadFileAsync(mediaUrl, new Directory(Paths.cache), {
    idempotent: true,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(downloaded.uri);
  }
}

// Bottom sheet (native) / dropdown (web) opened from the feed's share rail
// button. Save-to-camera-roll reuses the same saveMediaToDevice helper the
// old bookmark button used, since it already branches native-vs-web.
export default function PostShareSheet({ visible, post, onClose, onToast, onShared }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const isWeb = Platform.OS === 'web';

  async function handleSaveToCameraRoll() {
    if (!post || busy) return;
    setBusy(true);
    try {
      await saveMediaToDevice(post.mediaUrl);
      onToast?.(isWeb ? 'Image downloaded' : 'Saved to Camera Roll');
    } catch (err) {
      console.error('Failed to save post media:', err);
      onToast?.(
        err.message === 'PERMISSION_DENIED'
          ? 'Allow photo library access to save posts to your camera roll.'
          : "Couldn't save this post. Please try again."
      );
    } finally {
      setBusy(false);
      onClose();
    }
  }

  async function handleShareViaText() {
    if (!post || busy) return;
    setBusy(true);
    try {
      await shareViaText(post.mediaUrl);
      onShared?.(post);
    } catch (err) {
      console.error('Failed to share post:', err);
      onToast?.("Couldn't share this post. Please try again.");
    } finally {
      setBusy(false);
      onClose();
    }
  }

  async function handleCopyLink() {
    if (!post || busy) return;
    setBusy(true);
    try {
      await Clipboard.setStringAsync(`${POST_LINK_BASE}/${post.id}`);
      onToast?.('Link copied to clipboard');
      onShared?.(post);
    } catch (err) {
      console.error('Failed to copy post link:', err);
      onToast?.("Couldn't copy the link. Please try again.");
    } finally {
      setBusy(false);
      onClose();
    }
  }

  if (isWeb) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        transparent
        supportedOrientations={['portrait']}
        onRequestClose={onClose}
      >
        <TouchableOpacity style={styles.webBackdrop} activeOpacity={1} onPress={onClose}>
          <View style={styles.webCard} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.webRow} onPress={handleSaveToCameraRoll} disabled={busy}>
              <Ionicons name="download-outline" size={18} color={colors.white} />
              <Text style={styles.rowText}>Save Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.webRow, styles.webRowDivider]} onPress={handleCopyLink} disabled={busy}>
              <Ionicons name="link-outline" size={18} color={colors.white} />
              <Text style={styles.rowText}>Copy Link</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
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
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Share post</Text>

          <TouchableOpacity style={styles.row} onPress={handleSaveToCameraRoll} disabled={busy}>
            <Ionicons name="download-outline" size={20} color={colors.white} />
            <Text style={styles.rowText}>Save to Camera Roll</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={handleShareViaText} disabled={busy}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.white} />
            <Text style={styles.rowText}>Share via Text</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={handleCopyLink} disabled={busy}>
            <Ionicons name="link-outline" size={20} color={colors.white} />
            <Text style={styles.rowText}>Copy Link</Text>
          </TouchableOpacity>

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
  webBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 14, 26, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webCard: {
    backgroundColor: colors.navy,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    paddingHorizontal: 8,
    minWidth: 220,
    overflow: 'hidden',
  },
  webRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  webRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
  },
});
