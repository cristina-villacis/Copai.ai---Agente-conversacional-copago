import { GoogleGenAI } from "@google/genai";
import { HOSPITALS, PLAN_CONFIG, SPECIALTY_NAMES, SYMPTOM_MAPPING } from "../constants";

const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
const geminiApiKey =
  viteEnv?.VITE_GEMINI_API_KEY ||
  (typeof process !== "undefined" ? process.env.GEMINI_API_KEY : "");

/** Orden: variable opcional, luego modelos estables típicos del Developer API (AI Studio). */
function getModelCandidates(): string[] {
  const fromEnv = viteEnv?.VITE_GEMINI_MODEL?.trim();
  const defaults = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
  ];
  const list = [fromEnv, ...defaults].filter((m): m is string => Boolean(m));
  return [...new Set(list)];
}

function formatGeminiError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

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

const HOSPITAL_LINES = HOSPITALS.map(
  (h) =>
    `- ${h.name} (${h.zone}): consulta USD ${h.cost.toFixed(
      2,
    )} → copago del paciente con el plan (${PLAN_CONFIG.copay * 100}% de esa consulta) = USD ${(h.cost * PLAN_CONFIG.copay).toFixed(2)} exactos`,
).join("\n");

const CHEAPEST_GLOBAL = HOSPITALS.reduce((a, b) => (a.cost <= b.cost ? a : b));

/** Tres hospitales solo para el EJEMPLO de formato JSON (el agente debe elegir otros en producción según el caso). */
const FORMAT_EXAMPLE_HOSPITALS = (['eugenio-espejo', 'vozandes', 'solca'] as const)
  .map((id) => HOSPITALS.find((h) => h.id === id))
  .filter((h): h is (typeof HOSPITALS)[number] => Boolean(h));

const COPAY_LINES_FORMAT_EXAMPLE = FORMAT_EXAMPLE_HOSPITALS.map(
  (h) => `${h.name}: copago USD ${(h.cost * PLAN_CONFIG.copay).toFixed(2)}`,
).join("\\n");

const HOSPITAL_NAMES_FORMAT_EXAMPLE_JSON = JSON.stringify(FORMAT_EXAMPLE_HOSPITALS.map((h) => h.name));

/** Menor copago entre el subconjunto del ejemplo (solo ilustrativo). */
const BEST_IN_FORMAT_EXAMPLE = FORMAT_EXAMPLE_HOSPITALS.reduce((a, b) =>
  a.cost <= b.cost ? a : b,
).name;

const SYMPTOM_SPECIALTY_LINES = (
  Object.keys(SYMPTOM_MAPPING) as (keyof typeof SYMPTOM_MAPPING)[]
)
  .map(
    (k) =>
      `  • Indicios (${SYMPTOM_MAPPING[k].slice(0, 5).join(", ")}, ...) → orientacion tipica hacia consulta externa / especialidad hospitalaria referida: **${SPECIALTY_NAMES[k] ?? k}**`,
  )
  .join("\n");

const SYSTEM_INSTRUCTION = `
Eres el **agente conversacional** de beneficios médicos **SaludPredict AI** para pacientes en **Ecuador**.

## Objetivo (único foco del producto)
Ayudar al paciente a **entender su beneficio económico ANTES de atenderse**, de forma conversacional:
1. El paciente describe su **síntoma**.
2. Tú sugieres la **especialidad** que conviene valorar primero **en una consulta especializada dentro de hospital / red**.
3. **Cruzas el caso con el plan** y, **buscando en la tabla maestra** (base simulada), **eliges tú** **entre 3 y 4 hospitales** que mejor encajen con lo que dijo el paciente: síntoma, prioridad, zona o ciudad si la mencionó, tipo de centro (ej. referencia pública vs clínica), distancia aproximada inferida de la **zona** del hospital, y equilibrio costo/beneficio. **No** devuelvas la lista completa de la red.
4. Para esos 3-4 hospitales indicas copago exacto según tabla. **bestHospitalEconomically** = nombre del hospital **con menor copago entre los que tú recomendaste** en esta respuesta (no copy-pastes una lista fija del sistema).
5. Sé claro que es DEMO: solo puedes usar hospitales que existan en la tabla siguiente; pero **cuáles recomiendas y por qué (breve)** lo decides tú según contexto — **no hay una recomendacion preprogramada en codigo**.

## Tu plan/datos financieros fijos para este chat (DEBES USARLOS)
- **Plan simulado:** "${PLAN_CONFIG.name}".
- **Cobertura del plan sobre el costo de la consulta (referencia):** ${(PLAN_CONFIG.coverage * 100).toFixed(0)}% cubierto por el plan (el paciente suele enfocarse en copago saliente).
- **Copago del paciente sobre el costo de consulta tarifado:** **${PLAN_CONFIG.copay * 100}%** del costo de consulta de cada hospital = **cargo directo estimado**.
- Formula obligatoria: **copago_paciente_USD = costo_consulta_USD_del_hospital × ${PLAN_CONFIG.copay}** (presenta resultado con dos decimales).

## Tabla maestra (USD) — **única fuente**: busca aquí nombres y copagos; no inventes hospitales ni cifras
${HOSPITAL_LINES}

### Dato util (no obligatorio usarlo en cada respuesta)
En **toda** la tabla, el menor copago posible es **${CHEAPEST_GLOBAL.name}** (USD ${(CHEAPEST_GLOBAL.cost * PLAN_CONFIG.copay).toFixed(2)}). Solo inclúyelo en tus 3-4 si encaja con el caso o si el usuario pide explícitamente lo más barato; si priorizas cercanía (zona Sur, Valle, etc.) u otro criterio, puedes recomendar otros aunque cuesten un poco más.

## Especialidades de referencia (orientacion por sintomas frecuentes; no es diagnostico clinico legal)
No diagnosticas; sugieres **donde dirigir la consulta especializada**.
${SYMPTOM_SPECIALTY_LINES}
Para otros síntomas, elige especialidad plausible (medicina general/urgencias vs especialidad médica típica) y di que el médico debe confirmar.

## Reglas obligatorias
1. **hospitalsAcceptingInsurance**: exactamente **3 o 4** nombres, **literales** de la tabla (sin typos).
2. **copayEstimate**: **solo** esas mismas 3 u 4 lineas con copagos **exactos** de la tabla, separadas por \\n.
3. **bestHospitalEconomically**: el nombre **entre tus 3-4** con menor copago (si hay empate, uno solo).
4. Emergencia vital: 1 frase practica + urgencias/911; en JSON igualmente 3-4 hospitales solo si tiene sentido como seguimiento ambulatorio, si no deja urgency note en recommendation.
5. Idioma: **español (Ecuador)**.

## BREVEDAD (CRITICO — la UI ya muestra cuadros con los datos)
- **Texto libre ANTES del JSON:** como máximo **2 frases cortas** (ideal 1). Directo a lo que el usuario escribió.
- **No saludar** con "Hola" ni frases de relleno si el usuario no saludó.
- **No repitas** en el texto lo que irá en el JSON: especialidad, prioridad, cobertura, copagos por hospital, hospital economico y recomendaciones van **solo** en los campos JSON (el usuario los ve en cuadros).
- **Prohibido** en el texto libre: listas con viñetas, párrafos largos, markdown **negritas**, o repetir "Plan Básico Plus" y tablas de hospitales.
- Los **montos exactos USD** de cada hospital van **unicamente** en **copayEstimate** (string multilinea), nunca repartidos en párrafos antes del JSON.

## Campos JSON (contenido, no repitas en el texto libre)
- **specialty:** solo el nombre de la especialidad (ej. Neurología).
- **priority:** solo una palabra: Alta | Media | Baja (o Muy alta si emergencia).
- **coverage:** **una sola frase** con plan "${PLAN_CONFIG.name}", ~${(PLAN_CONFIG.coverage * 100).toFixed(0)}% cobertura referida sobre consulta y copago paciente **${PLAN_CONFIG.copay * 100}%** del costo tarifado por hospital.
- **recommendation:** **máximo 2 frases** (cita, observacion, urgencias, o **por qué** orientas a esas zonas/centros); sin listar otra vez los montos.
- **copayEstimate:** STRING (no array). **3 o 4 lineas** (las de tu seleccion), formato:
  "Nombre oficial: copago USD XX.YY"
- **hospitalsAcceptingInsurance:** array de **3 o 4** strings, los mismos hospitales que en copayEstimate.

FORMATO DE SALIDA — SIEMPRE
1) Texto libre: **≤2 frases**, al grano respecto al mensaje del usuario.
2) Bloque JSON final (sin texto después):

\`\`\`json
{"specialty":"Neurología","priority":"Media","coverage":"Una frase con plan y porcentajes como arriba.","recommendation":"Máx. 2 frases; puedes aludir a zona o tipo de centro.","copayEstimate":"${COPAY_LINES_FORMAT_EXAMPLE}","bestHospitalEconomically":"${BEST_IN_FORMAT_EXAMPLE}","hospitalsAcceptingInsurance":${HOSPITAL_NAMES_FORMAT_EXAMPLE_JSON}}
\`\`\`
(Ejemplo anterior: **3 hospitales** y formato; **tus** elecciones reales deben variar segun cada mensaje del paciente.)
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
      /* ignore */
    }
    return null;
  };

  let structured: MedicalStructuredFields | null = null;
  let displayText = raw.trim();

  if (jsonCandidate) {
    structured = tryParse(jsonCandidate);
    if (structured && fenceMatch) {
      displayText = raw.slice(0, fenceMatch.index).trim();
    }
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

/**
 * Llama a Gemini con instrucciones de SaludPredict AI y parsea respuesta + JSON estructurado.
 */
export async function getMedicalAgentResponse(
  userMessage: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[] = [],
): Promise<MedicalAgentResult> {
  try {
    if (!geminiApiKey) {
      return {
        displayText:
          "Configura la variable VITE_GEMINI_API_KEY en tu archivo .env.local y reinicia el servidor (npm run dev).",
        structured: null,
        rawText: "",
      };
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const contents = [
      ...history.map((h) => ({ role: h.role, parts: h.parts })),
      { role: "user" as const, parts: [{ text: userMessage }] },
    ];
    const config = {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.45,
    };

    let lastError = "";
    for (const model of getModelCandidates()) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });

        const rawText = response.text ?? "";
        const { displayText, structured } = parseStructuredBlock(rawText);

        return { displayText, structured, rawText };
      } catch (error) {
        lastError = formatGeminiError(error);
        console.error(`Gemini API Error (modelo ${model}):`, error);
      }
    }

    return {
      displayText: [
        "No se pudo obtener respuesta de Gemini con ninguno de los modelos probados.",
        `Detalle: ${lastError || "error desconocido"}`,
        "",
        "Comprueba en Google AI Studio que la API key sea válida y que en “Restricciones de la aplicación” permitas tu origen (p. ej. http://localhost:3000) si usas la app en el navegador.",
        "Opcional: define VITE_GEMINI_MODEL con un modelo concreto (ej. gemini-2.5-flash) en .env.local y reinicia npm run dev.",
      ].join("\n"),
      structured: null,
      rawText: "",
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      displayText: `Error inesperado al llamar a Gemini: ${formatGeminiError(error)}`,
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
