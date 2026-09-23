/**
 * Production Supabase Client & Realtime Manager
 * Dual-Mode Architecture: Automatically activates when VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY are present
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
  : null;

/**
 * Subscribe to live job updates for a technician or operational dispatcher
 */
export function subscribeToJobsRealtime(technicianId, onUpdate) {
  if (!supabase) return () => {};

  const filter = technicianId ? `technician_id=eq.${technicianId}` : undefined;

  const channel = supabase
    .channel('public:jobs')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter
      },
      (payload) => {
        console.log('[Supabase Realtime] Job change event received:', payload);
        if (typeof onUpdate === 'function') {
          onUpdate(payload);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Upload a job photo directly to Supabase Storage bucket 'job-photos'
 */
export async function uploadJobPhotoToSupabase(jobId, fileOrBlob) {
  if (!supabase) throw new Error('Supabase is not configured.');

  const ext = fileOrBlob.type ? fileOrBlob.type.split('/')[1] : 'jpg';
  const filePath = `job_${jobId}_${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('job-photos')
    .upload(filePath, fileOrBlob, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage
    .from('job-photos')
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}
