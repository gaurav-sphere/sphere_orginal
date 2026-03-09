import { supabase } from "./supabaseClient";

export async function getFeedQuotes() {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  return data;
}