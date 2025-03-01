import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { DateTime } from "https://esm.sh/luxon";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Liste der auszuschließenden Sessions
const excludedSessions = new Set([
  "c07b8b50-d72e-451d-8ff5-7e8e0af1bbf2", // Exclusive session
  "a9c98e05-6f2f-4b16-8c10-5137eff2f73f", // Exclusive session (2)
  "b56e8b9a-548a-442c-abfe-5f03ecc7d789", // Beginner session
  "31e7c3ee-7025-4919-b321-d0c6300d885e", // Beginner session (2)
  "c56088da-2aa3-4b75-a94b-bebe69107904", // Kids session
]);

// Mapping von product_id zu session_type
const sessionTypes: Record<string, string> = {
  "b56e8b9a-548a-442c-abfe-5f03ecc7d789": "Beginner Surf Session (mit Haltestange)",
  "8690f2d5-6147-4d05-9f67-11503345775d": "Intermediate Surf Session",
  "69deb84b-c399-4a04-96ae-61834bd0830a": "Surfnight",
  "c56088da-2aa3-4b75-a94b-bebe69107904": "Kids Surf & Plantsch Session",
  "31e7c3ee-7025-4919-b321-d0c6300d885e": "Beginner Surfkurs",
  "06ce1656-58d5-49e4-9273-8a51b311ba39": "Trainingssession (Advanced/Pro)",
  "c07b8b50-d72e-451d-8ff5-7e8e0af1bbf2": "Exklusiv Session",
  "411bd098-dc9d-41b0-869d-1f22b5b4e9b9": "Exklusiv Session",
  "582ba730-f594-4929-9b52-62bcd27bb936": "Wave and Rave",
  "a9c98e05-6f2f-4b16-8c10-5137eff2f73f": "Exklusiv Session",
  "ab115d7f-f0ed-4c3f-810f-fc97b3fe72f5": "Berlin Surf Open 2.0",
  "8763fb79-6809-4387-8d56-9fdf883b1373": "Berlin Surf Open 2.0",
  "214fe50d-3df3-4e99-8b5d-608f1df03126": "Trainingssession (30 Minuten/6 Pax) (Advanced/Pro)",
};

// Cache laden
async function loadCache() {
  const { data, error } = await supabase
    .from("session_cache")
    .select("data")
    .eq("id", "cache")
    .single();

  if (error || !data) {
    console.error("⚠️ Es wurde kein Cache geladen:", error?.message || "Keine Daten gefunden");
    return {};
  }

  console.log("✅ Cache geladen:", data.data);
  return data.data || {};
}

// Cache speichern
async function saveCache(cache: Record<string, any>) {
  const { error } = await supabase
    .from("session_cache")
    .upsert([
      { 
        id: "cache", 
        updated_at: new Date().toISOString(), 
        data: cache 
      }
    ]);

  if (error) {
    console.error("❌ Fehler beim Speichern des Caches:", error.message || error);
    return false;
  }

  console.log("✅ Cache erfolgreich gespeichert");
  return true;
}

// Datumsbereich berechnen (heute bis Sonntag in 4 Wochen)
function getDateRange(): { start: string; end: string } {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 4 * 7 + (6 - today.getDay())); // Sonntag in 4 Wochen
  return {
    start: today.toISOString().split("T")[0],
    end: endDate.toISOString().split("T")[0],
  };
}

// API-Aufruf für Timeslots
async function fetchTimeslots() {
  const { start, end } = getDateRange();
  const apiUrl = `https://api.bookinglayer.io/public/calendars/surf-calendar/timeslots?start=${start}&end=${end}&currency=EUR&business_domain=bookings.wellenwerk-berlin.de`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`API-Fehler: ${response.statusText}`);
    const data = await response.json();
    return data?.data?.timeslots ?? [];
  } catch (error) {
    console.error("❌ Fehler beim Abrufen der API-Daten:", error);
    return [];
  }
}

// Hash-Funktion für die Session-ID
async function generateSessionId(sessionId: string, sessionStart: string): Promise<string> {
  const data = new TextEncoder().encode(`${sessionId}_${sessionStart}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Funktion zum Abrufen der Verfügbarkeit
async function getAvailability(sessionId: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("availability")
    .eq("id", sessionId)
    .single();

  if (error) {
    console.error("❌ Fehler beim Abrufen der Verfügbarkeit:", error);
    return [];
  }

  return data?.availability || [];  // Rückgabe des Verfügbarkeits-Arrays
}

// Funktion, die Sessions mit der letzten Verfügbarkeit zurückgibt
async function fetchSessionsLastAvailability() {
  // Fetch data from sessions table (only id and last availability for sessions with start_time in the future)
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, availability")
    .gt("start_time", new Date().toISOString());

  if (error) {
    console.error("❌ Fehler beim Abrufen der Sessions:", error);
    throw new Error("❌ Fehler beim Abrufen der Sessions");
  }

  // Iterate over sessions and get the latest availability entry
  const updatedSessions: Record<string, { availability: number }> = {};

  sessions.forEach(session => {
    if (session.availability && Array.isArray(session.availability)) {
      // Sort the availability array by timestamp (latest first) and take the first entry
      const latestAvailability = session.availability
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

      // Add the session id and last availability to the result object
      updatedSessions[session.id] = {
        availability: latestAvailability ? latestAvailability.available_slots : null
      };
    }
  });

  console.log("✅ Sessions mit letzter Verfügbarkeit geladen:", updatedSessions);

  return updatedSessions;
}

// Edge Function starten
serve(async () => {
  console.log("⏳ Lade Cache...");
  let sessionCache = await loadCache();

  if (Object.keys(sessionCache).length === 0) {
    console.log("⚠️ Cache ist leer oder konnte nicht geladen werden. Befülle den Cache...");
    // Erstelle den Cache, indem die letzten Verfügbarkeiten der Sessions abgerufen werden
    sessionCache = await fetchSessionsLastAvailability();
  }

  console.log("📡 API-Aufruf für Timeslots...");
  let timeslots = await fetchTimeslots();
  if (timeslots.length === 0) return new Response("❌ Keine Daten gefunden", { status: 500 });

  // Filtere die ausgeschlossenen Sessions heraus
  timeslots = timeslots.filter((slot) => !excludedSessions.has(slot.product_id));

  console.log(`✅ ${timeslots.length} relevante Timeslots nach Filterung`);

  let sessionCacheUpdated = {};

  // Verarbeite Timeslots
  for (const slot of timeslots) {
    try {
      // Start- und Endzeiten in Berlin-Zeit setzen
      const cetStartDate = DateTime.fromFormat(slot.start, "yyyy-MM-dd HH:mm:ss", { zone: "Europe/Berlin" }).toISO();
      const cetEndDate = DateTime.fromFormat(slot.end, "yyyy-MM-dd HH:mm:ss", { zone: "Europe/Berlin" }).toISO();

      if (!cetStartDate || !cetEndDate) {
        console.error(`❌ Fehler beim Konvertieren der Zeit für Slot:`, slot);
        continue; // Überspringe diesen Slot, falls die Zeit ungültig ist
      }

      slot.start = cetStartDate;
      slot.end = cetEndDate;

      // Session-ID generieren
      const sessionId = await generateSessionId(slot.product_id, slot.start);

      // Verfügbarkeit bestimmen
      const availableSlots = slot.availability;

      // Session-Typ bestimmen
      const sessionType = sessionTypes[slot.product_id] || "Unbekannter Session-Typ";

      // Im sessionCache nachsehen, ob die Verfügbarkeit bereits gespeichert ist
      const cachedAvailability = sessionCache[sessionId]?.availability ?? null;

      const newAvailabilityEntry = {
        timestamp: new Date().toISOString(),
        available_slots: availableSlots,
      };

      if ((cachedAvailability !== availableSlots || cachedAvailability == null) && new Date(slot.start) > new Date()) {
        // Wenn sich die Verfügbarkeit geändert hat oder noch keine Verfügbarkeit gespeichert ist, füge einen neuen Eintrag hinzu
        let availability = await getAvailability(sessionId);
        //console.log(`Availability for ${sessionId}:`, availability);
        availability.push(newAvailabilityEntry);
        const { error: upsertError } = await supabase
          .from("sessions")
          .upsert([
            {
              id: sessionId,
              session_id: slot.product_id,
              session_type: sessionType,
              start_time: slot.start,
              end_time: slot.end,
              availability: availability,
            }
          ], { onConflict: ["id"] });
        if (upsertError) {
          console.error(`❌ Fehler beim Upsert für Session ${sessionId}:`, upsertError);
        }
      }

      // Cache aktualisieren
      sessionCacheUpdated[sessionId] = {
        availability: availableSlots,
      };
    } catch (updateCacheError) {
      console.error("❌ Fehler beim Verarbeiten eines Timeslots:", updateCacheError);
    }
  }

  console.log("💾 Speichere aktualisierten Cache...");
  await saveCache(sessionCacheUpdated);

  return new Response("✅ Daten erfolgreich aktualisiert", { status: 200 });
});
