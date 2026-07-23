import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import colors from '../theme/colors';

export default function PostScreen() {
  const [course, setCourse] = useState('');
  const [hole, setHole] = useState('');
  const [par, setPar] = useState('');
  const [score, setScore] = useState('');
  const [caption, setCaption] = useState('');

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New Hole Post</Text>

        <TouchableOpacity style={styles.photoUpload}>
          <Ionicons name="camera-outline" size={32} color={colors.muted} />
          <Text style={styles.photoUploadText}>Add photo</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Course</Text>
        <TextInput
          style={styles.input}
          value={course}
          onChangeText={setCourse}
          placeholder="e.g. Pebble Beach Golf Links"
          placeholderTextColor={colors.muted}
        />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Hole</Text>
            <TextInput
              style={styles.input}
              value={hole}
              onChangeText={setHole}
              keyboardType="number-pad"
              placeholder="#"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Par</Text>
            <TextInput
              style={styles.input}
              value={par}
              onChangeText={setPar}
              keyboardType="number-pad"
              placeholder="#"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Score</Text>
            <TextInput
              style={styles.input}
              value={score}
              onChangeText={setScore}
              keyboardType="number-pad"
              placeholder="#"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>

        <Text style={styles.label}>Caption</Text>
        <TextInput
          style={[styles.input, styles.captionInput]}
          value={caption}
          onChangeText={setCaption}
          placeholder="Tell the story of this hole..."
          placeholderTextColor={colors.muted}
          multiline
        />

        <TouchableOpacity style={styles.submitButton}>
          <Text style={styles.submitButtonText}>Share Post</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
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
    height: 160,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.navyBorder,
    borderStyle: 'dashed',
    backgroundColor: colors.navyCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  photoUploadText: {
    color: colors.muted,
    marginTop: 8,
    fontSize: 13,
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
  captionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  submitButton: {
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
