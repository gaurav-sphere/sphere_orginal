// Supabase Edge Function: verify-anon-pin
// POST /functions/v1/verify-anon-pin
// Body: { pin: string }
// Returns: { success: boolean, locked: boolean, attempts_left: number }
//
// Logic:
//   - 5 failed attempts within 30 minutes → lockout for 30 minutes
//   - PIN is stored as bcrypt hash in profiles.anon_pin_hash
//   - Uses service role to bypass RLS for rate-limit checks

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    // Create a Supabase client with the user's JWT (to get their uid)
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const userId = user.id;

    // Create a service-role client for rate-limit checks
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Rate limit check ───────────────────────────────────────────────────────
    const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: attempts } = await supabaseAdmin
      .from("anon_pin_attempts")
      .select("id, success, attempted_at")
      .eq("user_id", userId)
      .eq("success", false)
      .gte("attempted_at", windowStart)
      .order("attempted_at", { ascending: false });

    const failedCount = attempts?.length ?? 0;
    const MAX_ATTEMPTS = 5;

    if (failedCount >= MAX_ATTEMPTS) {
      return Response.json(
        { success: false, locked: true, attempts_left: 0, message: "Too many attempts. Try again in 30 minutes." },
        { status: 429, headers: corsHeaders }
      );
    }

    // ── Parse PIN from body ────────────────────────────────────────────────────
    const body = await req.json();
    const { pin } = body as { pin: string };

    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return Response.json({ error: "PIN must be exactly 4 digits" }, { status: 400, headers: corsHeaders });
    }

    // ── Fetch stored hash ──────────────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("anon_pin_hash, anon_pin_set")
      .eq("id", userId)
      .single();

    if (!profile?.anon_pin_set || !profile?.anon_pin_hash) {
      return Response.json({ error: "Anon PIN not set" }, { status: 400, headers: corsHeaders });
    }

    // ── Verify PIN ─────────────────────────────────────────────────────────────
    const isMatch = await bcrypt.compare(pin, profile.anon_pin_hash);

    // Record the attempt
    await supabaseAdmin.from("anon_pin_attempts").insert({
      user_id: userId,
      success: isMatch,
    });

    if (isMatch) {
      return Response.json(
        { success: true, locked: false, attempts_left: MAX_ATTEMPTS },
        { headers: corsHeaders }
      );
    } else {
      const newFailedCount = failedCount + 1;
      const attemptsLeft = MAX_ATTEMPTS - newFailedCount;
      return Response.json(
        { success: false, locked: attemptsLeft <= 0, attempts_left: Math.max(0, attemptsLeft) },
        { headers: corsHeaders }
      );
    }
  } catch (err) {
    console.error("verify-anon-pin error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});
