import { GoogleGenAI } from "@google/genai";
import { HOSPITALS, PLAN_CONFIG, SPECIALTY_NAMES, SYMPTOM_MAPPING } from "../src/constants";

type ChatHistoryItem = { role: "user" | "model"; parts: { text: string }[] };
type MedicalStructuredFields = {
  specialty: string;
  priority: "Alta" | "Media" | "Baja" | string;
  coverage: string;
  recommendation: string;
  copayEstimate: string;
  bestHospitalEconomically: string;
  hospitalsAcceptingInsurance: string[];
};

const HOSPITAL_LINES = HOSPITALS.map(
  (h) =>
    `- ${h.name} (${h.zone}): consulta USD ${h.cost.toFixed(
      2,
    )} -> copago del paciente con el plan (${PLAN_CONFIG.copay * 100}% de esa consulta) = USD ${(h.cost * PLAN_CONFIG.copay).toFixed(2)} exactos`,
).join("\n");

const CHEAPEST_GLOBAL = HOSPITALS.reduce((a, b) => (a.cost <= b.cost ? a : b));

const FORMAT_EXAMPLE_HOSPITALS = (["eugenio-espejo", "vozandes", "solca"] as const)
  .map((id) => HOSPITALS.find((h) => h.id === id))
  .filter((h): h is (typeof HOSPITALS)[number] => Boolean(h));
const COPAY_LINES_FORMAT_EXAMPLE = FORMAT_EXAMPLE_HOSPITALS.map(
  (h) => `${h.name}: copago USD ${(h.cost * PLAN_CONFIG.copay).toFixed(2)}`,
).join("\\n");
const HOSPITAL_NAMES_FORMAT_EXAMPLE_JSON = JSON.stringify(FORMAT_EXAMPLE_HOSPITALS.map((h) => h.name));
const BEST_IN_FORMAT_EXAMPLE = FORMAT_EXAMPLE_HOSPITALS.reduce((a, b) => (a.cost <= b.cost ? a : b)).name;
const SYMPTOM_SPECIALTY_LINES = (Object.keys(SYMPTOM_MAPPING) as (keyof typeof SYMPTOM_MAPPING)[])
  .map(
    (k) =>
      `  - Indicios (${SYMPTOM_MAPPING[k].slice(0, 5).join(", ")}, ...) -> orientacion tipica: ${SPECIALTY_NAMES[k] ?? k}`,
  )
  .join("\n");

const SYSTEM_INSTRUCTION = `
Eres el agente conversacional de beneficios medicos SaludPredict AI para pacientes en Ecuador.

OBJETIVO
1. El paciente describe su sintoma.
2. Sugieres la especialidad para consulta en hospital/red.
3. Cruzas con el plan y eliges entre 3 y 4 hospitales de la tabla segun contexto clinico-logistico y costo/beneficio.
4. Calculas copagos exactos para esos 3-4.
5. bestHospitalEconomically debe ser el menor copago dentro de los recomendados.

PLAN
- Plan simulado: ${PLAN_CONFIG.name}
- Cobertura referencia: ${(PLAN_CONFIG.coverage * 100).toFixed(0)}%
- Copago paciente: ${PLAN_CONFIG.copay * 100}% del costo de consulta del hospital.
- Formula: copago = costo * ${PLAN_CONFIG.copay}

TABLA MAESTRA
${HOSPITAL_LINES}

DATO OPCIONAL
- Menor copago global: ${CHEAPEST_GLOBAL.name} (USD ${(CHEAPEST_GLOBAL.cost * PLAN_CONFIG.copay).toFixed(2)}).

REFERENCIA SINTOMAS
${SYMPTOM_SPECIALTY_LINES}

REGLAS
- hospitalsAcceptingInsurance: exactamente 3 o 4 hospitales de la tabla.
- copayEstimate: solo esas mismas 3 o 4 lineas, separadas por \\n.
- En emergencia vital, una frase practica de urgencias.
- Idioma: espanol (Ecuador).
- Texto libre: maximo 2 frases antes del JSON.

SALIDA
\`\`\`json
{"specialty":"Neurologia","priority":"Media","coverage":"Una frase con plan y porcentajes.","recommendation":"Maximo 2 frases.","copayEstimate":"${COPAY_LINES_FORMAT_EXAMPLE}","bestHospitalEconomically":"${BEST_IN_FORMAT_EXAMPLE}","hospitalsAcceptingInsurance":${HOSPITAL_NAMES_FORMAT_EXAMPLE_JSON}}
\`\`\`
`;

function parseStructuredBlock(raw: string): { displayText: string; structured: MedicalStructuredFields | null } {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonCandidate = fenceMatch ? fenceMatch[1].trim() : null;

  const normalizeCopayEstimate = (v: unknown): string | null => {
    if (typeof v === "string") return v.trim();
    if (Array.isArray(v)) return v.map(String).join("\n").trim();
    return null;
  };

  const tryParse = (s: string): MedicalStructuredFields | null => {
    try {
      const o = JSON.parse(s) as Record<string, unknown>;
      const copayEstimate = normalizeCopayEstimate(o.copayEstimate);
      if (
        typeof o.specialty === "string" &&
        typeof o.priority === "string" &&
        typeof o.coverage === "string" &&
        typeof o.recommendation === "string" &&
        copayEstimate &&
        typeof o.bestHospitalEconomically === "string" &&
        Array.isArray(o.hospitalsAcceptingInsurance)
      ) {
        return {
          specialty: o.specialty.trim(),
          priority: o.priority.trim(),
          coverage: o.coverage.trim(),
          recommendation: o.recommendation.trim(),
          copayEstimate,
          bestHospitalEconomically: o.bestHospitalEconomically.trim(),
          hospitalsAcceptingInsurance: o.hospitalsAcceptingInsurance.map(String),
        };
      }
    } catch {
      return null;
    }
    return null;
  };

  let structured: MedicalStructuredFields | null = null;
  let displayText = raw.trim();
  if (jsonCandidate) {
    structured = tryParse(jsonCandidate);
    if (structured && fenceMatch) displayText = raw.slice(0, fenceMatch.index).trim();
  }
  if (!structured) {
    const brace = raw.lastIndexOf("{");
    const end = raw.lastIndexOf("}");
    if (brace >= 0 && end > brace) {
      const slice = raw.slice(brace, end + 1);
      structured = tryParse(slice);
      if (structured) displayText = raw.slice(0, brace).trim();
    }
  }
  return { displayText: displayText || raw.trim(), structured };
}

function getModelCandidates(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  const defaults = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash",
    "gemini-flash-latest",
  ];
  const list = [fromEnv, ...defaults].filter((m): m is string => Boolean(m));
  return [...new Set(list)];
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido." });
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Falta GEMINI_API_KEY en variables del servidor." });
    return;
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const userMessage = String(body.userMessage ?? "");
  const history = Array.isArray(body.history) ? (body.history as ChatHistoryItem[]) : [];

  try {
    const ai = new GoogleGenAI({ apiKey });
    let lastError = "";
    for (const model of getModelCandidates()) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            ...history.map((h) => ({ role: h.role, parts: h.parts })),
            { role: "user", parts: [{ text: userMessage }] },
          ],
          config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.45 },
        });
        const rawText = response.text ?? "";
        const parsed = parseStructuredBlock(rawText);
        res.status(200).json({ displayText: parsed.displayText, structured: parsed.structured, rawText });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    res.status(502).json({ error: `Gemini no respondio con modelos disponibles. ${lastError}` });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Error del servidor IA: ${msg}` });
  }
}
