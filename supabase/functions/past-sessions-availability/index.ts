import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    // Heutiges Datum in UTC holen
    const now = new Date().toISOString();

    // Vergangene Sessions abrufen (start_time liegt in der Vergangenheit)
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("id, session_type, start_time, end_time, availability")
      .lt("start_time", now); // Nur Sessions mit Startzeit in der Vergangenheit

    if (error) {
      console.error("❌ Fehler beim Abrufen der Sessions:", error);
      return new Response(JSON.stringify({ error: "Fehler beim Abrufen der Sessions" }), { status: 500 });
    }

    // Verfügbarkeiten bereinigen: Immer den letzten Eintrag aus dem Availability-Array nehmen
    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      session_type: session.session_type,
      start_time: session.start_time,
      end_time: session.end_time,
      last_availability: session.availability?.length
        ? session.availability[session.availability.length - 1].available_slots
        : null, // Falls keine Verfügbarkeit vorhanden ist, null setzen
    }));

    return new Response(JSON.stringify(formattedSessions), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("❌ Fehler in der Funktion:", err);
    return new Response(JSON.stringify({ error: "Interner Serverfehler" }), { status: 500 });
  }
});
