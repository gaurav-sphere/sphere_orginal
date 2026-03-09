import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xhyizcnlsjzjjolqwoyt.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoeWl6Y25sc2p6ampvbHF3b3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU3MDQsImV4cCI6MjA4ODY0MTcwNH0.7DbBk7KZG63P47MnmXBxt1nRDrXgzWM7_yeM5bjEWvk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);