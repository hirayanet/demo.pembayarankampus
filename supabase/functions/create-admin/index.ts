// deno-lint-ignore-file no-explicit-any
// Edge Function: create-admin
// Purpose: Allow active admins to create a new admin or staff account directly with a default password.
// - Verifies the caller is an active admin via public.is_admin() RPC
// - Uses Service Role to call auth.admin.createUser({ email, password })
// - Inserts/updates the created user's role in public.user_roles as active

// Declare Deno for local TypeScript tooling to avoid "Cannot find name 'Deno'" lint in non-Deno editors
declare const Deno: any;

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_ADMIN_PASSWORD = Deno.env.get("DEFAULT_ADMIN_PASSWORD") ?? "admin123";
const DEFAULT_STAFF_PASSWORD = Deno.env.get("DEFAULT_STAFF_PASSWORD") ?? "staff123";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ code: 401, message: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const email = (body?.email || '').toString().trim().toLowerCase();
    const role = ((body?.role || 'admin').toString().toLowerCase()) as 'admin' | 'staff';
    const passwordRaw = body?.password as string | undefined;
    const password = (passwordRaw && passwordRaw.length > 0)
      ? passwordRaw
      : (role === 'staff' ? DEFAULT_STAFF_PASSWORD : DEFAULT_ADMIN_PASSWORD);
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400, headers: corsHeaders });
    }
    if (role !== 'admin' && role !== 'staff') {
      return new Response(JSON.stringify({ error: 'Invalid role' }), { status: 400, headers: corsHeaders });
    }

    // Client bound to caller JWT to check admin via RPC
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: isAdmin, error: adminErr } = await callerClient.rpc('is_admin');
    if (adminErr) {
      console.error('admin check error', adminErr);
      return new Response(JSON.stringify({ error: 'Admin check failed' }), { status: 500, headers: corsHeaders });
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    // Create user with service role
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // Align with Login.tsx which checks user.user_metadata.must_change_password
      user_metadata: { must_change_password: true },
    });
    if (createErr) {
      // Map duplicate email to a friendlier error and 409 conflict
      const msg = (createErr.message || '').toLowerCase();
      const isDuplicate = msg.includes('already registered') || msg.includes('user already exists') || msg.includes('duplicate');
      const status = isDuplicate ? 409 : (createErr.status || 400);
      const friendly = isDuplicate ? 'Email sudah terdaftar. Gunakan email lain.' : createErr.message;
      return new Response(JSON.stringify({ error: friendly, code: isDuplicate ? 'EMAIL_CONFLICT' : 'CREATE_USER_ERROR' }), { status, headers: corsHeaders });
    }

    const newUserId = created?.user?.id;
    if (!newUserId) {
      return new Response(JSON.stringify({ error: 'User not created' }), { status: 500, headers: corsHeaders });
    }

    // Upsert role in public.user_roles
    const { error: upsertErr } = await serviceClient
      .from('user_roles')
      .upsert({ user_id: newUserId, role, active: true }, { onConflict: 'user_id' });
    if (upsertErr) {
      console.error('user_roles upsert error', upsertErr);
      return new Response(JSON.stringify({ error: 'Failed to set user role' }), { status: 500, headers: corsHeaders });
    }

    const default_password = role === 'staff' ? DEFAULT_STAFF_PASSWORD : DEFAULT_ADMIN_PASSWORD;
    return new Response(JSON.stringify({ ok: true, user: created.user, role, default_password }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error('create-admin error', e);
    const msg = typeof e?.message === 'string' ? e.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
