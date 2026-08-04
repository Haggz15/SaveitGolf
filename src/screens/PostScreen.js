import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import Header from '../components/Header';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { createPost } from '../services/posts';
import { searchCourses } from '../services/golfCourseApi';
import { notifyFollowersOfPost } from '../services/notifications';

// Static (paused) preview of the picked video with a play-button overlay —
// the player never calls .play(), so the first frame doubles as a thumbnail.
function VideoThumbnail({ uri }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
  });

  return (
    <View style={styles.photoPreview}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
      />
      <View style={styles.playButtonOverlay}>
        <Ionicons name="play" size={26} color={colors.white} />
      </View>
    </View>
  );
}

const SEARCH_DEBOUNCE_MS = 400;

export default function PostScreen({ navigation }) {
  const { user } = useAuth();
  const [courseQuery, setCourseQuery] = useState('');
  const [courseResults, setCourseResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [hole, setHole] = useState('');
  const [par, setPar] = useState('');
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState(null); // { uri, type: 'photo' | 'video' }
  const [posting, setPosting] = useState(false);
  const searchTimer = useRef(null);

  const handleChangeCourseQuery = (text) => {
    setCourseQuery(text);
    setSelectedCourse(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (text.trim().length < 2) {
      setCourseResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchCourses(text.trim());
        setCourseResults(results);
      } catch (err) {
        console.error('Course search failed:', err);
        setCourseResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    setCourseQuery(course.name);
    setCourseResults([]);
  };

  function handlePickMediaWeb() {
    // Created on demand rather than kept mounted: an <input type="file">
    // opens the native file/camera-roll picker on .click() whether or not
    // it's attached to the DOM, so there's nothing to render or clean up.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const uri = URL.createObjectURL(file);
      setMedia({ uri, type: file.type.startsWith('video') ? 'video' : 'photo' });
    };
    input.click();
  }

  async function handleTakeMedia() {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow camera access to take a photo or video.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.9,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setMedia({ uri: asset.uri, type: asset.type === 'video' ? 'video' : 'photo' });
      }
    } catch (err) {
      Alert.alert('Something went wrong', 'Could not open your camera. Please try again.');
    }
  }

  async function handleChooseFromLibrary() {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to add a photo or video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.9,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setMedia({ uri: asset.uri, type: asset.type === 'video' ? 'video' : 'photo' });
      }
    } catch (err) {
      Alert.alert('Something went wrong', 'Could not open your photo library. Please try again.');
    }
  }

  function handlePickMedia() {
    if (Platform.OS === 'web') {
      handlePickMediaWeb();
      return;
    }
    Alert.alert('Add photo or video', undefined, [
      { text: 'Take Photo/Video', onPress: handleTakeMedia },
      { text: 'Choose from Library', onPress: handleChooseFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSharePost() {
    if (!user?.id) return;
    if (!media) {
      Alert.alert('Add a photo or video', 'Pick a photo or video to share first.');
      return;
    }
    const courseName = selectedCourse?.name ?? courseQuery.trim();
    if (!courseName) {
      Alert.alert('Add a course', 'Enter or search for the course you played.');
      return;
    }

    setPosting(true);
    try {
      const post = await createPost({
        userId: user.id,
        course: selectedCourse ?? { id: null, name: courseName },
        hole: hole ? Number(hole) : null,
        par: par ? Number(par) : null,
        caption: caption.trim(),
        mediaUri: media.uri,
        mediaType: media.type,
      });

      notifyFollowersOfPost(user.id, post.id, courseName).catch((err) =>
        console.error('Failed to notify followers of post:', err)
      );

      setCourseQuery('');
      setSelectedCourse(null);
      setHole('');
      setPar('');
      setCaption('');
      setMedia(null);

      Alert.alert('Posted!', 'Your post is live on the feed.');
      navigation.navigate('Tabs', { screen: 'Feed' });
    } catch (err) {
      console.error('Failed to create post:', err);
      Alert.alert('Something went wrong', 'Could not share your post. Please try again.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New Hole Post</Text>

        <TouchableOpacity style={styles.photoUpload} onPress={handlePickMedia} activeOpacity={0.85}>
          {media ? (
            media.type === 'video' ? (
              <VideoThumbnail uri={media.uri} />
            ) : (
              <Image source={{ uri: media.uri }} style={styles.photoPreview} resizeMode="cover" />
            )
          ) : (
            <>
              <Ionicons name="camera-outline" size={32} color={colors.muted} />
              <Text style={styles.photoUploadText}>Add photo or video</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Course</Text>
        <TextInput
          style={styles.input}
          value={courseQuery}
          onChangeText={handleChangeCourseQuery}
          placeholder="e.g. Pebble Beach Golf Links"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
        />
        {courseQuery.trim().length >= 2 && !selectedCourse && (
          <View style={styles.dropdown}>
            {searching ? (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={colors.red} />
                <Text style={styles.statusText}>Searching…</Text>
              </View>
            ) : courseResults.length === 0 ? (
              <View style={styles.statusRow}>
                <Text style={styles.statusText}>No matches — you can still post with this name</Text>
              </View>
            ) : (
              <FlatList
                data={courseResults}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 220 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.resultRow} onPress={() => handleSelectCourse(item)}>
                    <Ionicons name="flag-outline" size={16} color={colors.red} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.resultLocation} numberOfLines={1}>
                        {[item.city, item.state].filter(Boolean).join(', ') || 'Location unknown'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Hole</Text>
            <TextInput
              style={styles.input}
              value={hole}
              onChangeText={setHole}
              keyboardType="number-pad"
              placeholder="#"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Par</Text>
            <TextInput
              style={styles.input}
              value={par}
              onChangeText={setPar}
              keyboardType="number-pad"
              placeholder="#"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>

        <Text style={styles.label}>Caption</Text>
        <TextInput
          style={[styles.input, styles.captionInput]}
          value={caption}
          onChangeText={setCaption}
          placeholder="Tell the story of this hole..."
          placeholderTextColor={colors.muted}
          multiline
        />

        <TouchableOpacity
          style={[styles.submitButton, posting && styles.submitButtonDisabled]}
          onPress={handleSharePost}
          disabled={posting}
        >
          <Text style={styles.submitButtonText}>{posting ? 'Posting…' : 'Share Post'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  photoUpload: {
    height: 160,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.navyBorder,
    borderStyle: 'dashed',
    backgroundColor: colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  photoUploadText: {
    color: colors.muted,
    marginTop: 8,
    fontSize: 13,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 14, 26, 0.35)',
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontSize: 14,
    marginBottom: 16,
  },
  dropdown: {
    marginTop: -10,
    marginBottom: 16,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  statusText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  resultName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  resultLocation: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  captionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
