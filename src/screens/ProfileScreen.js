import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import colors from '../theme/colors';
import { courseRankings, wantToPlay, uploads } from '../data/mockData';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import HandicapInputModal from '../components/profile/HandicapInputModal';

const TABS = ['Course Rankings', 'Want to Play', 'Uploads'];

function getInitials(fullName) {
  if (!fullName) return '';
  return fullName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function RankingsList() {
  return (
    <View>
      {courseRankings.map((item) => (
        <View key={item.id} style={styles.listRow}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>{item.rank}</Text>
          </View>
          <Text style={styles.listRowTitle}>{item.name}</Text>
          <Text style={styles.listRowRating}>{item.rating}</Text>
        </View>
      ))}
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

function UploadsGrid() {
  return (
    <FlatList
      data={uploads}
      keyExtractor={(item) => item.id}
      numColumns={3}
      scrollEnabled={false}
      columnWrapperStyle={{ gap: 8 }}
      contentContainerStyle={{ gap: 8 }}
      renderItem={({ item }) => (
        <View style={styles.uploadTile}>
          <Ionicons name="image-outline" size={24} color={colors.muted} />
          <Text style={styles.uploadTileText}>{item.course}</Text>
          <Text style={styles.uploadTileHole}>Hole {item.hole}</Text>
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

export default function ProfileScreen() {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [handicapModalVisible, setHandicapModalVisible] = useState(false);

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
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              {!loading && profileData?.full_name && (
                <Text style={styles.avatarInitials}>{getInitials(profileData.full_name)}</Text>
              )}
            </View>
          </View>

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
          {activeTab === 'Course Rankings' && <RankingsList />}
          {activeTab === 'Want to Play' && <WantToPlayList />}
          {activeTab === 'Uploads' && <UploadsGrid />}
        </View>
      </ScrollView>
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
  },
  avatarInitials: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '700',
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
  },
  uploadTile: {
    flex: 1 / 3,
    aspectRatio: 1,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  uploadTileText: {
    color: colors.offWhite,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  uploadTileHole: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 2,
  },
});
