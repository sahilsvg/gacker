import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verify the caller is authenticated using the anon key
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Use service role key to delete everything — never exposed to the app
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const uid = user.id;

    // Delete all user data across every table
    await admin.from('notifications').delete().or(`user_id.eq.${uid},actor_id.eq.${uid}`);
    await admin.from('likes').delete().eq('user_id', uid);
    await admin.from('comments').delete().eq('user_id', uid);
    await admin.from('follows').delete().or(`follower_id.eq.${uid},following_id.eq.${uid}`);
    await admin.from('entries').delete().eq('user_id', uid);
    await admin.from('profiles').delete().eq('id', uid);

    // Delete the auth account itself
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
