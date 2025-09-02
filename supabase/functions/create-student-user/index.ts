// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fungsi untuk mengatur header CORS
function getCorsHeaders(req: Request) {
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:5173")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  
  const origin = req.headers.get("Origin") || "";
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "http://localhost:5173";
  
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

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Validasi method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validasi environment variables
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inisialisasi Supabase client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Dapatkan JWT dari header
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing JWT" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inisialisasi client dengan JWT untuk verifikasi
    const supabaseWithAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } }
    });

    // Verifikasi user yang memanggil fungsi ini
    const { data: { user }, error: userError } = await supabaseWithAuth.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid user session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verifikasi role (hanya admin/staff yang bisa membuat user baru)
    const [{ data: isAdmin }, { data: isStaff }] = await Promise.all([
      supabaseWithAuth.rpc("is_admin"),
      supabaseWithAuth.rpc("is_staff"),
    ]);

    if (!isAdmin && !isStaff) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    let payload: { studentId: string; email: string; name?: string; } | null = null;
    try {
      payload = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { studentId, email, name } = payload || {};
    
    if (!studentId || !email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: studentId and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tentukan password default dari ENV atau fallback
    const password = Deno.env.get("DEFAULT_STUDENT_PASSWORD") || "kamal123";

    try {
      // 1. Buat user di auth.users
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          // Aplikasi membaca 'name' saat login; simpan keduanya untuk kompatibilitas
          name: name || '',
          full_name: name || '',
          role: 'student',
          must_change_password: true,
        },
      });

      if (userError) throw userError;
      if (!userData.user) throw new Error("Failed to create user");

      // 2. Update tabel students dengan user_id yang baru dibuat
      const { error: updateError } = await supabaseAdmin
        .from('students')
        .update({ 
          user_id: userData.user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', studentId);

      if (updateError) throw updateError;

      // 3. Beri role 'student' ke user yang baru dibuat
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert(
          { user_id: userData.user.id, role: 'student' },
          { onConflict: 'user_id' }
        );

      if (roleError) console.warn("Warning: Failed to set user role:", roleError);

      // 4. Kirim email selamat datang (opsional)
      // Di sini Anda bisa menambahkan kode untuk mengirim email berisi password ke mahasiswa

      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: userData.user.id,
          email: userData.user.email,
          // Jangan kirim password dalam response
        }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json" 
          } 
        }
      );

    } catch (error) {
      console.error("Error in create-student-user:", error);
      return new Response(
        JSON.stringify({ 
          error: "Failed to create student user",
          details: error instanceof Error ? error.message : String(error)
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});