import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import colors from '../theme/colors';
import { wantToPlay } from '../data/mockData';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import HandicapInputModal from '../components/profile/HandicapInputModal';
import CourseRankingModal from '../components/profile/CourseRankingModal';
import { uploadAvatar } from '../services/profiles';
import { getCourseRankings, addCourseRanking, updateCourseRanking } from '../services/courseRankings';
import { getUserPosts } from '../services/posts';

const TABS = ['Course Rankings', 'Want to Play', 'Uploads'];

function RankingsList({ rankings, loading, onUpdate, onAdd }) {
  return (
    <View>
      <TouchableOpacity style={styles.addRankingButton} onPress={onAdd} activeOpacity={0.8}>
        <Ionicons name="add" size={16} color={colors.white} />
        <Text style={styles.addRankingButtonText}>Add Courses</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={colors.red} style={{ marginTop: 16 }} />
      ) : rankings.length === 0 ? (
        <Text style={styles.emptyText}>You haven't ranked any courses yet.</Text>
      ) : (
        rankings.map((item, index) => (
          <View key={item.id} style={styles.listRow}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>{index + 1}</Text>
            </View>
            <Text style={styles.listRowTitle} numberOfLines={1}>
              {item.courseName}
            </Text>
            <Text style={styles.listRowRating}>{item.rating.toFixed(1)}</Text>
            <TouchableOpacity style={styles.updateButton} onPress={() => onUpdate(item)} hitSlop={8}>
              <Text style={styles.updateButtonText}>Update</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

function WantToPlayList() {
  return (
    <View>
      {wantToPlay.map((item) => (
        <View key={item.id} style={styles.listRow}>
          <Ionicons name="flag-outline" size={18} color={colors.red} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.listRowTitle}>{item.name}</Text>
            <Text style={styles.listRowSubtitle}>{item.location}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function UploadsGrid({ posts, loading }) {
  if (loading) {
    return <ActivityIndicator color={colors.red} style={{ marginTop: 16 }} />;
  }
  if (posts.length === 0) {
    return <Text style={styles.emptyText}>No posts yet — share your first hole to see it here.</Text>;
  }
  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      numColumns={3}
      scrollEnabled={false}
      columnWrapperStyle={{ gap: 8 }}
      contentContainerStyle={{ gap: 8 }}
      renderItem={({ item }) => (
        <View style={styles.uploadTile}>
          <Image source={{ uri: item.mediaUrl }} style={styles.uploadTileImage} resizeMode="cover" />
          {item.isVideo && (
            <View style={styles.uploadPlayBadge}>
              <Ionicons name="play" size={10} color={colors.white} />
            </View>
          )}
        </View>
      )}
    />
  );
}

function handleOpenSettings() {
  // Settings screen doesn't exist yet.
  Alert.alert('Settings', 'App settings are coming soon.');
}

// AuthContext's onAuthStateChange listener swaps in the auth stack once the
// session clears, so signOut() alone is enough to redirect to sign-up.
async function handleLogout() {
  console.log('Logout pressed');
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
      Alert.alert('Error logging out', error.message);
    } else {
      console.log('Logged out successfully');
    }
  } catch (err) {
    console.error('Unexpected logout error:', err);
    Alert.alert('Unexpected error', err.message);
  }
}

export default function ProfileScreen({ navigation }) {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [handicapModalVisible, setHandicapModalVisible] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [rankings, setRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(true);
  const [rankingModalVisible, setRankingModalVisible] = useState(false);
  const [editingRanking, setEditingRanking] = useState(null);
  const [uploadPosts, setUploadPosts] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(true);

  const loadRankings = useCallback(async () => {
    if (!user?.id) return;
    setRankingsLoading(true);
    try {
      setRankings(await getCourseRankings(user.id));
    } catch (err) {
      console.error('Failed to load course rankings:', err);
    } finally {
      setRankingsLoading(false);
    }
  }, [user?.id]);

  const loadUploads = useCallback(async () => {
    if (!user?.id) return;
    setUploadsLoading(true);
    try {
      setUploadPosts(await getUserPosts(user.id));
    } catch (err) {
      console.error('Failed to load uploads:', err);
    } finally {
      setUploadsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadRankings();
  }, [loadRankings]);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  async function handlePickAvatar() {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to set a profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.[0]?.uri || !user?.id) return;

      setAvatarUploading(true);
      const avatarUrl = await uploadAvatar(user.id, result.assets[0].uri);
      const updated = await updateProfile({ avatarUrl });
      setProfileData((prev) => (prev ? { ...prev, avatar_url: updated.avatar_url } : updated));
    } catch (err) {
      console.error('Failed to update profile photo:', err);
      Alert.alert('Something went wrong', 'Could not update your profile photo. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }

  function handleOpenAddRanking() {
    setEditingRanking(null);
    setRankingModalVisible(true);
  }

  function handleOpenUpdateRanking(ranking) {
    setEditingRanking(ranking);
    setRankingModalVisible(true);
  }

  async function handleSaveRanking({ courseId, courseName, rating }) {
    if (!user?.id) return;
    if (editingRanking) {
      const updated = await updateCourseRanking(editingRanking.id, { courseName, rating });
      setRankings((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)).sort((a, b) => b.rating - a.rating)
      );
    } else {
      const created = await addCourseRanking(user.id, { courseId, courseName, rating });
      setRankings((prev) => [...prev, created].sort((a, b) => b.rating - a.rating));
    }
    setRankingModalVisible(false);
  }

  const loadProfileData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          setProfileData(null);
          setNotFound(true);
        } else {
          throw profileError;
        }
      } else {
        setProfileData(profileRow);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError("We couldn't load your profile.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleSaveHandicap = useCallback(
    async (value) => {
      const updated = await updateProfile({ handicapIndex: value });
      setProfileData((prev) => (prev ? { ...prev, handicap_index: updated.handicap_index } : updated));
    },
    [updateProfile]
  );

  return (
    <View style={styles.screen}>
      <Header
        right={
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleOpenSettings} hitSlop={10} style={styles.headerActionButton}>
              <Ionicons name="settings-outline" size={22} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              style={{ padding: 10, backgroundColor: '#c0001a', borderRadius: 8 }}
            >
              <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>Log Out</Text>
            </TouchableOpacity>
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <TouchableOpacity style={styles.avatarRing} onPress={handlePickAvatar} activeOpacity={0.85}>
            <View style={styles.avatar}>
              {avatarUploading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : profileData?.avatar_url ? (
                <Image source={{ uri: profileData.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="camera-outline" size={26} color={colors.muted} />
              )}
            </View>
            <View style={styles.avatarCameraBadge}>
              <Ionicons name="camera" size={13} color={colors.white} />
            </View>
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator color={colors.red} size="large" style={styles.stateSpacing} />
          ) : error ? (
            <View style={styles.stateSpacing}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={loadProfileData} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : notFound ? (
            <View style={styles.stateSpacing}>
              <Text style={styles.name}>Golfer</Text>
              <Text style={styles.emptyText}>
                Finish setting up your profile to see your info here.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.name}>{profileData?.full_name || 'Unnamed Golfer'}</Text>
              <Text style={styles.handle}>
                {profileData?.username ? `@${profileData.username}` : ''}
              </Text>
              {profileData?.home_state && (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={14} color={colors.muted} />
                  <Text style={styles.locationText}>{profileData.home_state}</Text>
                </View>
              )}

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>128</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>1.4k</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>312</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
              </View>

              <View style={styles.handicapBox}>
                <Ionicons name="golf-outline" size={20} color={colors.red} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.handicapValue}>
                    {profileData?.handicap_index != null ? profileData.handicap_index : 'Not set'}
                  </Text>
                  <Text style={styles.handicapLabel}>Handicap Index</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setHandicapModalVisible(true)}
                  hitSlop={10}
                  style={styles.editHandicapButton}
                >
                  <Ionicons name="pencil-outline" size={16} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.scorecardsButton}
                onPress={() =>
                  navigation.navigate('UserScorecards', {
                    userId: user.id,
                    displayName: profileData?.full_name || 'Golfer',
                  })
                }
                activeOpacity={0.85}
              >
                <Ionicons name="reader-outline" size={16} color={colors.white} />
                <Text style={styles.scorecardsButtonText}>Scorecards</Text>
              </TouchableOpacity>

              <HandicapInputModal
                visible={handicapModalVisible}
                onClose={() => setHandicapModalVisible(false)}
                onSubmit={handleSaveHandicap}
              />
            </>
          )}
        </View>

        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={styles.tabButton}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
              {activeTab === tab && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'Course Rankings' && (
            <RankingsList
              rankings={rankings}
              loading={rankingsLoading}
              onUpdate={handleOpenUpdateRanking}
              onAdd={handleOpenAddRanking}
            />
          )}
          {activeTab === 'Want to Play' && <WantToPlayList />}
          {activeTab === 'Uploads' && <UploadsGrid posts={uploadPosts} loading={uploadsLoading} />}
        </View>
      </ScrollView>

      <CourseRankingModal
        visible={rankingModalVisible}
        initialRanking={editingRanking}
        onClose={() => setRankingModalVisible(false)}
        onSave={handleSaveRanking}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    marginLeft: 16,
  },
  content: {
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.navy,
  },
  name: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  handle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  locationText: {
    color: colors.muted,
    fontSize: 12,
    marginLeft: 4,
  },
  stateSpacing: {
    marginVertical: 20,
    alignItems: 'center',
  },
  errorText: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 12,
    marginBottom: 18,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  handicapBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    width: '100%',
  },
  handicapValue: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  handicapLabel: {
    color: colors.muted,
    fontSize: 11,
  },
  scorecardsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
    marginTop: 12,
  },
  scorecardsButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  editHandicapButton: {
    padding: 6,
    marginLeft: 8,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabTextActive: {
    color: colors.white,
  },
  tabIndicator: {
    marginTop: 8,
    height: 3,
    width: '60%',
    backgroundColor: colors.red,
    borderRadius: 2,
  },
  tabContent: {
    padding: 16,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankBadgeText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 12,
  },
  listRowTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  listRowSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  listRowRating: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 14,
    marginRight: 10,
  },
  updateButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  updateButtonText: {
    color: colors.offWhite,
    fontSize: 11,
    fontWeight: '700',
  },
  addRankingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 14,
  },
  addRankingButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  uploadTile: {
    flex: 1 / 3,
    aspectRatio: 1,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 10,
    overflow: 'hidden',
  },
  uploadTileImage: {
    ...StyleSheet.absoluteFillObject,
  },
  uploadPlayBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
