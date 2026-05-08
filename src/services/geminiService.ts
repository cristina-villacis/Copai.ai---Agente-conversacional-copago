/** Campos estructurados que el frontend muestra en tarjetas (parseados del JSON de Gemini). */
export type MedicalStructuredFields = {
  specialty: string;
  priority: "Alta" | "Media" | "Baja" | string;
  coverage: string;
  recommendation: string;
  copayEstimate: string;
  bestHospitalEconomically: string;
  hospitalsAcceptingInsurance: string[];
};

export type MedicalAgentResult = {
  /** Texto para el globo del chat (sin el bloque JSON). */
  displayText: string;
  structured: MedicalStructuredFields | null;
  /** Texto crudo del modelo (depuración). */
  rawText: string;
};
/**
 * Llama a la API serverless /api/chat (Gemini en backend privado).
 */
export async function getMedicalAgentResponse(
  userMessage: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[] = [],
): Promise<MedicalAgentResult> {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage, history }),
    });
    const raw = await response.text();
    let json: (Partial<MedicalAgentResult> & { error?: string }) | null = null;
    try {
      json = JSON.parse(raw) as Partial<MedicalAgentResult> & { error?: string };
    } catch {
      json = null;
    }
    if (!response.ok) {
      return {
        displayText:
          json?.error ||
          `No se pudo consultar el agente IA (HTTP ${response.status}).`,
        structured: null,
        rawText: "",
      };
    }
    if (!json) {
      return {
        displayText:
          "Respuesta invalida del servidor IA. Verifica configuracion de rutas en Vercel (/api/chat).",
        structured: null,
        rawText: raw,
      };
    }
    return {
      displayText: json.displayText || "No se pudo generar respuesta del agente IA en este momento.",
      structured: json.structured ?? null,
      rawText: json.rawText || "",
    };
  } catch (error) {
    console.error("API /api/chat error:", error);
    return {
      displayText: "Servicio de IA no disponible temporalmente. Intenta nuevamente en unos segundos.",
      structured: null,
      rawText: "",
    };
  }
}

/** @deprecated usar getMedicalAgentResponse */
export async function getChatResponse(
  userMessage: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[] = [],
) {
  const r = await getMedicalAgentResponse(userMessage, history);
  return r.displayText + (r.structured ? `\n\n[Datos parseados disponibles]` : "");
}
