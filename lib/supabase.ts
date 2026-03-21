import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveSOSAlert(latitude: number, longitude: number) {
  const { error } = await supabase.from('sos_alerts').insert({
    latitude,
    longitude,
    contacts_notified: ['Mom', 'Priya', 'Police'],
    created_at: new Date().toISOString(),
  });
  if (error) console.error('Supabase SOS error:', error);
}

export async function saveIncident(type: string, location: string, details: string) {
  const { error } = await supabase.from('incidents').insert({
    type, location, details,
    severity: 'medium',
    created_at: new Date().toISOString(),
  });
  if (error) console.error('Supabase incident error:', error);
}