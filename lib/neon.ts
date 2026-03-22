import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.EXPO_PUBLIC_NEON_DATABASE_URL!);

export const testNeonConnection = async () => {
    try {
        const result = await sql`SELECT NOW()`;
        console.log('✅ Neon Connected!', result);
        return result;
    } catch (error) {
        console.log('❌ Neon Error:', error);
    }
};

export const saveSosAlert = async ({
    user_id,
    latitude,
    longitude,
    contacts_notified,
}: {
    user_id: string;
    latitude: number;
    longitude: number;
    contacts_notified: string[];
}) => {
    try {
        const result = await sql`
      INSERT INTO sos_alerts (user_id, latitude, longitude, contacts_notified)
      VALUES (${user_id}, ${latitude}, ${longitude}, ${JSON.stringify(contacts_notified)})
      RETURNING *
    `;
        console.log('✅ SOS Alert saved to Neon!', result);
        return result;
    } catch (error) {
        console.log('❌ SOS Save Error:', error);
    }
};