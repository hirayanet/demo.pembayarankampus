// deno-lint-ignore-file no-explicit-any
// Edge Function: delete-student-user (HARD DELETE)
// Responsibilities:
// - Validate caller is authenticated and has admin/staff role (via public.user_roles and helpers is_admin()/is_staff())
// - Given studentId and/or email, locate the corresponding user_id
// - Delete app data first (public.user_roles for that user_id, public.students row)
// - Then hard delete Supabase Auth user via Admin API
// - Handle CORS for browser calls (OPTIONS + proper headers)

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
    "Vary": "Origin",
  } as Record<string, string>;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // CORS preflight
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

    const SUPABASE_URL = Deno.env.get("SB_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Service env not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth context from caller
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

    // Verify role via helper RPCs (auth context via supabaseWithAuth ensures auth.uid() is caller)
    const [{ data: isAdmin, error: isAdminErr }, { data: isStaff, error: isStaffErr }] = await Promise.all([
      supabaseWithAuth.rpc("is_admin"),
      supabaseWithAuth.rpc("is_staff"),
    ]);
    if (isAdminErr || isStaffErr || !(isAdmin === true || isStaff === true)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const { studentId, email } = payload as { studentId?: string; email?: string };
    if (!studentId && !email) {
      return new Response(JSON.stringify({ error: "Missing studentId or email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Fetch student row and resolve user_id (students.user_id may not exist; prefer resolving by email)
    let userId: string | null = null;
    let targetStudentId: string | null = studentId ?? null;

    if (studentId) {
      const { data: srow, error: sErr } = await supabaseAdmin
        .from("students")
        .select("id, email")
        .eq("id", studentId)
        .single();
      if (sErr && sErr.code !== "PGRST116") throw sErr; // not found is okay if deleting by email only
      if (srow) {
        targetStudentId = srow.id;
        // Try resolve userId by email if available
        const stuEmail = (srow as any).email as string | undefined;
        if (stuEmail) {
          const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          if (listErr) throw listErr;
          const existing = list?.users?.find((u: any) => (u?.email || "").toLowerCase() === stuEmail.toLowerCase());
          if (existing?.id) userId = existing.id;
        }
      }
    }

    if (!userId && email) {
      // If user_id is not on student row (or student row not found), try find Auth user by email
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) throw listErr;
      const existing = list?.users?.find((u: any) => (u?.email || "").toLowerCase() === email.toLowerCase());
      if (existing?.id) {
        userId = existing.id;
      }
      // Also try to get studentId by email if not provided
      if (!targetStudentId) {
        const { data: srow2, error: sErr2 } = await supabaseAdmin
          .from("students")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (sErr2) throw sErr2;
        targetStudentId = srow2?.id ?? null;
      }
    }

    // 2) Delete app rows first (remove any role rows for this user in user_roles)
    if (userId) {
      const { error: roleDelErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (roleDelErr) throw roleDelErr;
    }

    if (targetStudentId) {
      const { error: studDelErr } = await supabaseAdmin
        .from("students")
        .delete()
        .eq("id", targetStudentId);
      if (studDelErr) throw studDelErr;
    }

    // 3) Hard delete Auth user last
    if (userId) {
      const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authDelErr) throw authDelErr;
    }

    return new Response(JSON.stringify({ ok: true, deleted_user_id: userId, deleted_student_id: targetStudentId }), {
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
