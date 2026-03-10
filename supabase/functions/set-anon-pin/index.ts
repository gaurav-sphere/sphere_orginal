// Supabase Edge Function: set-anon-pin
// POST /functions/v1/set-anon-pin
// Body: { pin: string, current_pin?: string }
// - If no current_pin: sets PIN for first time
// - If current_pin provided: changes existing PIN (requires verification first)
// Returns: { success: boolean }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { pin, current_pin } = body as { pin: string; current_pin?: string };

    // Validate new PIN
    if (!pin || !/^\d{4}$/.test(pin)) {
      return Response.json({ error: "PIN must be exactly 4 digits" }, { status: 400, headers: corsHeaders });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("anon_pin_hash, anon_pin_set, anon_pin_changed_at")
      .eq("id", user.id)
      .single();

    // If PIN already set, require current_pin verification
    if (profile?.anon_pin_set && profile?.anon_pin_hash) {
      if (!current_pin) {
        return Response.json({ error: "current_pin required to change existing PIN" }, { status: 400, headers: corsHeaders });
      }

      // Rate limit: 1 change per 24 hours
      if (profile.anon_pin_changed_at) {
        const lastChange = new Date(profile.anon_pin_changed_at);
        const hoursSince = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          return Response.json(
            { error: "PIN can only be changed once every 24 hours" },
            { status: 429, headers: corsHeaders }
          );
        }
      }

      // Verify current PIN
      const isMatch = await bcrypt.compare(current_pin, profile.anon_pin_hash);
      if (!isMatch) {
        return Response.json({ error: "Current PIN is incorrect" }, { status: 403, headers: corsHeaders });
      }
    }

    // Hash and store new PIN
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(pin, salt);

    await supabaseAdmin
      .from("profiles")
      .update({
        anon_pin_hash:       hash,
        anon_pin_set:        true,
        anon_pin_changed_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return Response.json({ success: true }, { headers: corsHeaders });

  } catch (err) {
    console.error("set-anon-pin error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500, headers: corsHeaders });
  }
});
