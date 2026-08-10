import { useEffect, useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import colors from '../../theme/colors';
import MentionDropdown from './MentionDropdown';
import { getTrailingMentionQuery, insertMention, searchMentionCandidates } from '../../services/mentions';

const SEARCH_DEBOUNCE_MS = 250;
// Selecting a dropdown row blurs the TextInput first; delaying the
// close-on-blur just long enough lets that row's onPress still land before
// the dropdown unmounts out from under it.
const BLUR_CLOSE_DELAY_MS = 150;

// Drop-in replacement for a plain <TextInput> that opens a floating @mention
// dropdown above itself while typing — used by both the post caption field
// and the comment input so tagging behaves identically everywhere.
export default function MentionTextInput({
  value,
  onChangeText,
  currentUserId,
  style,
  containerStyle,
  dropdownStyle,
  placeholder,
  placeholderTextColor = colors.muted,
  multiline,
  ...rest
}) {
  const [mentionResults, setMentionResults] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceTimer = useRef(null);
  const blurTimer = useRef(null);

  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    []
  );

  function closeDropdown() {
    setDropdownOpen(false);
    setMentionResults([]);
  }

  function handleChangeText(text) {
    onChangeText(text);
    const query = getTrailingMentionQuery(text);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (query === null) {
      closeDropdown();
      return;
    }

    setDropdownOpen(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await searchMentionCandidates(query, currentUserId);
        setMentionResults(results);
      } catch (err) {
        setMentionResults([]);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleSelect(profile) {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    onChangeText(insertMention(value, profile.username));
    closeDropdown();
  }

  function handleBlur() {
    blurTimer.current = setTimeout(closeDropdown, BLUR_CLOSE_DELAY_MS);
  }

  function handleKeyPress(e) {
    // Only meaningful on web/RNW, where a physical Escape key exists.
    if (Platform.OS === 'web' && e.nativeEvent.key === 'Escape') {
      closeDropdown();
    }
  }

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {dropdownOpen && mentionResults.length > 0 && (
        <MentionDropdown results={mentionResults} onSelect={handleSelect} style={[styles.dropdownPosition, dropdownStyle]} />
      )}
      <TextInput
        style={style}
        value={value}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        multiline={multiline}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  dropdownPosition: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    marginBottom: 6,
    maxHeight: 220,
    zIndex: 20,
  },
});
