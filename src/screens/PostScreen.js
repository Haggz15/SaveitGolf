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
  Modal,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import Header from '../components/Header';
import MentionTextInput from '../components/social/MentionTextInput';
import GolfBallMark, { useGolfBallFont } from '../components/common/GolfBallMark';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { createPost, getUserPosts } from '../services/posts';
import { searchCourses, submitNewCourse } from '../services/golfCourseApi';
import { addCourseFromPost } from '../services/myCourses';
import { searchProfiles } from '../services/social';
import { MENTION_RE } from '../services/mentions';
import { notifyFollowersOfPost } from '../services/notifications';
import { geocodeCourseCoordinates } from '../services/geocoding';
import { courseHasValidCoordinates } from '../utils/mapCoords';
import { compressImage } from '../utils/imageCompression';

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
function UploadBanner({ visible, phase, retryAttempt, onRetry }) {
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
    if (phase === 'optimizing') {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 0.4,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    } else if (phase === 'uploading') {
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
    phase === 'optimizing'
      ? 'Optimizing…'
      : phase === 'uploading'
      ? retryAttempt > 0
        ? `Upload failed — retrying (attempt ${retryAttempt + 1})…`
        : 'Uploading your shot… (this may take a moment for videos)'
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
const MAX_VIDEO_DURATION_SECONDS = 30;
const LARGE_VIDEO_WARNING_BYTES = 50 * 1024 * 1024;

function isVideoTooLong(durationSeconds) {
  return typeof durationSeconds === 'number' && durationSeconds > MAX_VIDEO_DURATION_SECONDS;
}

function alertVideoTooLong() {
  Alert.alert('Video too long', `Videos must be under ${MAX_VIDEO_DURATION_SECONDS} seconds. Please choose a shorter clip.`);
}

// Resolves to false only when the user explicitly backs out of a
// large-video warning — every other case (no known size, size under the
// threshold, or the user confirming) resolves true so the picker flow can
// proceed unchanged.
function confirmLargeVideo(fileSize) {
  if (!fileSize || fileSize <= LARGE_VIDEO_WARNING_BYTES) return Promise.resolve(true);

  const message = 'This video is large and may take a while to upload. Make sure you have a good connection.';
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`Large Video\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert('Large Video', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Upload Anyway', onPress: () => resolve(true) },
    ]);
  });
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
  const [frequentCourses, setFrequentCourses] = useState([]);
  const [hasMultipleNines, setHasMultipleNines] = useState(false);
  const [compositeName, setCompositeName] = useState('');
  const [subCourseName, setSubCourseName] = useState('');
  const [hole, setHole] = useState('');
  const [par, setPar] = useState('');
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState(null); // { uri, type: 'photo' | 'video' }
  const [posting, setPosting] = useState(false);
  // null | 'uploading' | 'processing' | 'success' | 'error' — drives the
  // UploadBanner below; null means it's hidden.
  const [uploadPhase, setUploadPhase] = useState(null);
  const [uploadRetryAttempt, setUploadRetryAttempt] = useState(0);
  const [showTagSearch, setShowTagSearch] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [tagSearchResults, setTagSearchResults] = useState([]);
  const [tagSearching, setTagSearching] = useState(false);
  const searchTimer = useRef(null);
  const tagSearchTimer = useRef(null);
  const processingTimerRef = useRef(null);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (tagSearchTimer.current) clearTimeout(tagSearchTimer.current);
    };
  }, []);

  // Quick-select shortcuts shown above the course search before the user
  // types anything — the courses this user posts to most, so a repeat round
  // at the same course doesn't need a full search every time.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getUserPosts(user.id)
      .then((userPosts) => {
        if (cancelled) return;
        const byCourse = new Map();
        userPosts.forEach((p) => {
          if (!p.course) return;
          const existing = byCourse.get(p.course);
          if (existing) {
            existing.count += 1;
          } else {
            byCourse.set(p.course, { id: p.courseId ?? null, name: p.course, city: p.city, state: p.state, count: 1 });
          }
        });
        const sorted = [...byCourse.values()].sort((a, b) => b.count - a.count).slice(0, 5);
        setFrequentCourses(sorted);
      })
      .catch((err) => console.error('Failed to load frequent courses:', err));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function handleSelectFrequentCourse(course) {
    setCourseQuery(course.name);
    setSelectedCourse({ id: course.id, name: course.name, city: course.city, state: course.state });
    setCourseResults([]);
    Keyboard.dismiss();
  }

  // Usernames currently @mentioned in the caption — the single source of
  // truth for who's tagged, whether they got there by typing "@" directly
  // (MentionTextInput's own dropdown) or via the Tag Friends picker below.
  // Reusing this instead of a separate taggedUsers array means createPost's
  // existing mention-resolution pipeline (post_tags + notifications) needs
  // no changes to support the picker.
  const taggedUsernames = [...new Set([...caption.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase()))];

  function handleTagSearchChange(text) {
    setTagSearchQuery(text);
    if (tagSearchTimer.current) clearTimeout(tagSearchTimer.current);

    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setTagSearchResults([]);
      setTagSearching(false);
      return;
    }

    setTagSearching(true);
    tagSearchTimer.current = setTimeout(async () => {
      try {
        const results = await searchProfiles(trimmed, user?.id);
        setTagSearchResults(results);
      } catch (err) {
        console.error('Failed to search golfers to tag:', err);
        setTagSearchResults([]);
      } finally {
        setTagSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleCloseTagSearch() {
    setShowTagSearch(false);
    setTagSearchQuery('');
    setTagSearchResults([]);
  }

  function handleToggleTagUser(profile) {
    const username = profile.username;
    if (!username) return;
    const isTagged = taggedUsernames.includes(username.toLowerCase());
    if (isTagged) {
      setCaption((prev) => prev.replace(new RegExp(`@${username}\\b\\s?`, 'i'), '').trimEnd());
    } else {
      setCaption((prev) => (prev.length > 0 && !/\s$/.test(prev) ? `${prev} @${username} ` : `${prev}@${username} `));
    }
  }

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
    Keyboard.dismiss();
  };

  // Course search came up empty and the user wants to post anyway — treated
  // the same as picking a real search result (closes the dropdown, shows the
  // typed name as "selected"), except with no id, so createPost stamps
  // manual_entry: true and this course also gets submitted to
  // golfcourseapi.com in handleSharePost below so it's findable for everyone
  // once it's added for real.
  const handleUseManualCourse = () => {
    const name = courseQuery.trim();
    if (!name) return;
    setSelectedCourse({ id: null, name, city: null, state: null });
    setCourseResults([]);
    Keyboard.dismiss();
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

  // Fix 1: every photo gets downsized/recompressed before it's used
  // anywhere further (preview or upload) — videos are left untouched (Fix
  // 2 handles those via the picker's own quality/bitrate setting instead).
  // Briefly flips the upload banner to 'optimizing' for the duration, same
  // as the 'uploading'/'processing' phases handleSharePost drives later.
  async function setMediaFromPick(uri, type) {
    if (type !== 'photo') {
      setMedia({ uri, type });
      return;
    }
    setUploadPhase('optimizing');
    try {
      const compressedUri = await compressImage(uri);
      setMedia({ uri: compressedUri, type });
    } finally {
      setUploadPhase(null);
    }
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
        if (!(await confirmLargeVideo(file.size))) {
          URL.revokeObjectURL(uri);
          return;
        }
      }

      await setMediaFromPick(uri, type);
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
        quality: 0.8, // for photos this is JPEG quality; for videos it controls bitrate, not resolution
        videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
        exif: false,
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
        if (type === 'video' && !(await confirmLargeVideo(asset.fileSize))) {
          return;
        }
        await setMediaFromPick(asset.uri, type);
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
        quality: 0.8, // for photos this is JPEG quality; for videos it controls bitrate, not resolution
        videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
        exif: false,
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
        if (type === 'video' && !(await confirmLargeVideo(asset.fileSize))) {
          return;
        }
        await setMediaFromPick(asset.uri, type);
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
    setUploadRetryAttempt(0);
    processingTimerRef.current = setTimeout(() => setUploadPhase('processing'), 2200);

    try {
      const course = await resolveCourseCoordinates(selectedCourse ?? { id: null, name: courseName });

      // No golfcourseapi.com id means this course was typed by hand (search
      // came up empty — see the "Post to..." button above) rather than
      // picked from a result. The post itself never waits on this: it's
      // submitted to golfcourseapi.com fire-and-forget, same as
      // ProfileScreen.handleAddManualCourse, so the course becomes findable
      // for everyone once it's added for real — a failure here is only ever
      // logged.
      if (!course.id) {
        submitNewCourse({ name: course.name, city: course.city, state: course.state, lat: course.lat, lng: course.lng })
          .then((result) => console.log('[golfcourseapi] submitted manually-typed course from post:', result))
          .catch((err) => console.error('[golfcourseapi] failed to submit manually-typed course from post:', err.message));
      }

      const post = await createPost({
        userId: user.id,
        course,
        hole: hole ? Number(hole) : null,
        par: par ? Number(par) : null,
        caption: caption.trim(),
        mediaUri: media.uri,
        mediaType: media.type,
        compositeName: hasMultipleNines ? compositeName.trim() || null : null,
        subCourseName: subCourseName.trim() || null,
        onUploadRetry: setUploadRetryAttempt,
      });

      clearTimeout(processingTimerRef.current);
      notifyFollowersOfPost(user.id, post.id, courseName).catch((err) =>
        console.error('Failed to notify followers of post:', err)
      );
      addCourseFromPost(user.id, course).catch((err) =>
        console.error('Failed to add course to Courses Played:', err)
      );

      setCourseQuery('');
      setSelectedCourse(null);
      setHasMultipleNines(false);
      setCompositeName('');
      setSubCourseName('');
      setHole('');
      setPar('');
      setCaption('');
      setMedia(null);

      setUploadPhase('success');
      hideTimerRef.current = setTimeout(() => {
        setUploadPhase(null);
        navigation.navigate('Tabs', { screen: 'Following' });
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
        navigation.navigate('Following');
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
                navigation.navigate('Following');
              },
            },
          ]
        );
      }
      return;
    }
    navigation.navigate('Following');
  };

  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isTablet = Platform.isPad || screenWidth >= 768;
  // iPad screens are much taller than any phone, so the phone breakpoints
  // below would otherwise cap the preview at a tiny 340pt box — give
  // tablets a preview that scales with the available height instead.
  const previewHeight = isTablet
    ? Math.min(520, screenHeight * 0.4)
    : screenHeight < 700
    ? 260
    : screenHeight < 800
    ? 300
    : 340;

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

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isTablet && { paddingHorizontal: Math.max(20, (screenWidth - 600) / 2) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
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
        <Text style={styles.mediaLimitText}>Photos and videos up to {MAX_VIDEO_DURATION_SECONDS} seconds</Text>

        <Text style={styles.label}>Course</Text>
        <TextInput
          style={styles.input}
          value={courseQuery}
          onChangeText={handleChangeCourseQuery}
          placeholder="e.g. Pebble Beach Golf Links"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
        />
        {frequentCourses.length > 0 && courseQuery.trim().length === 0 && !selectedCourse && (
          <View style={styles.frequentCourses}>
            <Text style={styles.frequentCoursesLabel}>Your Courses</Text>
            {frequentCourses.map((course) => (
              <TouchableOpacity
                key={course.name}
                style={styles.resultRow}
                onPress={() => handleSelectFrequentCourse(course)}
              >
                <Ionicons name="flag-outline" size={16} color={colors.red} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.resultName} numberOfLines={1}>{course.name}</Text>
                  <Text style={styles.resultLocation}>
                    {course.count} post{course.count !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        {courseQuery.trim().length >= 2 && !selectedCourse && (
          <View style={styles.dropdown}>
            {searching ? (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={colors.red} />
                <Text style={styles.statusText}>Searching…</Text>
              </View>
            ) : courseResults.length === 0 ? (
              <View style={styles.noMatchBox}>
                <Text style={styles.statusText}>
                  Course not found in our database — post anyway and we will add it
                </Text>
                <TouchableOpacity style={styles.noMatchButton} onPress={handleUseManualCourse} activeOpacity={0.85}>
                  <Text style={styles.noMatchButtonText}>Post to {courseQuery.trim()}</Text>
                </TouchableOpacity>
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

        {courseQuery.trim().length > 0 && (
          <>
            <Text style={styles.label}>Specific Course (optional)</Text>
            <TextInput
              style={styles.input}
              value={subCourseName}
              onChangeText={setSubCourseName}
              placeholder="For clubs with multiple courses, e.g. Stadium Course"
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

        <TouchableOpacity style={styles.tagButton} onPress={() => setShowTagSearch(true)} activeOpacity={0.8}>
          <Ionicons name="person-add-outline" size={16} color={colors.muted} />
          <Text style={styles.tagButtonText} numberOfLines={1}>
            {taggedUsernames.length > 0
              ? `Tagged: ${taggedUsernames.map((name) => `@${name}`).join(', ')}`
              : 'Tag Friends'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.copyrightNotice}>
          By posting you confirm this content is your own and does not
          contain copyrighted music or material you do not have rights to use.
        </Text>

        <TouchableOpacity
          style={[styles.submitButton, posting && styles.submitButtonDisabled]}
          onPress={handleSharePost}
          disabled={posting}
        >
          <Text style={styles.submitButtonText}>{posting ? 'Posting…' : 'Share Post'}</Text>
        </TouchableOpacity>
      </ScrollView>

      <UploadBanner
        visible={uploadPhase != null}
        phase={uploadPhase}
        retryAttempt={uploadRetryAttempt}
        onRetry={handleRetryUpload}
      />

      <Modal visible={showTagSearch} animationType="slide" onRequestClose={handleCloseTagSearch}>
        <View style={[styles.tagModal, { paddingTop: insets.top }]}>
          <View style={styles.tagModalHeader}>
            <TextInput
              autoFocus
              value={tagSearchQuery}
              onChangeText={handleTagSearchChange}
              placeholder="Search golfers to tag..."
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              style={styles.tagModalInput}
            />
            <TouchableOpacity onPress={handleCloseTagSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.tagModalDone}>Done</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={tagSearchResults}
            keyExtractor={(item) => item.user_id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              tagSearching ? (
                <View style={styles.statusRow}>
                  <ActivityIndicator size="small" color={colors.red} />
                  <Text style={styles.statusText}>Searching…</Text>
                </View>
              ) : (
                <View style={styles.statusRow}>
                  <Text style={styles.statusText}>
                    {tagSearchQuery.trim().length > 1 ? 'No golfers found' : 'Search for golfers to tag'}
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const isTagged = taggedUsernames.includes((item.username || '').toLowerCase());
              return (
                <TouchableOpacity
                  onPress={() => handleToggleTagUser(item)}
                  style={[styles.tagResultRow, isTagged && styles.tagResultRowTagged]}
                >
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.tagResultAvatar} />
                  ) : (
                    <Ionicons name="person-circle-outline" size={44} color={colors.muted} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tagResultName} numberOfLines={1}>
                      {item.full_name || item.username}
                    </Text>
                    <Text style={styles.tagResultUsername} numberOfLines={1}>@{item.username}</Text>
                  </View>
                  <View style={[styles.tagCheck, isTagged && styles.tagCheckActive]}>
                    <Text style={[styles.tagCheckText, isTagged && styles.tagCheckTextActive]}>
                      {isTagged ? '✓' : '+'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
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
  mediaLimitText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  copyrightNotice: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
    lineHeight: 15,
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
  frequentCourses: {
    marginTop: -10,
    marginBottom: 16,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    overflow: 'hidden',
  },
  frequentCoursesLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
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
  noMatchBox: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  noMatchButton: {
    backgroundColor: colors.red,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  noMatchButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
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
  tagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: colors.navyCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  tagButtonText: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
  },
  tagModal: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  tagModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  tagModalInput: {
    flex: 1,
    backgroundColor: colors.navyCard,
    borderRadius: 10,
    padding: 12,
    color: colors.white,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  tagModalDone: {
    color: colors.brightGreen,
    fontSize: 14,
    fontWeight: '700',
  },
  tagResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  tagResultRowTagged: {
    backgroundColor: 'rgba(77,216,96,0.1)',
  },
  tagResultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.navyCard,
  },
  tagResultName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  tagResultUsername: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  tagCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagCheckActive: {
    backgroundColor: colors.brightGreen,
  },
  tagCheckText: {
    color: colors.white,
    fontSize: 14,
  },
  tagCheckTextActive: {
    color: colors.brightGreenText,
  },
});
