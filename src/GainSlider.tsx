import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, TVFocusGuideView, useTVEventHandler, View } from 'react-native';
import { MAX_GAIN } from './comparison';

export function GainSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const track = useRef<ComponentRef<typeof View>>(null);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const bounds = useRef({ x: 0, width: 1 });
  const [focused, setFocused] = useState(false);
  const change = (amount: number) => latest.current.onChange(
    Math.max(0, Math.min(MAX_GAIN, Math.round(amount * 10) / 10)),
  );
  useTVEventHandler((event) => {
    if (!focused || String(event.eventKeyAction) === '1') return;
    if (event.eventType === 'left') change(latest.current.value - 0.5);
    if (event.eventType === 'right') change(latest.current.value + 0.5);
  });
  const responder = useMemo(() => {
    const at = (pageX: number) => change((pageX - bounds.current.x) / bounds.current.width * MAX_GAIN);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const pageX = event.nativeEvent.pageX;
        track.current?.measureInWindow((x, _y, width) => {
          bounds.current = { x, width: Math.max(1, width) };
          at(pageX);
        });
      },
      onPanResponderMove: (_event, gesture) => at(gesture.moveX),
    });
  }, []);

  return <TVFocusGuideView trapFocusLeft trapFocusRight>
    <Pressable
    hasTVPreferredFocus={Platform.isTV}
    accessibilityRole="adjustable"
    accessibilityLabel="HDR gain"
    accessibilityHint="Swipe up or down to adjust. On Apple TV, press left or right."
    accessibilityValue={{ min: 0, max: MAX_GAIN, now: value }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={(event) => {
      if (event.nativeEvent.actionName === 'increment') change(value + 0.5);
      if (event.nativeEvent.actionName === 'decrement') change(value - 0.5);
    }}
    onPress={() => {}}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={[styles.control, focused && styles.focused]}>
    <View ref={track} style={styles.touchArea} {...responder.panHandlers}>
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: `${value / MAX_GAIN * 100}%` }]} />
        <View style={[styles.thumb, { left: `${value / MAX_GAIN * 100}%` }]} />
      </View>
    </View>
    <View style={styles.labels}>
      <Text style={styles.label}>0 · SDR</Text>
      <Text style={styles.value}>HDR gain {value.toFixed(1)}×</Text>
      <Text style={styles.label}>10</Text>
    </View>
  </Pressable>
  </TVFocusGuideView>;
}

const styles = StyleSheet.create({
  control: { borderWidth: 2, borderColor: 'transparent', borderRadius: 12, padding: 12 },
  focused: { borderColor: '#a9c8ff', backgroundColor: '#161e2d' },
  touchArea: { height: 48, justifyContent: 'center', marginHorizontal: 12 },
  track: { height: 5, backgroundColor: '#354056', borderRadius: 3 },
  fill: { height: 5, backgroundColor: '#a9c8ff', borderRadius: 3 },
  thumb: { position: 'absolute', top: -10, width: 25, height: 25, marginLeft: -12.5, borderRadius: 13, backgroundColor: '#fff' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, color: '#a7b3c9' },
  value: { fontSize: 18, color: '#fff', fontVariant: ['tabular-nums'] },
});
