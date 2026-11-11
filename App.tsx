import { useState } from 'react';
import { Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GainSlider } from './src/GainSlider';
import { GpuComparison } from './src/GpuComparison';
import type { PresentationMode } from './src/comparison';
import { presentationStatus } from './src/presentation';

export default function App() {
  const [gain, setGain] = useState(Platform.isTV ? 10 : 1);
  const [mode, setMode] = useState<PresentationMode>('preferred');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<PresentationMode | null>(null);
  const modes = [
    ['wants-extended', 'wantsExtended'],
    ['preferred', 'preferredDynamicRange'],
  ] as const;

  return <SafeAreaView style={styles.screen}>
    <StatusBar hidden />
    <View style={[styles.content, Platform.isTV && styles.tv]}>
      <Text style={styles.title}>WebGPU · Apple HDR</Text>
      <Text style={styles.subtitle}>{Platform.isTV ? 'tvOS' : 'iOS'} {Platform.Version} · rgba16float · extended sRGB</Text>

      <View style={styles.comparison}>
        <GpuComparison gain={gain} mode={mode} onError={setError} />
      </View>
      <View style={styles.captions}>
        <Text style={styles.caption}>SDR white{ '\n' }1.0×</Text>
        <Text style={styles.caption}>HDR white{ '\n' }{(1 + gain).toFixed(1)}×</Text>
      </View>

      <GainSlider value={gain} onChange={setGain} />
      <View style={styles.options} accessibilityRole="radiogroup">
        {modes.map(([value, label]) => <Pressable key={value}
          accessibilityRole="radio" accessibilityState={{ checked: mode === value }}
          onPress={() => setMode(value)}
          onFocus={() => setFocused(value)} onBlur={() => setFocused(null)}
          style={[styles.option, mode === value && styles.selected, focused === value && styles.focused]}>
          <Text style={[styles.optionText, mode === value && styles.selectedText]}>{label}</Text>
        </Pressable>)}
      </View>
      <Text style={styles.status}>{presentationStatus(mode, Platform.isTV, Number.parseFloat(String(Platform.Version)))}</Text>
      <Text style={styles.help}>{Platform.isTV ? 'Focus the slider, then press ← / →.' : 'Drag the slider.'} At 0 both whites match. Headroom stays at 11.</Text>
      {!!error && <Text selectable style={styles.error}>{error}</Text>}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0e14' },
  content: { flex: 1, width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 20, justifyContent: 'center' },
  tv: { padding: 48 },
  title: { fontSize: 28, fontWeight: '600', color: '#fff' },
  subtitle: { fontSize: 13, color: '#8996ad', marginTop: 6, marginBottom: 24 },
  comparison: { flex: 1, minHeight: 130, maxHeight: 360, backgroundColor: '#000' },
  captions: { flexDirection: 'row', marginVertical: 12 },
  caption: { width: '50%', textAlign: 'center', color: '#e9eef8', fontSize: 16, lineHeight: 24, fontVariant: ['tabular-nums'] },
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
