export function playSelectionSound(
  frequency: number,
  contextRef: { current: AudioContext | null },
): void {
  if (typeof window === 'undefined' || !window.AudioContext) return;
  contextRef.current ??= new window.AudioContext();
  const context = contextRef.current;
  context.resume().then(() => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startTime = context.currentTime;
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.18);
  }).catch(() => undefined);
}
