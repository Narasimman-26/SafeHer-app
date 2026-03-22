import { PowerSyncDatabase } from '@powersync/react-native';
import { PowerSyncBackendConnector, AbstractPowerSyncDatabase } from '@powersync/common';
import { AppSchema } from '../db/powersync-schema';
import { supabase } from './supabase';

class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL!,
      token: session?.access_token ?? '',
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
    const batch = await database.getCrudBatch();
    if (!batch) return;

    for (const op of batch.crud) {
      const { table, opData, op: operation, id } = op;
      
      try {
        if (operation === 'PUT') {
          const { error } = await supabase.from(table).upsert({ ...opData, id });
          if (error) throw error;
        } else if (operation === 'PATCH') {
          const { error } = await supabase.from(table).update(opData!).eq('id', id);
          if (error) throw error;
        } else if (operation === 'DELETE') {
          const { error } = await supabase.from(table).delete().eq('id', id);
          if (error) throw error;
        }
      } catch (e) {
        console.error(`Failed to sync ${operation} on ${table}/${id}:`, e);
      }
    }
    await batch.complete();
  }
}

export const powerSync = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'safeher.db'
  },
});

export const setupPowerSync = async () => {
  try {
    // Initializing the database is required before connecting
    await powerSync.init();
    await powerSync.connect(new SupabaseConnector());
    console.log('PowerSync connected!');
  } catch (error) {
    console.error('PowerSync setup failed:', error);
  }
};