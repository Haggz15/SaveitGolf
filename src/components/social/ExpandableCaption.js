import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MentionText from './MentionText';

const COLLAPSED_LINES = 3;
// Characters trimmed off the end of the last visible line to make room for
// "… more" on that same line. Slightly more than the suffix itself, since a
// proportional font's wide letters can otherwise push "more" onto line 4.
const SUFFIX_ROOM = 10;

// A post caption that shows its first three lines with an inline "more" link,
// expanding in place to the full text with a "less" link to collapse it again.
//
// The line count comes from an invisible, unclamped copy of the caption laid
// out at the same width: onTextLayout on a numberOfLines-clamped <Text> isn't
// consistent across iOS and Android about whether it reports the hidden lines.
// The visible collapsed text is then the first three measured lines, trimmed
// to fit "… more" — real truncation rather than an ellipsis we can't attach a
// tap target to.
export default function ExpandableCaption({ text, style, linkStyle, onMentionPress }) {
  const [lines, setLines] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const handleMeasure = useCallback((e) => {
    setLines(e.nativeEvent.lines.map((line) => line.text));
  }, []);

  const caption = text || '';
  const overflows = lines !== null && lines.length > COLLAPSED_LINES;

  let body;
  if (!overflows) {
    // Short caption (or not measured yet): the clamp only matters for the
    // first frame before measurement lands.
    body = (
      <MentionText text={caption} style={style} numberOfLines={COLLAPSED_LINES} onMentionPress={onMentionPress} />
    );
  } else if (expanded) {
    body = (
      <MentionText text={caption} style={style} onMentionPress={onMentionPress}>
        {'  '}
        <Text style={[styles.link, linkStyle]} suppressHighlighting onPress={() => setExpanded(false)}>
          less
        </Text>
      </MentionText>
    );
  } else {
    const visible = lines.slice(0, COLLAPSED_LINES).join('');
    const truncated = visible.slice(0, Math.max(0, visible.length - SUFFIX_ROOM)).trimEnd();
    body = (
      // numberOfLines stays as a guard so an unlucky width can never spill
      // the caption past three lines.
      <MentionText text={truncated} style={style} numberOfLines={COLLAPSED_LINES} onMentionPress={onMentionPress}>
        {'… '}
        <Text style={[styles.link, linkStyle]} suppressHighlighting onPress={() => setExpanded(true)}>
          more
        </Text>
      </MentionText>
    );
  }

  return (
    <View>
      <Text style={[style, styles.measure]} onTextLayout={handleMeasure} aria-hidden importantForAccessibility="no-hide-descendants">
        {caption}
      </Text>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
  link: {
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.75)',
  },
});
