import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    // URL-Parameter auslesen
    const url = new URL(req.url);
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");

    // Prüfen, ob start und end gesetzt sind und gültige ISO-Daten sind
    if (!startParam || !endParam || isNaN(Date.parse(startParam)) || isNaN(Date.parse(endParam))) {
      return new Response(
        JSON.stringify({ error: "❌ Bitte gültige ISO-Daten für 'start' und 'end' angeben" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Start- und Endzeit als ISO-Strings
    const startTime = new Date(startParam).toISOString();
    const endTime = new Date(endParam).toISOString();

    // Sessions abrufen, die innerhalb des Zeitraums liegen
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select("id, session_type, start_time, end_time, availability")
      .gte("start_time", startTime)
      .lte("start_time", endTime);

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
