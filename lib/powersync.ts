import { PowerSyncDatabase } from '@powersync/react-native'
import { AppSchema } from '../db/powersync-schema'

export const db = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
        dbFilename: 'safeher.db',
    },
})