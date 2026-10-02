// Add your Supabase project URL and publishable (anon) key in this file.
window.ITP_CONFIG = {
  supabaseUrl: "https://rybelihbtdfmvyfsyjad.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5YmVsaWhidGRmbXZ5ZnN5amFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MDg5MDcsImV4cCI6MjEwNjQ4NDkwN30.omK1srCYIO2aVYF6ofXLyVAjNe1gJ3FqCEyLyO-l7M4"
};

window.itpClient = null;
if (window.ITP_CONFIG.supabaseUrl && window.ITP_CONFIG.supabaseAnonKey && window.supabase) {
  window.itpClient = window.supabase.createClient(
    window.ITP_CONFIG.supabaseUrl,
    window.ITP_CONFIG.supabaseAnonKey
  );
}