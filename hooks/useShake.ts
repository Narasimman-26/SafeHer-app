import { Accelerometer } from 'expo-sensors'
import { useEffect, useRef } from 'react'

export function useShake(onShake: () => void) {
    const last = useRef({ x: 0, y: 0, z: 0 })
    const count = useRef(0)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        Accelerometer.setUpdateInterval(100)

        const sub = Accelerometer.addListener(({ x, y, z }) => {
            const delta =
                Math.abs(x - last.current.x) +
                Math.abs(y - last.current.y) +
                Math.abs(z - last.current.z)

            if (delta > 2.5) {
                count.current += 1
                if (timer.current) clearTimeout(timer.current)
                timer.current = setTimeout(() => {
                    count.current = 0
                }, 2000)
                if (count.current >= 3) {
                    count.current = 0
                    onShake()
                }
            }
            last.current = { x, y, z }
        })

        return () => {
            sub.remove()
            if (timer.current) clearTimeout(timer.current)
        }
    }, [onShake])
}