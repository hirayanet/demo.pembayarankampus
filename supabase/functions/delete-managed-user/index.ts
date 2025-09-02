// deno-lint-ignore-file no-explicit-any
// Edge Function: delete-managed-user (HARD DELETE for admin/staff)
// Responsibilities:
// - Validate caller is authenticated and has admin role
// - Given userId and/or email, resolve target Auth user
// - Delete app data first (public.user_roles for that user_id)
// - Then hard delete Supabase Auth user via Admin API
// - Handle CORS

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getCorsHeaders(req: Request) {
  const normalize = (s: string) => (s || "").trim().replace(/\/+$/g, "");
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:5173")
    .split(",")
    .map((s) => normalize(s))
    .filter(Boolean);
  const originRaw = req.headers.get("Origin") || "";
  const origin = normalize(originRaw);
  const allowOrigin = allowed.includes(origin) ? origin : (allowed[0] || "http://localhost:5173");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  } as Record<string, string>;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SB_URL") || Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Service env not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");

    const supabaseWithAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify caller user
    const { data: userRes, error: getUserErr } = await supabaseWithAuth.auth.getUser();
    if (getUserErr || !userRes?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userRes.user.id;

    // Verify admin role via public.user_roles
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("active", true)
      .single();
    if (roleErr || roleRow?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const { userId: inputUserId, email } = payload as { userId?: string; email?: string };
    if (!inputUserId && !email) {
      return new Response(JSON.stringify({ error: "Missing userId or email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve target Auth user id
    let targetUserId: string | null = inputUserId ?? null;
    if (!targetUserId && email) {
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) throw listErr;
      const existing = list?.users?.find((u: any) => (u?.email || "").toLowerCase() === email.toLowerCase());
      if (existing?.id) {
        targetUserId = existing.id;
      }
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Target user not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Delete app rows first: user_roles
    const { error: roleDelErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId);
    if (roleDelErr) throw roleDelErr;

    // 2) Hard delete Auth user
    const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (authDelErr) throw authDelErr;

    return new Response(JSON.stringify({ ok: true, deleted_user_id: targetUserId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
