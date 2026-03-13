// Supabase Edge Function: account-recovery
// POST /functions/v1/account-recovery
//
// Actions:
//   1. check_email       — check how many accounts share an email
//   2. send_reset_email  — send reset link to a single-account email
//   3. verify_and_reset  — verify identity for multi-account email, then send reset
//   4. reset_by_username — send reset to email stored against a username
//   5. find_username     — find username(s) by email + full name
//
// All sensitive DB reads (dob, phone, email) use SERVICE ROLE — never exposed to frontend

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok  = (data: unknown)  => Response.json({ ok: true,  ...data as object }, { headers: corsHeaders });
const err = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status, headers: corsHeaders });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Service-role client — bypasses RLS for safe server-side reads
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Record<string, string>;
  try { body = await req.json(); }
  catch { return err("Invalid JSON body"); }

  const { action } = body;

  /* ─────────────────────────────────────────────
     1. CHECK EMAIL — how many accounts use it
  ───────────────────────────────────────────── */
  if (action === "check_email") {
    const email = (body.email || "").trim().toLowerCase();
    if (!email.includes("@")) return err("Invalid email");

    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email);

    if (error) return err("Database error");

    return ok({ count: data?.length ?? 0 });
  }

  /* ─────────────────────────────────────────────
     2. SEND RESET EMAIL — single account case
  ───────────────────────────────────────────── */
  if (action === "send_reset_email") {
    const email = (body.email || "").trim().toLowerCase();
    if (!email.includes("@")) return err("Invalid email");

    // Confirm exactly one account exists
    const { data } = await admin.from("profiles").select("id").eq("email", email);
    if (!data || data.length !== 1) return err("Account not found");

    const { error: resetErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (resetErr) return err("Failed to send reset email");
    return ok({ message: "Reset link sent" });
  }

  /* ─────────────────────────────────────────────
     3. VERIFY AND RESET — multi-account case
  ───────────────────────────────────────────── */
  if (action === "verify_and_reset") {
    const email    = (body.email    || "").trim().toLowerCase();
    const username = (body.username || "").trim().toLowerCase().replace(/^@/, "");
    const name     = (body.name     || "").trim().toLowerCase();
    const dob      = (body.dob      || "").trim();
    const phone    = (body.phone    || "").trim().replace(/\D/g, "");

    if (!email || !username || !name) return err("Missing required fields");

    // Find profile matching email + username
    const { data: profiles, error: dbErr } = await admin
      .from("profiles")
      .select("id, email, name, dob, phone")
      .eq("email", email)
      .eq("username", username);

    if (dbErr || !profiles || profiles.length === 0) {
      return err("Account not found");
    }

    const profile = profiles[0];

    // Verify full name
    if ((profile.name || "").toLowerCase() !== name) {
      return err("Account not found");
    }

    // Verify DOB if provided
    if (dob && profile.dob && profile.dob !== dob) {
      return err("Account not found");
    }

    // Verify phone if provided (match last 10 digits)
    if (phone && profile.phone) {
      const storedDigits = profile.phone.replace(/\D/g, "");
      if (!storedDigits.endsWith(phone) && phone !== storedDigits) {
        return err("Account not found");
      }
    }

    // All checks passed — send reset to stored email
    const { error: resetErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
    });

    if (resetErr) return err("Failed to send reset email");
    return ok({ message: "Reset link sent" });
  }

  /* ─────────────────────────────────────────────
     4. RESET BY USERNAME
  ───────────────────────────────────────────── */
  if (action === "reset_by_username") {
    const username = (body.username || "").trim().toLowerCase().replace(/^@/, "");
    if (!username) return err("Username is required");

    const { data: profile } = await admin
      .from("profiles")
      .select("id, email")
      .eq("username", username)
      .maybeSingle();

    if (!profile?.email) return err("No account found with this username");

    const { error: resetErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
    });

    if (resetErr) return err("Failed to send reset email");
    return ok({ message: "Reset link sent" });
  }

  /* ─────────────────────────────────────────────
     5. FIND USERNAME by email + name
  ───────────────────────────────────────────── */
  if (action === "find_username") {
    const email = (body.email || "").trim().toLowerCase();
    const name  = (body.name  || "").trim().toLowerCase();

    if (!email.includes("@")) return err("Invalid email");
    if (!name)                 return err("Full name is required");

    const { data: profiles } = await admin
      .from("profiles")
      .select("username, name")
      .eq("email", email);

    if (!profiles || profiles.length === 0) {
      return err("No account found with this email");
    }

    const matched = profiles.filter(p => {
      const stored = (p.name || "").toLowerCase();
      return stored.includes(name) || name.includes(stored);
    });

    if (matched.length === 0) {
      return err("Account not found. The name you entered did not match any account linked to this email.");
    }

    // Return usernames — never return email or other private fields
    return ok({ usernames: matched.map(p => p.username) });
  }

  return err("Unknown action", 400);
});
