import { useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GpuComparison } from './src/GpuComparison';
import { GRAYSCALE_STEPS, STEP_COLUMNS, STEP_ROWS, type LayerToneMapMode, type PresentationMode } from './src/comparison';
import { presentationStatus } from './src/presentation';

export default function App() {
  const { height, fontScale } = useWindowDimensions();
  const labelHeight = (Platform.isTV ? 26 : 18) * fontScale + (Platform.isTV ? 10 : 6);
  const patternHeight = Math.max(labelHeight * STEP_ROWS / 0.36, Math.min(Platform.isTV ? 300 : 240, height - 220));
  const [mode, setMode] = useState<PresentationMode>('preferred');
  const [toneMapMode, setToneMapMode] = useState<LayerToneMapMode>('never');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const modes = [['wants-extended', 'wantsExtended'], ['preferred', 'preferredDynamicRange']] as const;
  const toneModes = [['never', 'Off'], ['if-supported', 'On']] as const;
  const version = Number.parseFloat(String(Platform.Version));
  const warning = presentationStatus(mode, Platform.isTV, version)
    || (toneMapMode === 'if-supported' && version < 18 ? 'Tone mapping requires OS 18+' : '');

  return <SafeAreaView style={styles.screen}>
    <StatusBar hidden />
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={[styles.content, Platform.isTV && styles.tv]}>
        <Text style={styles.title}>WebGPU · Apple HDR</Text>
        <Text style={styles.subtitle}>{Platform.isTV ? 'tvOS' : 'iOS'} {Platform.Version} · headroom 11</Text>
        <View testID="hdr-calibration">
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="HDR API">
            {modes.map(([value, label]) => <Pressable key={value}
              accessibilityRole="radio" accessibilityState={{ checked: mode === value }}
              accessibilityLabel={'HDR API ' + label}
              hasTVPreferredFocus={Platform.isTV && value === 'preferred'}
              onPress={() => setMode(value)}
              onFocus={() => setFocused('api-' + value)} onBlur={() => setFocused(null)}
              style={[styles.option, mode === value && styles.selected, focused === 'api-' + value && styles.focused]}>
              <Text style={[styles.optionText, mode === value && styles.selectedText]}>{label}</Text>
            </Pressable>)}
          </View>
          <View style={styles.toneRow}>
            <Text style={styles.controlLabel}>Tone mapping</Text>
            <View style={styles.toneChoices} accessibilityRole="radiogroup" accessibilityLabel="Layer tone mapping">
              {toneModes.map(([value, label]) => <Pressable key={value}
                accessibilityRole="radio" accessibilityState={{ checked: toneMapMode === value }}
                accessibilityLabel={'Layer tone mapping ' + label}
                onPress={() => setToneMapMode(value)}
                onFocus={() => setFocused('tone-' + value)} onBlur={() => setFocused(null)}
                style={[styles.toneChoice, toneMapMode === value && styles.selected, focused === 'tone-' + value && styles.focused]}>
                <Text style={[styles.optionText, toneMapMode === value && styles.selectedText]}>{label}</Text>
              </Pressable>)}
            </View>
          </View>
          <View style={[styles.comparison, { height: patternHeight }]}>
            <GpuComparison mode={mode} toneMapMode={toneMapMode} onError={setError} />
            <View pointerEvents="none" style={styles.labels}>
              {Array.from({ length: STEP_ROWS }, (_, row) => <View key={row} style={styles.labelRow}>
                {GRAYSCALE_STEPS.slice(row * STEP_COLUMNS, (row + 1) * STEP_COLUMNS).map(value =>
                  <View key={value} style={styles.labelCell}>
                    <Text style={[styles.value, value === 1 && styles.reference]}>{value}×{value === 1 ? ' SDR' : ''}</Text>
                  </View>)}
              </View>)}
            </View>
          </View>
          {!!warning && <Text style={styles.warning}>{warning}</Text>}
        </View>
        {!!error && <Text selectable style={styles.error}>{error}</Text>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0e14' },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 16 },
  tv: { padding: 24 },
  title: { fontSize: Platform.isTV ? 28 : 24, fontWeight: '600', color: '#fff' },
  subtitle: { fontSize: 12, color: '#8996ad', marginTop: 4, marginBottom: 8 },
  comparison: { backgroundColor: '#000', marginTop: 6 },
  labels: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  labelRow: { flex: 1, flexDirection: 'row' },
  labelCell: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: Platform.isTV ? 10 : 6 },
  value: { color: '#e9eef8', fontSize: Platform.isTV ? 22 : 14, lineHeight: Platform.isTV ? 26 : 18, fontVariant: ['tabular-nums'] },
  reference: { color: '#a5ead0', fontWeight: '600' },
  options: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 2, borderColor: '#354056', padding: 6, alignItems: 'center', justifyContent: 'center' },
  toneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  controlLabel: { flex: 1, color: '#e9eef8', fontSize: Platform.isTV ? 18 : 14 },
  toneChoices: { flexDirection: 'row', gap: 8 },
  toneChoice: { minWidth: 64, minHeight: 44, borderRadius: 8, borderWidth: 2, borderColor: '#354056', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  selected: { backgroundColor: '#203557', borderColor: '#6c9fe9' },
  focused: { borderColor: '#fff' },
  optionText: { color: '#a7b3c9', fontSize: Platform.isTV ? 18 : 13, textAlign: 'center' },
  selectedText: { color: '#fff' },
  warning: { color: '#ced8e9', fontSize: 12, marginTop: 6 },
  error: { color: '#ff9b9b', marginTop: 8 },
});
