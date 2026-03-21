import { useEffect } from 'react';
import { Accelerometer } from 'expo-sensors';

export function useShake(onShake: () => void) {
  useEffect(() => {
    let lastShake = 0;
    let shakeCount = 0;
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const total = Math.sqrt(x * x + y * y + z * z);
      if (total > 2.5) {
        const now = Date.now();
        if (now - lastShake < 1000) {
          shakeCount++;
          if (shakeCount >= 3) { onShake(); shakeCount = 0; }
        } else {
          shakeCount = 1;
        }
        lastShake = now;
      }
    });

    Accelerometer.setUpdateInterval(100);
    return () => sub.remove();
  }, [onShake]);
}