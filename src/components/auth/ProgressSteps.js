import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

// step: 1-indexed current step. Steps before it are done (green), the
// current step is active (red), steps after are upcoming (grey).
export default function ProgressSteps({ step, total = 3 }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => {
        const stepNumber = i + 1;
        const isDone = stepNumber < step;
        const isActive = stepNumber === step;

        return (
          <View key={stepNumber} style={styles.segmentWrapper}>
            <View
              style={[
                styles.dot,
                isDone && styles.dotDone,
                isActive && styles.dotActive,
              ]}
            >
              {isDone ? <Ionicons name="checkmark" size={12} color={colors.white} /> : null}
            </View>
            {stepNumber < total ? (
              <View style={[styles.line, isDone && styles.lineDone]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  segmentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: colors.green,
  },
  dotActive: {
    backgroundColor: colors.red,
  },
  line: {
    flex: 1,
    height: 3,
    backgroundColor: colors.navyBorder,
    marginHorizontal: 6,
    borderRadius: 2,
  },
  lineDone: {
    backgroundColor: colors.green,
  },
});
