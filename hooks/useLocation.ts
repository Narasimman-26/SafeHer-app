import * as Location from 'expo-location'

export async function getLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
        throw new Error('Location permission denied')
    }

    const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
    })

    const [place] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
    })

    const area = [place.district, place.city]
        .filter(Boolean)
        .join(', ')

    return {
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        area: area || 'Unknown Area',
    }
}