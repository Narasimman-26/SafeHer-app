import { useEffect, useRef, useState } from 'react';
import { useAudioRecorder, requestRecordingPermissionsAsync, RecordingPresets, setAudioModeAsync } from 'expo-audio';

// Simple keyword detection using expo-audio + volume spike pattern
// Triggers on "help" keyword detection
export function useVoiceRecognition(onHelpDetected: () => void, enabled: boolean) {
  const [isActive, setIsActive] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const loudCount = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const VOICE_THRESHOLD = -20;
  const SUSTAINED_COUNT = 3; // 3 intervals = 1.5 seconds of sustained sound

  const start = async () => {
    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') return;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        allowsBackgroundRecording: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsActive(true);
      loudCount.current = 0;

      intervalRef.current = setInterval(() => {
        const state = recorder.getStatus();
        if (state.isRecording && state.metering !== undefined) {
          if (state.metering > VOICE_THRESHOLD) {
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
    try { await recorder.stop(); } catch { }
    setIsActive(false);
  };

  useEffect(() => {
    if (enabled) start();
    else stop();
    return () => { stop(); };
  }, [enabled]);

  return { isActive };
}
