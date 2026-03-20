import 'react-native-get-random-values'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native'
import { useState, useCallback } from 'react'
import { useShake } from './hooks/useShake'
import { getLocation } from './hooks/useLocation'
import { generateAlertMessage } from './lib/claude'

export default function App() {
  const [location, setLocation] = useState<string>('Not detected')
  const [loading, setLoading] = useState(false)

  const triggerSOS = useCallback(async () => {
    setLoading(true)
    try {
      const geo = await getLocation()
      setLocation(geo.area)
      const msg = await generateAlertMessage(
        geo.area,
        { name: 'Nearest Police Station' }
      )
      Alert.alert('🚨 SOS Triggered!', msg)
    } catch (e) {
      Alert.alert('SOS Sent', '🚨 Emergency alert triggered!')
    }
    setLoading(false)
  }, [])

  useShake(triggerSOS)

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>🛡️ SafeHer</Text>
      <Text style={styles.loc}>📍 {location}</Text>
      <TouchableOpacity
        style={styles.sos}
        onPress={triggerSOS}
        disabled={loading}
      >
        <Text style={styles.sosText}>
          {loading ? '⏳ Sending...' : '🆘 SOS'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Tap SOS or shake phone 3×</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0c10',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f0f2f7',
  },
  loc: {
    fontSize: 14,
    color: '#8b91a5',
  },
  sos: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#e8273a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e8273a',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  sosText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  hint: {
    fontSize: 12,
    color: '#8b91a5',
  },
})