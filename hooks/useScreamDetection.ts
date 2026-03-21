import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

export function useScreamDetection(onScream: () => void, enabled: boolean) {
  const recording = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isListening, setIsListening] = useState(false);

  const SCREAM_THRESHOLD = -10; // dB threshold — loud sound

  const startListening = async () => {
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
      setIsListening(true);

      // Check volume every 500ms
      intervalRef.current = setInterval(async () => {
        if (!recording.current) return;
        const status = await recording.current.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          if (status.metering > SCREAM_THRESHOLD) {
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
    if (recording.current) {
      try {
        await recording.current.stopAndUnloadAsync();
      } catch {}
      recording.current = null;
    }
    setIsListening(false);
  };

  useEffect(() => {
    if (enabled) startListening();
    else stopListening();
    return () => { stopListening(); };
  }, [enabled]);

  return { isListening };
}
