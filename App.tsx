import { useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GpuComparison } from './src/GpuComparison';
import { GRAYSCALE_STEPS, STEP_COLUMNS, STEP_ROWS, type PresentationMode } from './src/comparison';
import { presentationStatus } from './src/presentation';

export default function App() {
  const { fontScale } = useWindowDimensions();
  const patternHeight = Math.max(Platform.isTV ? 340 : 260,
    ((Platform.isTV ? 48 : 36) * fontScale + (Platform.isTV ? 12 : 10)) * STEP_ROWS / 0.36);
  const [mode, setMode] = useState<PresentationMode>('preferred');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<PresentationMode | null>(null);
  const modes = [
    ['wants-extended', 'wantsExtended'],
    ['preferred', 'preferredDynamicRange'],
  ] as const;

  return <SafeAreaView style={styles.screen}>
    <StatusBar hidden />
    <ScrollView contentContainerStyle={styles.scroll}>
    <View style={[styles.content, Platform.isTV && styles.tv]}>
      <Text style={styles.title}>WebGPU · Apple HDR</Text>
      <Text style={styles.subtitle}>{Platform.isTV ? 'tvOS' : 'iOS'} {Platform.Version} · rgba16float · extended sRGB</Text>

      <View style={[styles.comparison, { height: patternHeight }]}>
        <GpuComparison mode={mode} onError={setError} />
        <View pointerEvents="none" style={styles.labels}>
          {Array.from({ length: STEP_ROWS }, (_, row) => <View key={row} style={styles.labelRow}>
            {GRAYSCALE_STEPS.slice(row * STEP_COLUMNS, (row + 1) * STEP_COLUMNS).map(value =>
              <View key={value} style={styles.labelCell}>
                <Text style={[styles.value, value === 1 && styles.reference]}>{value}×</Text>
                <Text style={styles.referenceLabel}>{value === 1 ? 'SDR white' : ' '}</Text>
              </View>)}
          </View>)}
        </View>
      </View>

      <View style={styles.options} accessibilityRole="radiogroup">
        {modes.map(([value, label]) => <Pressable key={value}
          accessibilityRole="radio" accessibilityState={{ checked: mode === value }}
          hasTVPreferredFocus={Platform.isTV && value === 'preferred'}
          onPress={() => setMode(value)}
          onFocus={() => setFocused(value)} onBlur={() => setFocused(null)}
          style={[styles.option, mode === value && styles.selected, focused === value && styles.focused]}>
          <Text style={[styles.optionText, mode === value && styles.selectedText]}>{label}</Text>
        </Pressable>)}
      </View>
      <Text style={styles.status}>{presentationStatus(mode, Platform.isTV, Number.parseFloat(String(Platform.Version)))}</Text>
      <Text style={styles.help}>Fixed linear brightness from 0.25× to 11× SDR white. Switch APIs and compare the same steps. Content headroom stays at 11; layer tone mapping is disabled where supported.</Text>
      {!!error && <Text selectable style={styles.error}>{error}</Text>}
    </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0e14' },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 20 },
  tv: { padding: 48 },
  title: { fontSize: 28, fontWeight: '600', color: '#fff' },
  subtitle: { fontSize: 13, color: '#8996ad', marginTop: 6, marginBottom: 24 },
  comparison: { backgroundColor: '#000' },
  labels: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  labelRow: { flex: 1, flexDirection: 'row' },
  labelCell: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: Platform.isTV ? 12 : 10 },
  value: { color: '#e9eef8', fontSize: Platform.isTV ? 22 : 16, lineHeight: Platform.isTV ? 28 : 22, fontVariant: ['tabular-nums'] },
  reference: { color: '#a5ead0', fontWeight: '600' },
  referenceLabel: { color: '#a5ead0', fontSize: Platform.isTV ? 14 : 10, lineHeight: Platform.isTV ? 20 : 14 },
  options: { flexDirection: 'row', gap: 8, marginTop: 16 },
  option: { flex: 1, borderRadius: 8, borderWidth: 2, borderColor: '#354056', paddingHorizontal: 6, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: '#203557', borderColor: '#6c9fe9' },
  focused: { borderColor: '#fff' },
  optionText: { color: '#a7b3c9', fontSize: 13, textAlign: 'center' },
  selectedText: { color: '#fff' },
  status: { color: '#ced8e9', fontSize: 13, minHeight: 40, marginTop: 14, lineHeight: 20 },
  help: { color: '#8996ad', fontSize: 12, lineHeight: 18 },
  error: { color: '#ff9b9b', marginTop: 10 },
});
