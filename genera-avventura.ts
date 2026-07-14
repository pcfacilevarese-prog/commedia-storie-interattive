// Edge Function: genera-avventura
// Riceve la cronologia della conversazione + il prompt di sistema, e genera
// il turno successivo della storia interattiva usando Groq (Llama 3.3 70B).
// La chiave API resta lato server: chi visita il sito non deve fornirne una propria.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verifica che la richiesta arrivi da un utente autenticato (stesso pattern di estrai-cv)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Accesso non autorizzato." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { systemInstruction, messaggi } = await req.json();

    if (!systemInstruction || !Array.isArray(messaggi)) {
      return new Response(JSON.stringify({ error: "Richiesta non valida." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: "Chiave Groq non configurata sul server." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Groq usa il formato messaggi stile OpenAI: { role: "system"|"user"|"assistant", content: "..." }
    const messaggiCompleti = [
      { role: "system", content: systemInstruction },
      ...messaggi,
    ];

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messaggiCompleti,
        temperature: 0.85,
        max_tokens: 700,
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      return new Response(JSON.stringify({ error: "Errore Groq: " + errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groqData = await groqResponse.json();
    const testoGenerato = groqData.choices[0].message.content;

    return new Response(JSON.stringify({ testo: testoGenerato }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
