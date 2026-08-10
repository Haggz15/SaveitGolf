import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

function getInitials(name) {
  if (!name) return '?';
  return name.trim().slice(0, 1).toUpperCase();
}

function MentionAvatar({ avatarUrl, name }) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
    </View>
  );
}

// Floating "@" suggestion list shared by every tagging entry point (post
// caption, comments). Each row shows avatar + username + full name;
// selecting one hands the whole profile row back to `onSelect`.
export default function MentionDropdown({ results, onSelect, style }) {
  if (!results?.length) return null;

  return (
    <View style={[styles.dropdown, style]}>
      {results.map((item) => (
        <TouchableOpacity
          key={item.user_id}
          style={styles.row}
          onPress={() => onSelect(item)}
          activeOpacity={0.7}
        >
          <MentionAvatar avatarUrl={item.avatar_url} name={item.full_name || item.username} />
          <View style={styles.textWrap}>
            <Text style={styles.username} numberOfLines={1}>
              @{item.username}
            </Text>
            {item.full_name ? (
              <Text style={styles.fullName} numberOfLines={1}>
                {item.full_name}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    backgroundColor: '#1a2e4a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontSize: 11,
    fontWeight: '700',
  },
  textWrap: {
    flex: 1,
  },
  username: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  fullName: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 1,
  },
});
