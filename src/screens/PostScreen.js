import { useEffect, useRef, useState } from 'react';
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
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import Header from '../components/Header';
import MentionTextInput from '../components/social/MentionTextInput';
import GolfBallMark, { useGolfBallFont } from '../components/common/GolfBallMark';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { createPost } from '../services/posts';
import { searchCourses } from '../services/golfCourseApi';
import { notifyFollowersOfPost } from '../services/notifications';
import { geocodeCourseCoordinates } from '../services/geocoding';
import { courseHasValidCoordinates } from '../utils/mapCoords';

// Nominal content height of the upload progress banner — the actual
// rendered height also adds the device's safe-area top inset, same as
// Header.js's own HEADER_CONTENT_HEIGHT convention.
const BANNER_CONTENT_HEIGHT = 56;

// Slides down from the very top of the screen while a post is uploading —
// same Animated-driven approach on both native and web (react-native-web's
// Animated implementation handles this fine; `width` interpolation never
// supports the native driver on either platform anyway, so there's no need
// for a separate CSS-transition code path). Owns its own slide/progress
// animations, driven purely by the `visible`/`phase` props the parent sets.
function UploadBanner({ visible, phase, onRetry }) {
  const insets = useSafeAreaInsets();
  const ballFont = useGolfBallFont();
  const bannerHeight = BANNER_CONTENT_HEIGHT + insets.top;
  const bannerY = useRef(new Animated.Value(-bannerHeight)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(bannerY, {
      toValue: visible ? 0 : -bannerHeight,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, bannerHeight, bannerY]);

  useEffect(() => {
    // There's no real byte-level upload progress available from Supabase
    // Storage's client helper, so this is a deliberately simulated fill —
    // crawls toward 85% while the actual request is in flight, nudges
    // further once "processing", then snaps to 100% on success. On error it
    // just freezes wherever it was.
    if (phase === 'uploading') {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 0.85,
        duration: 4000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    } else if (phase === 'processing') {
      Animated.timing(progress, {
        toValue: 0.95,
        duration: 1200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    } else if (phase === 'success') {
      Animated.timing(progress, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [phase, progress]);

  const isError = phase === 'error';
  const isSuccess = phase === 'success';
  const label =
    phase === 'uploading'
      ? 'Uploading your shot…'
      : phase === 'processing'
      ? 'Almost there…'
      : isSuccess
      ? 'Posted!'
      : isError
      ? 'Upload failed — tap to retry'
      : '';

  return (
    <Animated.View
      style={[styles.uploadBanner, { height: bannerHeight, transform: [{ translateY: bannerY }] }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <TouchableOpacity
        style={styles.uploadBannerTouchable}
        activeOpacity={isError ? 0.8 : 1}
        disabled={!isError}
        onPress={onRetry}
      >
        <View style={[styles.uploadBannerRow, { paddingTop: insets.top }]}>
          <GolfBallMark fontFamily={ballFont} displayWidth={24} />
          {!isSuccess && !isError && <ActivityIndicator size="small" color={colors.white} />}
          <Text
            style={[
              styles.uploadBannerText,
              isSuccess && styles.uploadBannerTextSuccess,
              isError && styles.uploadBannerTextError,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.uploadBannerTrack}>
        <Animated.View
          style={[
            styles.uploadBannerFill,
            isError && styles.uploadBannerFillError,
            { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
    </Animated.View>
  );
}

// Full-frame preview of the picked video — autoplays muted on loop so the
// user can review their shot before posting, with a tap-to-pause toggle.
function VideoPreviewPlayer({ uri, onChangeMedia }) {
  const [playing, setPlaying] = useState(true);
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
  });

  useEffect(() => {
    if (playing) {
      player.play();
    } else {
      player.pause();
    }
  }, [playing, player]);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => setPlaying((prev) => !prev)}
      style={styles.photoPreview}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
      />
      {!playing && (
        <View style={styles.playButtonOverlay}>
          <Ionicons name="play" size={26} color={colors.white} />
        </View>
      )}
      <View style={styles.mutedBadge}>
        <Ionicons name="volume-mute" size={12} color={colors.white} />
      </View>
      <TouchableOpacity
        onPress={onChangeMedia}
        style={styles.changeMediaButton}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={styles.changeMediaButtonText}>Change</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const SEARCH_DEBOUNCE_MS = 400;
const MAX_VIDEO_DURATION_SECONDS = 60;

function isVideoTooLong(durationSeconds) {
  return typeof durationSeconds === 'number' && durationSeconds > MAX_VIDEO_DURATION_SECONDS;
}

function alertVideoTooLong() {
  Alert.alert('Video too long', `Videos must be under ${MAX_VIDEO_DURATION_SECONDS} seconds. Please choose a shorter clip.`);
}

// Web has no equivalent of expo-image-picker's asset.duration, so read it
// off a throwaway <video> element instead.
function getVideoDurationSecondsWeb(uri) {
  return new Promise((resolve, reject) => {
    const videoEl = document.createElement('video');
    videoEl.preload = 'metadata';
    videoEl.onloadedmetadata = () => resolve(videoEl.duration);
    videoEl.onerror = () => reject(new Error('Could not read video metadata'));
    videoEl.src = uri;
  });
}

export default function PostScreen({ navigation }) {
  const { user } = useAuth();
  const [courseQuery, setCourseQuery] = useState('');
  const [courseResults, setCourseResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [hasMultipleNines, setHasMultipleNines] = useState(false);
  const [compositeName, setCompositeName] = useState('');
  const [hole, setHole] = useState('');
  const [par, setPar] = useState('');
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState(null); // { uri, type: 'photo' | 'video' }
  const [posting, setPosting] = useState(false);
  // null | 'uploading' | 'processing' | 'success' | 'error' — drives the
  // UploadBanner below; null means it's hidden.
  const [uploadPhase, setUploadPhase] = useState(null);
  const searchTimer = useRef(null);
  const processingTimerRef = useRef(null);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

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

  // Toggling on narrows the hole picker from 1-18 down to 1-9 (see the Hole
  // label below) — if a hole beyond 9 was already picked it no longer fits
  // that range, so it's cleared rather than left silently invalid.
  function handleToggleMultipleNines() {
    setHasMultipleNines((prev) => {
      const next = !prev;
      if (!next) {
        setCompositeName('');
      } else if (hole && Number(hole) > 9) {
        setHole('');
      }
      return next;
    });
  }

  function handlePickMediaWeb() {
    // Created on demand rather than kept mounted: an <input type="file">
    // opens the native file/camera-roll picker on .click() whether or not
    // it's attached to the DOM, so there's nothing to render or clean up.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const uri = URL.createObjectURL(file);
      const type = file.type.startsWith('video') ? 'video' : 'photo';

      if (type === 'video') {
        try {
          const duration = await getVideoDurationSecondsWeb(uri);
          if (isVideoTooLong(duration)) {
            URL.revokeObjectURL(uri);
            alertVideoTooLong();
            return;
          }
        } catch (err) {
          console.error('Could not read video duration:', err);
        }
      }

      setMedia({ uri, type });
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
        quality: 1,
        videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const type = asset.type === 'video' ? 'video' : 'photo';
        // videoMaxDuration caps recording length, but check the result too
        // in case a platform doesn't enforce it.
        if (type === 'video' && isVideoTooLong(asset.duration != null ? asset.duration / 1000 : null)) {
          alertVideoTooLong();
          return;
        }
        setMedia({ uri: asset.uri, type });
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
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const type = asset.type === 'video' ? 'video' : 'photo';
        // Library picks aren't capped at selection time like camera
        // recordings are, so this is the only enforcement point for them.
        if (type === 'video' && isVideoTooLong(asset.duration != null ? asset.duration / 1000 : null)) {
          alertVideoTooLong();
          return;
        }
        setMedia({ uri: asset.uri, type });
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

  // golfcourseapi.com's search results never include usable coordinates, so
  // a freshly-selected (or free-typed) course almost always needs geocoding
  // here — doing it once at post creation means tapping this post's course
  // name later (see FeedScreen.handleCoursePress) can zoom straight to it
  // instead of geocoding on demand. Falls back to the course as-is (no
  // coordinates) if geocoding comes up empty; the post still saves either way.
  async function resolveCourseCoordinates(course) {
    if (courseHasValidCoordinates(course)) return course;
    try {
      // geocodeCourseCoordinates caches by id — a free-typed course (no real
      // golfcourseapi.com id) still needs one to key off of, just not one
      // that gets persisted as course_id.
      const cacheableCourse = course.id ? course : { ...course, id: `${course.name}-${course.state || ''}` };
      const coords = await geocodeCourseCoordinates(cacheableCourse);
      return coords ? { ...course, ...coords } : course;
    } catch (err) {
      console.error('Failed to geocode course for new post:', err);
      return course;
    }
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

    if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    setPosting(true);
    setUploadPhase('uploading');
    processingTimerRef.current = setTimeout(() => setUploadPhase('processing'), 2200);

    try {
      const course = await resolveCourseCoordinates(selectedCourse ?? { id: null, name: courseName });
      const post = await createPost({
        userId: user.id,
        course,
        hole: hole ? Number(hole) : null,
        par: par ? Number(par) : null,
        caption: caption.trim(),
        mediaUri: media.uri,
        mediaType: media.type,
        compositeName: hasMultipleNines ? compositeName.trim() || null : null,
      });

      clearTimeout(processingTimerRef.current);
      notifyFollowersOfPost(user.id, post.id, courseName).catch((err) =>
        console.error('Failed to notify followers of post:', err)
      );

      setCourseQuery('');
      setSelectedCourse(null);
      setHasMultipleNines(false);
      setCompositeName('');
      setHole('');
      setPar('');
      setCaption('');
      setMedia(null);

      setUploadPhase('success');
      hideTimerRef.current = setTimeout(() => {
        setUploadPhase(null);
        navigation.navigate('Tabs', { screen: 'Feed' });
      }, 1500);
    } catch (err) {
      console.error('Failed to create post:', err);
      clearTimeout(processingTimerRef.current);
      setUploadPhase('error');
      hideTimerRef.current = setTimeout(() => setUploadPhase(null), 3000);
    } finally {
      setPosting(false);
    }
  }

  function handleRetryUpload() {
    if (posting) return;
    handleSharePost();
  }

  // Only media is worth a confirmation — course/hole/caption are easy to
  // redo, but a picked photo or video is the one thing that'd be annoying
  // to lose to an accidental tap. web's RN Alert.alert doesn't block/return
  // a value the way window.confirm does, so web gets its own branch.
  const handleBack = () => {
    if (media) {
      if (Platform.OS === 'web') {
        if (!window.confirm('Discard this post? Your selected media will not be saved.')) return;
        setMedia(null);
        setCaption('');
        setSelectedCourse(null);
        setHole('');
        navigation.navigate('Feed');
      } else {
        Alert.alert(
          'Discard Post?',
          'You have a photo or video selected. Are you sure you want to go back?',
          [
            { text: 'Keep Editing', style: 'cancel' },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                setMedia(null);
                setCaption('');
                setSelectedCourse(null);
                setHole('');
                navigation.navigate('Feed');
              },
            },
          ]
        );
      }
      return;
    }
    navigation.navigate('Feed');
  };

  const insets = useSafeAreaInsets();
  const { height: screenHeight } = Dimensions.get('window');
  const previewHeight = screenHeight < 700 ? 260 : screenHeight < 800 ? 300 : 340;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header />

      <TouchableOpacity
        onPress={handleBack}
        style={[styles.backButton, { top: insets.top + 12 }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={22} color={colors.white} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New Hole Post</Text>

        <View style={[styles.photoUpload, { height: previewHeight }]}>
          {media ? (
            media.type === 'video' ? (
              <VideoPreviewPlayer uri={media.uri} onChangeMedia={handlePickMedia} />
            ) : (
              <View style={styles.photoPreview}>
                <Image
                  source={{ uri: media.uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  onPress={handlePickMedia}
                  style={styles.changeMediaButton}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.changeMediaButtonText}>Change</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <TouchableOpacity
              style={styles.emptyMediaTouchable}
              onPress={handlePickMedia}
              activeOpacity={0.85}
            >
              <Ionicons name="camera-outline" size={32} color={colors.muted} />
              <Text style={styles.photoUploadText}>Add photo or video</Text>
            </TouchableOpacity>
          )}
        </View>

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

        {courseQuery.trim().length > 0 && (
          <TouchableOpacity
            style={styles.compositeToggleRow}
            onPress={handleToggleMultipleNines}
            activeOpacity={0.7}
          >
            <Ionicons
              name={hasMultipleNines ? 'checkbox' : 'square-outline'}
              size={18}
              color={hasMultipleNines ? colors.red : colors.muted}
            />
            <Text style={styles.compositeToggleText}>This course has multiple nines</Text>
          </TouchableOpacity>
        )}

        {hasMultipleNines && (
          <>
            <Text style={styles.label}>Name of nine you played</Text>
            <TextInput
              style={styles.input}
              value={compositeName}
              onChangeText={setCompositeName}
              placeholder="e.g. Blue, Ridge, Trail, North, South"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
            />
          </>
        )}

        <Text style={styles.label}>{hasMultipleNines ? 'Hole (1–9)' : 'Hole'}</Text>
        <View style={styles.holePickerGrid}>
          {Array.from({ length: hasMultipleNines ? 9 : 18 }, (_, i) => i + 1).map((n) => {
            const selected = hole === String(n);
            return (
              <TouchableOpacity
                key={n}
                style={[styles.holePickerCell, selected && styles.holePickerCellSelected]}
                onPress={() => setHole(String(n))}
                activeOpacity={0.8}
              >
                <Text style={[styles.holePickerCellText, selected && styles.holePickerCellTextSelected]}>
                  {n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Par</Text>
        <TextInput
          style={styles.input}
          value={par}
          onChangeText={setPar}
          keyboardType="number-pad"
          placeholder="#"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Caption</Text>
        <MentionTextInput
          style={[styles.input, styles.captionInput]}
          value={caption}
          onChangeText={setCaption}
          currentUserId={user?.id}
          placeholder="Tell the story of this hole... use @ to tag someone"
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

      <UploadBanner visible={uploadPhase != null} phase={uploadPhase} onRetry={handleRetryUpload} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    // Must outrank uploadBanner's zIndex: 9999 — that banner is a full-width
    // overlay that sits at the same top-left spot while a post is
    // uploading/processing/erroring, and was swallowing taps meant for this
    // button.
    zIndex: 10000,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: colors.navy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  uploadBannerTouchable: {
    flex: 1,
  },
  uploadBannerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  uploadBannerText: {
    flex: 1,
    color: colors.white,
    fontSize: 13,
  },
  uploadBannerTextSuccess: {
    color: colors.brightGreen,
    fontWeight: '700',
  },
  uploadBannerTextError: {
    color: colors.red,
  },
  uploadBannerTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  uploadBannerFill: {
    height: 3,
    backgroundColor: colors.brightGreen,
  },
  uploadBannerFillError: {
    backgroundColor: colors.red,
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
  emptyMediaTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoUploadText: {
    color: colors.muted,
    marginTop: 8,
    fontSize: 13,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 14, 26, 0.35)',
  },
  mutedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  changeMediaButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  changeMediaButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
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
  compositeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  compositeToggleText: {
    color: colors.offWhite,
    fontSize: 13,
    fontWeight: '600',
  },
  holePickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  holePickerCell: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holePickerCellSelected: {
    borderColor: colors.red,
    backgroundColor: colors.navyLight,
  },
  holePickerCellText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  holePickerCellTextSelected: {
    color: colors.red,
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
