/**
 * Business Rules for the Copay and Coverage Estimator.
 */

export const PLAN_CONFIG = {
  name: "Plan Básico Plus",
  coverage: 0.7, // 70%
  copay: 0.3,    // 30%
};

export const SYMPTOM_MAPPING = {
  gastroenterology: ["dolor de estómago", "acidez", "náuseas", "estómago", "panza", "digestión"],
  neurology: ["dolor de cabeza", "migraña", "mareos", "jaqueca", "cerebro"],
  traumatology: ["dolor de huesos", "golpes", "esguinces", "fractura", "luxación", "huesos", "músculos"],
};

export const HOSPITALS = [
  { id: "san-juan", name: "Hospital San Juan", zone: "Zona Norte", cost: 50.0 },
  { id: "central-universitario", name: "Hospital Central Universitario", zone: "Zona Centro", cost: 40.0 },
  { id: "la-paz", name: "Clínica La Paz", zone: "Zona Sur", cost: 70.0 },
  { id: "metropolitano", name: "Hospital Metropolitano", zone: "Zona Norte", cost: 55.0 },
  { id: "vozandes", name: "Hospital Vozandes", zone: "Zona Centro", cost: 48.0 },
  { id: "pichincha-internacional", name: "Clínica Internacional Pichincha", zone: "Zona Centro", cost: 46.0 },
  { id: "eugenio-espejo", name: "Hospital Eugenio Espejo", zone: "Centro Norte", cost: 53.0 },
  { id: "solca", name: "Solca Quito", zone: "Valle de Chillos", cost: 67.0 },
  { id: "militar", name: "Hospital Militar Regional", zone: "Zona Norte", cost: 44.0 },
  { id: "los-valles", name: "Hospital de Los Valles", zone: "Cumbayá", cost: 59.0 },
  { id: "santa-rosa", name: "Hospital Santa Rosa de Tacuri", zone: "Zona Sur", cost: 72.0 },
];

export const SPECIALTY_NAMES: Record<string, string> = {
  gastroenterology: "Gastroenterología",
  neurology: "Neurología",
  traumatology: "Traumatología",
};
