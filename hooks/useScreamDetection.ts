import { useEffect, useRef, useState } from 'react';
import { useAudioRecorder, requestRecordingPermissionsAsync, RecordingPresets, setAudioModeAsync } from 'expo-audio';

export function useScreamDetection(onScream: () => void, enabled: boolean) {
  const [isListening, setIsListening] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const SCREAM_THRESHOLD = -10; // dB threshold — loud sound

  const startListening = async () => {
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
      setIsListening(true);

      // Check volume every 500ms
      intervalRef.current = setInterval(() => {
        const state = recorder.getStatus();
        if (state.isRecording && state.metering !== undefined) {
          if (state.metering > SCREAM_THRESHOLD) {
            onScream();
            stopListening();
          }
        }
      }, 500);
    } catch (err) {
      console.error('Scream detection error:', err);
    }
  };

  const stopListening = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    try {
      await recorder.stop();
    } catch {}
    setIsListening(false);
  };

  useEffect(() => {
    if (enabled) startListening();
    else stopListening();
    return () => { stopListening(); };
  }, [enabled]);

  return { isListening };
}
