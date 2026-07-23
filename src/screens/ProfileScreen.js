import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import colors from '../theme/colors';
import { courseRankings, wantToPlay, uploads } from '../data/mockData';

const TABS = ['Course Rankings', 'Want to Play', 'Uploads'];

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

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState(TABS[0]);

  return (
    <View style={styles.screen}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar} />
          </View>
          <Text style={styles.name}>Owen Haggerty</Text>
          <Text style={styles.handle}>@owenhgolf</Text>

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
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.handicapValue}>6.2</Text>
              <Text style={styles.handicapLabel}>Handicap Index</Text>
            </View>
          </View>
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
    marginBottom: 18,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
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
