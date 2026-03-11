import { supabase } from "../lib/supabase";

export async function togglePraise(quoteId: string, userId: string) {

  // Check if praise already exists
  const { data: existing } = await supabase
    .from("praises")
    .select("*")
    .eq("quote_id", quoteId)
    .eq("user_id", userId)
    .single();

  if (existing) {

    // Remove praise
    await supabase
      .from("praises")
      .delete()
      .eq("id", existing.id);

    await supabase.rpc("decrement_praise", { quote_id: quoteId });

    return false;
  }

  // Add praise
  await supabase
    .from("praises")
    .insert([{ quote_id: quoteId, user_id: userId }]);

  await supabase.rpc("increment_praise", { quote_id: quoteId });

  return true;
}