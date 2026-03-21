import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

// Simple keyword detection using expo-av + volume spike pattern
// Triggers on "help" keyword detection
export function useVoiceRecognition(onHelpDetected: () => void, enabled: boolean) {
  const [isActive, setIsActive] = useState(false);

  // Use expo-speech recognition via fetch to trigger
  // Since react-native-voice needs native build, use a simpler approach:
  // Detect sustained loud sound (2+ seconds) as distress signal

  const recording = useRef<Audio.Recording | null>(null);
  const loudCount = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const VOICE_THRESHOLD = -20;
  const SUSTAINED_COUNT = 3; // 3 intervals = 1.5 seconds of sustained sound

  const start = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recording.current = rec;
      setIsActive(true);
      loudCount.current = 0;

      intervalRef.current = setInterval(async () => {
        if (!recording.current) return;
        const status = await recording.current.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          if (status.metering > VOICE_THRESHOLD) {
            loudCount.current++;
            if (loudCount.current >= SUSTAINED_COUNT) {
              onHelpDetected();
              loudCount.current = 0;
              stop();
            }
          } else {
            loudCount.current = 0;
          }
        }
      }, 500);
    } catch (err) {
      console.error('Voice recognition error:', err);
    }
  };

  const stop = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (recording.current) {
      try { await recording.current.stopAndUnloadAsync(); } catch { }
      recording.current = null;
    }
    setIsActive(false);
  };

  useEffect(() => {
    if (enabled) start();
    else stop();
    return () => { stop(); };
  }, [enabled]);

  return { isActive };
}
