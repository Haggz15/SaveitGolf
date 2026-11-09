import { Text } from 'react-native';

const MENTION_SPLIT_RE = /(@\w+)/g;
const MENTION_COLOR = '#4a9eff';

// Renders free text (a post caption or comment) with @mentions highlighted
// and tappable. Splitting on a capturing group puts every mention at an odd
// index — cheaper and safer than re-testing each part against the regex
// (a global regex's .test() mutates lastIndex, which misfires on repeated
// calls across a single render).
// `children` render after the caption inside the same <Text>, so a trailing
// link (ExpandableCaption's "more" / "less") flows inline with the words.
export default function MentionText({
  text,
  style,
  mentionStyle,
  onMentionPress,
  numberOfLines,
  ellipsizeMode,
  onTextLayout,
  children,
}) {
  const parts = (text || '').split(MENTION_SPLIT_RE);

  return (
    <Text style={style} numberOfLines={numberOfLines} ellipsizeMode={ellipsizeMode} onTextLayout={onTextLayout}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text
            key={i}
            style={[{ color: MENTION_COLOR, fontWeight: '700' }, mentionStyle]}
            suppressHighlighting
            onPress={onMentionPress ? () => onMentionPress(part.slice(1)) : undefined}
          >
            {part}
          </Text>
        ) : (
          part
        )
      )}
      {children}
    </Text>
  );
}
