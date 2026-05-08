import { type FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Brain,
  BrainCircuit,
  Building2,
  Check,
  CircleDollarSign,
  Clock3,
  Cog,
  Compass,
  Eye,
  EyeOff,
  HeartPulse,
  History,
  Hospital,
  Layers,
  LogOut,
  Loader2,
  Lock,
  MapPin,
  Search,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react';
import { HOSPITALS as HOSPITAL_NETWORK, PLAN_CONFIG } from './constants';
import { getMedicalAgentResponse, type MedicalStructuredFields } from './services/geminiService';

type Screen = 'landing' | 'login' | 'dashboard';

type MenuEntry =
  | { id: Exclude<string, 'logout'>; label: string; icon: LucideIcon }
  | { id: 'logout'; label: string; icon: LucideIcon; logout: true };

type HospitalItem = {
  id: string;
  name: string;
  address: string;
  specialties: string[];
  eta: string;
  copay: number;
  coverage: number;
  badge: 'Mas economico' | 'Mejor cobertura' | 'Recomendado IA' | 'Mas cercano';
  top?: string;
  left?: string;
  distanceKm?: number;
};

/** Red hospitalaria alineada con el agente IA (constants) + datos de UI (mapas, ETA demo). */
function buildHospitalCatalog(): HospitalItem[] {
  const geo: Record<string, { top: string; left: string; eta: string; distanceKm: number }> = {
    'san-juan': { top: '16%', left: '54%', eta: '11 min', distanceKm: 3.8 },
    'central-universitario': { top: '40%', left: '44%', eta: '8 min', distanceKm: 2 },
    'la-paz': { top: '68%', left: '58%', eta: '16 min', distanceKm: 5.1 },
    metropolitano: { top: '12%', left: '71%', eta: '13 min', distanceKm: 4.2 },
    vozandes: { top: '36%', left: '58%', eta: '10 min', distanceKm: 2.8 },
    'pichincha-internacional': { top: '48%', left: '36%', eta: '9 min', distanceKm: 2.2 },
    'eugenio-espejo': { top: '30%', left: '68%', eta: '11 min', distanceKm: 3.1 },
    solca: { top: '78%', left: '46%', eta: '22 min', distanceKm: 8.5 },
    militar: { top: '24%', left: '40%', eta: '14 min', distanceKm: 4.5 },
    'los-valles': { top: '52%', left: '78%', eta: '18 min', distanceKm: 6.2 },
    'santa-rosa': { top: '60%', left: '26%', eta: '19 min', distanceKm: 6.8 },
  };
  const specs: Record<string, string[]> = {
    'san-juan': ['Consulta especializada', 'Zona Norte'],
    'central-universitario': ['Consulta especializada', 'Centro'],
    'la-paz': ['Consulta especializada', 'Urgencias'],
    metropolitano: ['Alto volumen', 'Multiespecialidad'],
    vozandes: ['Consulta especializada', 'Imagen'],
    'pichincha-internacional': ['Consulta especializada', 'Centro'],
    'eugenio-espejo': ['Hospital público referencia', 'Centro Norte'],
    solca: ['Oncología', 'Valle'],
    militar: ['Consulta especializada', 'Zona Norte'],
    'los-valles': ['Cumbayá', 'Consulta'],
    'santa-rosa': ['Consulta especializada', 'Sur'],
  };
  const cheapest = HOSPITAL_NETWORK.reduce((a, b) => (a.cost <= b.cost ? a : b));
  const covPct = Math.round(PLAN_CONFIG.coverage * 100);

  return HOSPITAL_NETWORK.map((h) => {
    const g = geo[h.id] ?? { top: '50%', left: '50%', eta: '12 min', distanceKm: 3 };
    return {
      id: h.id,
      name: h.name,
      address: `${h.zone}, Quito`,
      specialties: specs[h.id] ?? ['Consulta especializada'],
      eta: g.eta,
      copay: Math.round(h.cost * PLAN_CONFIG.copay),
      coverage: covPct,
      badge: h.id === cheapest.id ? ('Mas economico' as const) : ('Recomendado IA' as const),
      top: g.top,
      left: g.left,
      distanceKm: g.distanceKm,
    };
  });
}

function normalizeHospitalName(name: string) {
  return name.trim().toLowerCase();
}

type LoginForm = {
  username: string;
  password: string;
  remember: boolean;
};

type Message = {
  id: string;
  role: 'user' | 'ai';
  text: string;
  structured?: MedicalStructuredFields | null;
};

type InsurancePlan = {
  id: 'actual' | 'recomendado' | 'ahorro';
  name: string;
  coverage: number;
  emergencies: string;
  specialists: string;
  telemedicine: string;
  hospitalsAffiliated: number;
  monthlyPrice: number;
  averageCopay: number;
  badge: 'Tu plan actual' | 'Mas recomendado' | 'Mayor ahorro';
  highlight: string;
};
const hospitalCatalogSeed = buildHospitalCatalog();

const partners = ['SaludTotal', 'Ecuasanitas', 'Humana', 'BMI', 'BlueCard', 'NovaSalud'];
const menuItems: MenuEntry[] = [
  { id: 'chat', label: 'Chat IA', icon: Bot },
  { id: 'hospitales', label: 'Hospitales', icon: Hospital },
  { id: 'coberturas', label: 'Coberturas', icon: Layers },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'config', label: 'Configuracion', icon: Cog },
  { id: 'logout', label: 'Cerrar sesion', icon: LogOut, logout: true },
];

const initialMessages: Message[] = [];
const plans: InsurancePlan[] = [
  {
    id: 'actual',
    name: 'Plan Vital Plus',
    coverage: 72,
    emergencies: 'Hasta $8,000',
    specialists: '18 especialidades',
    telemedicine: 'Incluida 24/7',
    hospitalsAffiliated: 21,
    monthlyPrice: 46,
    averageCopay: 24,
    badge: 'Tu plan actual',
    highlight: 'Ideal para mantener tu cobertura actual con costo controlado.',
  },
  {
    id: 'recomendado',
    name: 'Plan Smart Care Pro',
    coverage: 84,
    emergencies: 'Hasta $20,000',
    specialists: '34 especialidades',
    telemedicine: 'Prioritaria + receta digital',
    hospitalsAffiliated: 39,
    monthlyPrice: 68,
    averageCopay: 17,
    badge: 'Mas recomendado',
    highlight: 'Mejor equilibrio entre red hospitalaria, copago y cobertura.',
  },
  {
    id: 'ahorro',
    name: 'Plan Ahorro Activo',
    coverage: 66,
    emergencies: 'Hasta $6,000',
    specialists: '12 especialidades',
    telemedicine: 'Incluida',
    hospitalsAffiliated: 16,
    monthlyPrice: 34,
    averageCopay: 28,
    badge: 'Mayor ahorro',
    highlight: 'Cuota mensual mas baja para pacientes de bajo riesgo.',
  },
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
  const [query, setQuery] = useState('dolor toracico');
  const [filters, setFilters] = useState({
    specialty: 'Cardiologia',
    city: 'Quito',
    copay: '< $20',
    coverage: '> 70%',
    distance: '< 10 km',
  });
  const [form, setForm] = useState<LoginForm>({ username: '', password: '', remember: false });
  const [showPassword, setShowPassword] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAnalyzingCoverage, setIsAnalyzingCoverage] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [activeMenu, setActiveMenu] = useState('chat');
  const [showHospitalSkeletons, setShowHospitalSkeletons] = useState(false);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<InsurancePlan['id']>('recomendado');
  const [latestAgentRecommendation, setLatestAgentRecommendation] = useState<MedicalStructuredFields | null>(null);

  const hospitalCatalog = useMemo(() => hospitalCatalogSeed, []);

  const sortedHospitals = useMemo(() => [...hospitalCatalog].sort((a, b) => b.coverage - a.coverage), [hospitalCatalog]);

  const recommendedSidebarHospitals = useMemo((): HospitalItem[] => {
    const s = latestAgentRecommendation;
    if (!s?.hospitalsAcceptingInsurance?.length) return [];

    const resolveCatalogEntry = (raw: string): HospitalItem | undefined => {
      const n = normalizeHospitalName(raw);
      const exact = hospitalCatalog.find((h) => normalizeHospitalName(h.name) === n);
      if (exact) return exact;
      return hospitalCatalog.find(
        (h) => n.includes(normalizeHospitalName(h.name)) || normalizeHospitalName(h.name).includes(n),
      );
    };

    const bestNorm = normalizeHospitalName(s.bestHospitalEconomically);
    const orderNames = [...new Set([s.bestHospitalEconomically.trim(), ...s.hospitalsAcceptingInsurance.map(String)])];

    const seen = new Set<string>();
    const out: HospitalItem[] = [];
    for (const nm of orderNames) {
      const base = resolveCatalogEntry(nm.trim());
      if (!base || seen.has(base.id)) continue;
      seen.add(base.id);
      const nameNorm = normalizeHospitalName(base.name);
      const isBest = bestNorm === nameNorm || bestNorm.includes(nameNorm) || nameNorm.includes(bestNorm);
      out.push({
        ...base,
        badge: isBest ? 'Mas economico' : 'Recomendado IA',
      });
    }
    return out;
  }, [latestAgentRecommendation, hospitalCatalog]);

  const handleLogout = () => {
    setCurrentScreen('landing');
    setMessages([]);
    setChatInput('');
    setLatestAgentRecommendation(null);
    setSelectedHospitalId(null);
    setActiveMenu('chat');
    setShowHospitalSkeletons(false);
  };

  const handleScheduleAppointment = (hospital: HospitalItem) => {
    setSelectedHospitalId(hospital.id);
    const when = new Date();
    when.setDate(when.getDate() + 2);
    const fecha = when.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' });
    showToast(`Cita agendada (demo): ${hospital.name}. Propuesta ${fecha} — te confirmamos hora por SMS.`);
  };

  const usernameError =
    attemptedSubmit || form.username.length > 0
      ? form.username.trim().length < 4
        ? 'Ingresa un usuario valido (minimo 4 caracteres).'
        : ''
      : '';
  const passwordError =
    attemptedSubmit || form.password.length > 0
      ? form.password.trim().length < 8
        ? 'La contrasena debe tener al menos 8 caracteres.'
        : ''
      : '';

  const isLoginValid = !usernameError && !passwordError && form.username.length > 0 && form.password.length > 0;
  const canSendChat = chatInput.trim().length > 4 && !isAiThinking;

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 2400);
  };

  const getPriorityTone = (priority: string) => {
    const p = priority.toLowerCase();
    if (p.includes('alta')) return 'border-rose-200 bg-rose-50 text-rose-700';
    if (p.includes('media')) return 'border-amber-200 bg-amber-50 text-amber-800';
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  };

  const getHospitalBadgeClass = (badge: HospitalItem['badge']) => {
    if (badge === 'Mas economico') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (badge === 'Mejor cobertura') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (badge === 'Mas cercano') return 'bg-sky-100 text-sky-700 border-sky-200';
    return 'bg-indigo-100 text-indigo-700 border-indigo-200';
  };

  const getPlanBadgeClass = (badge: InsurancePlan['badge']) => {
    if (badge === 'Tu plan actual') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (badge === 'Mas recomendado') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-indigo-100 text-indigo-700 border-indigo-200';
  };

  const getPlanPrice = (plan: InsurancePlan) =>
    billingCycle === 'annual' ? Math.round(plan.monthlyPrice * 12 * 0.84) : plan.monthlyPrice;

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttemptedSubmit(true);
    if (!isLoginValid) return;

    setIsLoggingIn(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setIsLoggingIn(false);
    setIsAnalyzingCoverage(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIsAnalyzingCoverage(false);
    setCurrentScreen('dashboard');
  };

  const handleChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSendChat) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: chatInput.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsAiThinking(true);
    setShowHospitalSkeletons(true);
    const history = messages.map((m) => ({
      role: m.role === 'ai' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })) as { role: 'user' | 'model'; parts: { text: string }[] }[];
    const result = await getMedicalAgentResponse(userMessage.text, history);

    if (result.displayText.includes('Falta GEMINI_API_KEY')) {
      showToast('Servicio IA no configurado en servidor. Configura GEMINI_API_KEY en Vercel.');
      setIsAiThinking(false);
      setShowHospitalSkeletons(false);
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text:
          result.displayText.trim() ||
          'No se pudo generar respuesta del agente IA en este momento.',
        structured: result.structured,
      },
    ]);
    if (result.structured) {
      setLatestAgentRecommendation(result.structured);
    }
    setIsAiThinking(false);
    setShowHospitalSkeletons(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#1E3A5F]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-120px] top-[-120px] h-72 w-72 rounded-full bg-[#0F6CBD]/20 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-120px] h-80 w-80 rounded-full bg-[#00B894]/20 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-7xl space-y-8 px-4 py-6 md:px-8 md:py-8">
        <AnimatePresence mode="wait">
          {currentScreen === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="space-y-8"
            >
              <section className="overflow-hidden rounded-[34px] border border-white/60 bg-gradient-to-br from-[#0F6CBD] to-[#1E3A5F] p-7 text-white shadow-[0_30px_80px_rgba(15,108,189,0.35)] md:p-10">
                <div className="grid items-center gap-8 md:grid-cols-2">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs">
                      <Sparkles className="h-3.5 w-3.5" />
                      SaludPredict AI · HealthTech Intelligence
                    </span>
                    <h1 className="mt-4 font-['Poppins'] text-4xl font-semibold leading-tight md:text-5xl">
                      Tu beneficio medico antes de llegar al hospital.
                    </h1>
                    <p className="mt-4 max-w-xl text-sm text-blue-100">
                      Describe tus sintomas: te orientamos sobre especialidad, cruza con tu plan simulado y muestra copagos
                      exactos en red y que hospital conviene mas economicamente.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        onClick={() => setCurrentScreen('login')}
                        className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#0F6CBD] transition hover:-translate-y-0.5 hover:bg-[#F3F8FF]"
                      >
                        Empezar ahora
                      </button>
                      <button
                        onClick={() => showToast('Demo comercial solicitada. Te contactaremos pronto.')}
                        className="rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white"
                      >
                        Solicitar demo para aseguradoras
                      </button>
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-md"
                  >
                    <div className="rounded-2xl bg-white/95 p-4 text-[#1E3A5F]">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">Mockup IA medica</p>
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                          En vivo
                        </span>
                      </div>
                      <div className="space-y-2 text-xs text-slate-600">
                        <p className="rounded-xl bg-slate-100 p-2">Sintoma: Dolor toracico + disnea</p>
                        <p className="rounded-xl bg-blue-50 p-2">Especialidad sugerida: Cardiologia (prioridad alta)</p>
                        <p className="rounded-xl bg-emerald-50 p-2">Copago estimado: $14 - $18</p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-4">
                {[
                  { title: 'Analiza sintomas', icon: Brain },
                  { title: 'Recomienda especialidad', icon: Stethoscope },
                  { title: 'Calcula copagos', icon: CircleDollarSign },
                  { title: 'Sugiere hospitales', icon: Hospital },
                ].map((item) => (
                  <motion.article
                    key={item.title}
                    whileHover={{ y: -3 }}
                    className="rounded-2xl border border-[#DFE8F3] bg-white p-4 shadow-sm"
                  >
                    <item.icon className="mb-2 h-5 w-5 text-[#0F6CBD]" />
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">Modelo IA entrenado para contexto medico.</p>
                  </motion.article>
                ))}
              </section>

              <section className="rounded-3xl border border-white/60 bg-gradient-to-r from-[#0F6CBD] to-[#00B894] p-7 text-white shadow-[0_20px_60px_rgba(0,184,148,0.25)]">
                <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <h3 className="font-['Poppins'] text-2xl font-semibold">Lleva tu red medica al siguiente nivel con IA.</h3>
                    <p className="mt-2 text-sm text-white/90">
                      Para pacientes, hospitales y aseguradoras que quieren decisiones mas rapidas y precisas.
                    </p>
                  </div>
                  <button
                    onClick={() => showToast('Agenda recibida. Un asesor te escribira hoy.')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#0F6CBD]"
                  >
                    Agendar demostracion <Users className="h-4 w-4" />
                  </button>
                </div>
              </section>
            </motion.div>
          )}

          {currentScreen === 'login' && (
            <motion.section
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="overflow-hidden rounded-[32px] border border-white/60 bg-white/70 shadow-[0_24px_70px_rgba(15,108,189,0.16)] backdrop-blur-xl"
            >
              <div className="grid items-stretch lg:grid-cols-2">
                <div className="relative hidden overflow-hidden bg-[#1E3A5F] p-10 text-white lg:block">
                  <div className="absolute inset-0 opacity-35">
                    <div className="absolute -left-16 top-12 h-56 w-56 rounded-full bg-[#00B894] blur-3xl" />
                    <div className="absolute -right-20 bottom-10 h-56 w-56 rounded-full bg-[#0F6CBD] blur-3xl" />
                  </div>
                  <div className="relative flex h-full flex-col">
                    <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-4 py-2">
                      <HeartPulse className="h-5 w-5 text-[#00B894]" />
                      <span className="font-semibold">SaludPredict AI</span>
                    </div>
                    <h2 className="font-['Poppins'] text-4xl font-semibold leading-tight">
                      Tu cobertura medica inteligente antes de atenderte.
                    </h2>
                    <p className="mt-4 text-sm text-slate-200">
                      Plataforma de decision clinica con IA para pacientes de Ecuador.
                    </p>
                    <div className="mt-10 rounded-3xl border border-white/20 bg-white/10 p-5">
                      <p className="mb-3 text-sm font-semibold">Indicadores de seguridad</p>
                      <p className="mb-2 inline-flex items-center gap-2 text-xs">
                        <ShieldCheck className="h-4 w-4 text-[#00B894]" /> Datos protegidos
                      </p>
                      <p className="inline-flex items-center gap-2 text-xs">
                        <BadgeCheck className="h-4 w-4 text-[#00B894]" /> Conexion segura
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-10">
                  <button
                    type="button"
                    onClick={() => setCurrentScreen('landing')}
                    className="mb-5 text-xs font-semibold text-[#0F6CBD] hover:underline"
                  >
                    ← Volver al inicio
                  </button>
                  <div className="mx-auto w-full max-w-md">
                    <div className="mb-8 space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#0F6CBD]/10 px-3 py-1 text-xs font-semibold text-[#0F6CBD]">
                        <ShieldCheck className="h-4 w-4" />
                        Conexion segura
                      </div>
                      <h1 className="font-['Poppins'] text-3xl font-semibold text-[#1E3A5F]">Ingresa a SaludPredict AI</h1>
                      <p className="text-sm text-slate-600">Tu cobertura medica inteligente antes de atenderte.</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleLogin} noValidate>
                      <div>
                        <label htmlFor="username" className="mb-2 block text-sm font-medium text-slate-700">
                          Usuario
                        </label>
                        <div
                          className={`group flex items-center rounded-2xl border bg-white/80 px-4 transition ${
                            usernameError
                              ? 'border-red-400 ring-2 ring-red-100'
                              : 'border-slate-200 focus-within:border-[#0F6CBD] focus-within:ring-4 focus-within:ring-[#0F6CBD]/10'
                          }`}
                        >
                          <UserRound className="h-4 w-4 text-slate-400 group-focus-within:text-[#0F6CBD]" />
                          <input
                            id="username"
                            type="text"
                            autoComplete="username"
                            value={form.username}
                            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                            className="h-12 w-full bg-transparent px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                            placeholder="Ej: paciente.ec"
                            aria-invalid={Boolean(usernameError)}
                          />
                        </div>
                        {usernameError && <p className="mt-1 text-xs text-red-600">{usernameError}</p>}
                      </div>

                      <div>
                        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                          Contrasena
                        </label>
                        <div
                          className={`group flex items-center rounded-2xl border bg-white/80 px-4 transition ${
                            passwordError
                              ? 'border-red-400 ring-2 ring-red-100'
                              : 'border-slate-200 focus-within:border-[#0F6CBD] focus-within:ring-4 focus-within:ring-[#0F6CBD]/10'
                          }`}
                        >
                          <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-[#0F6CBD]" />
                          <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={form.password}
                            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                            className="h-12 w-full bg-transparent px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                            placeholder="Minimo 8 caracteres"
                            aria-invalid={Boolean(passwordError)}
                          />
                          <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="text-slate-500 transition hover:text-[#0F6CBD]">
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {passwordError && <p className="mt-1 text-xs text-red-600">{passwordError}</p>}
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={form.remember}
                          onChange={(event) => setForm((prev) => ({ ...prev, remember: event.target.checked }))}
                          className="h-4 w-4 rounded border-slate-300 text-[#0F6CBD] focus:ring-[#0F6CBD]/40"
                        />
                        Recordar sesion
                      </label>

                      <div className="space-y-3 pt-1">
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={isLoggingIn || isAnalyzingCoverage}
                          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0F6CBD] text-sm font-semibold text-white shadow-lg shadow-[#0F6CBD]/35 transition hover:bg-[#105EA2] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isLoggingIn ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Ingresando...
                            </>
                          ) : (
                            'Ingresar'
                          )}
                        </motion.button>
                        <button
                          type="button"
                          onClick={() => showToast('Redirigiendo a comparador de planes...')}
                          className="h-12 w-full rounded-2xl border border-[#00B894]/25 bg-white text-sm font-semibold text-[#00A17F] transition hover:border-[#00B894]/50 hover:bg-[#00B894]/5"
                        >
                          Ver planes
                        </button>
                      </div>
                    </form>

                    <AnimatePresence>
                      {isAnalyzingCoverage && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          className="mt-4 rounded-2xl border border-[#00B894]/25 bg-[#00B894]/10 px-4 py-3 text-xs font-medium text-[#007E64]"
                        >
                          <p className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analizando cobertura medica...
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {currentScreen === 'dashboard' && (
            <motion.section
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="overflow-hidden rounded-[30px] border border-white/60 bg-white/70 shadow-[0_24px_70px_rgba(15,108,189,0.14)] backdrop-blur-xl"
            >
              <header className="flex items-center justify-between border-b border-[#D9E3F0] bg-white/80 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-[#0F6CBD] p-2 text-white">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-['Poppins'] text-lg font-semibold">SaludPredict AI</h2>
                    <p className="text-xs text-slate-500">Dashboard inteligente del paciente</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#00B894]/10 px-3 py-1 text-xs font-semibold text-[#008E70]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Sesion segura
                </span>
              </header>

              <div className="grid gap-4 p-4 md:grid-cols-12 md:gap-5 md:p-5">
                <aside className="space-y-4 md:col-span-3">
                  <motion.article whileHover={{ y: -2 }} className="rounded-3xl border border-[#DDE7F3] bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F6CBD] to-[#00B894] text-white">
                        <UserRound className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Andrea Torres</h3>
                        <p className="text-xs text-slate-500">Paciente titular</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-xs text-slate-600">
                      <p className="flex justify-between">
                        <span>Seguro</span> <span className="font-medium text-slate-800">SaludTotal</span>
                      </p>
                      <p className="flex justify-between">
                        <span>Plan</span> <span className="font-medium text-slate-800">Premium Plus</span>
                      </p>
                      <p className="flex justify-between">
                        <span>Cobertura</span> <span className="font-medium text-[#0F6CBD]">90%</span>
                      </p>
                      <p className="flex justify-between">
                        <span>Estado</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                          Activo
                        </span>
                      </p>
                    </div>
                  </motion.article>

                  <nav className="rounded-3xl border border-[#DDE7F3] bg-white p-3 shadow-sm">
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      const isLogout = 'logout' in item && item.logout;
                      const isActive = !isLogout && activeMenu === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (isLogout) {
                              handleLogout();
                              return;
                            }
                            setActiveMenu(item.id);
                            showToast(`Seccion "${item.label}" activada.`);
                          }}
                          className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
                            isLogout
                              ? 'text-rose-600 hover:bg-rose-50'
                              : isActive
                                ? 'bg-[#0F6CBD] text-white shadow-md shadow-[#0F6CBD]/30'
                                : 'text-slate-600 hover:bg-[#F5F7FA]'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </nav>
                </aside>

                <div className="md:col-span-9">
                  {activeMenu === 'hospitales' ? (
                    <section className="rounded-3xl border border-[#DDE7F3] bg-white p-4 shadow-sm md:p-5">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-['Poppins'] text-xl font-semibold">Busqueda avanzada de hospitales</h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#00B894]/10 px-3 py-1 text-xs font-semibold text-[#00866A]">
                          <Compass className="h-3.5 w-3.5" />
                          Estilo Maps + Health Tech
                        </span>
                      </div>
                      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[#DCE7F3] bg-[#FAFCFF] px-3">
                        <Search className="h-4 w-4 text-slate-400" />
                        <input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          className="h-11 w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                          placeholder="Buscar por seguro, sintoma, hospital o especialidad"
                        />
                      </div>
                      <div className="mb-4 grid gap-2 md:grid-cols-5">
                        {(Object.keys(filters) as Array<keyof typeof filters>).map((key) => (
                          <select
                            key={key}
                            value={filters[key]}
                            onChange={(event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }))}
                            className="h-10 rounded-xl border border-[#DCE7F3] bg-white px-3 text-xs text-slate-600 focus:border-[#0F6CBD] focus:outline-none"
                          >
                            <option>{filters[key]}</option>
                            <option>Alternativa 1</option>
                            <option>Alternativa 2</option>
                          </select>
                        ))}
                      </div>
                      <div className="grid gap-4 lg:grid-cols-5">
                        <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1 lg:col-span-2">
                          {sortedHospitals.map((hospital) => (
                            <motion.article key={hospital.id} whileHover={{ y: -2 }} className="rounded-2xl border border-[#E2EBF5] bg-[#FBFDFF] p-4 shadow-sm">
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-semibold text-slate-800">{hospital.name}</h4>
                                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {hospital.address}
                                  </p>
                                </div>
                                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getHospitalBadgeClass(hospital.badge)}`}>
                                  {hospital.badge}
                                </span>
                              </div>
                              <p className="mb-3 flex flex-wrap gap-1.5">
                                {hospital.specialties.map((specialty) => (
                                  <span key={specialty} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                                    {specialty}
                                  </span>
                                ))}
                              </p>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="rounded-xl bg-slate-50 p-2">
                                  <p className="text-slate-500">Tiempo</p>
                                  <p className="inline-flex items-center gap-1 font-semibold">
                                    <Clock3 className="h-3.5 w-3.5 text-[#0F6CBD]" />
                                    {hospital.eta}
                                  </p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-2">
                                  <p className="text-slate-500">Copago</p>
                                  <p className="font-semibold text-[#0F6CBD]">${hospital.copay}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-2">
                                  <p className="text-slate-500">Cobertura</p>
                                  <p className="font-semibold text-[#00A884]">{hospital.coverage}%</p>
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    window.open(
                                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                        hospital.name + ' ' + hospital.address,
                                      )}`,
                                      '_blank',
                                    )
                                  }
                                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#0F6CBD]/25 bg-white px-2 py-2 text-[11px] font-semibold text-[#0F6CBD] hover:bg-[#0F6CBD]/5"
                                >
                                  Maps
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleScheduleAppointment(hospital)}
                                  className={`inline-flex items-center justify-center rounded-xl px-2 py-2 text-[11px] font-semibold text-white ${
                                    selectedHospitalId === hospital.id ? 'bg-[#00B894]' : 'bg-[#0F6CBD] hover:bg-[#0D5CA4]'
                                  }`}
                                >
                                  Agendar cita
                                </button>
                              </div>
                            </motion.article>
                          ))}
                        </div>
                        <div className="relative min-h-[480px] rounded-3xl border border-[#E1EAF5] bg-gradient-to-br from-[#EAF4FF] to-[#E8FCF5] p-3 lg:col-span-3">
                          <div className="absolute inset-3 rounded-2xl border border-white/70 bg-white/55 backdrop-blur-sm" />
                          {hospitalCatalog.map((item) => (
                            <motion.button
                              key={item.id}
                              whileHover={{ scale: 1.08 }}
                              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#0F6CBD] p-2 text-white shadow-lg shadow-[#0F6CBD]/35"
                              style={{ top: item.top, left: item.left }}
                              title={`${item.name} · ${item.badge}`}
                            >
                              <Hospital className="h-4 w-4" />
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </section>
                  ) : activeMenu === 'coberturas' ? (
                    <section className="space-y-4 rounded-3xl border border-[#DDE7F3] bg-white p-4 shadow-sm md:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-['Poppins'] text-xl font-semibold">Planes y coberturas</h3>
                        <div className="flex items-center gap-2 rounded-full border border-[#D7E4F3] bg-white p-1">
                          <button
                            type="button"
                            onClick={() => setBillingCycle('monthly')}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              billingCycle === 'monthly' ? 'bg-[#0F6CBD] text-white' : 'text-slate-500'
                            }`}
                          >
                            Mensual
                          </button>
                          <button
                            type="button"
                            onClick={() => setBillingCycle('annual')}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              billingCycle === 'annual' ? 'bg-[#00B894] text-white' : 'text-slate-500'
                            }`}
                          >
                            Anual
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        {plans.map((plan) => {
                          const isCurrent = plan.badge === 'Tu plan actual';
                          const isSelected = selectedPlan === plan.id;
                          return (
                            <motion.article
                              key={plan.id}
                              whileHover={{ y: -4 }}
                              className={`rounded-3xl border p-4 shadow-sm ${
                                isSelected ? 'border-[#0F6CBD] bg-[#F8FBFF]' : 'border-[#E0E9F4] bg-white'
                              }`}
                            >
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-semibold">{plan.name}</h4>
                                  <p className="text-xs text-slate-500">{plan.highlight}</p>
                                </div>
                                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getPlanBadgeClass(plan.badge)}`}>
                                  {plan.badge}
                                </span>
                              </div>
                              <div className="mb-3 rounded-2xl bg-gradient-to-br from-[#0F6CBD] to-[#00B894] p-3 text-white">
                                <p className="text-xs">Precio {billingCycle === 'annual' ? 'anual' : 'mensual'}</p>
                                <p className="text-2xl font-semibold">
                                  ${getPlanPrice(plan)} {billingCycle === 'annual' ? '/anio' : '/mes'}
                                </p>
                                <p className="text-xs text-white/90">Copago promedio: ${plan.averageCopay}</p>
                              </div>
                              <ul className="space-y-1.5 text-xs text-slate-600">
                                <li>Cobertura: {plan.coverage}%</li>
                                <li>Emergencias: {plan.emergencies}</li>
                                <li>Especialistas: {plan.specialists}</li>
                                <li>Telemedicina: {plan.telemedicine}</li>
                                <li>Hospitales afiliados: {plan.hospitalsAffiliated}</li>
                              </ul>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => setSelectedPlan(plan.id)}
                                  className="rounded-xl border border-[#0F6CBD]/30 px-3 py-2 text-xs font-semibold text-[#0F6CBD] hover:bg-[#0F6CBD]/5"
                                >
                                  Comparar
                                </button>
                                <button
                                  onClick={() => showToast(isCurrent ? `Mejora iniciada: ${plan.name}` : `Contratacion iniciada: ${plan.name}`)}
                                  className={`rounded-xl px-3 py-2 text-xs font-semibold text-white ${
                                    isCurrent ? 'bg-[#00B894]' : 'bg-[#0F6CBD] hover:bg-[#0E5EA2]'
                                  }`}
                                >
                                  {isCurrent ? 'Mejorar plan' : 'Contratar'}
                                </button>
                              </div>
                            </motion.article>
                          );
                        })}
                      </div>
                    </section>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-9">
                      <section className="rounded-3xl border border-[#DDE7F3] bg-white shadow-sm md:col-span-5">
                        <div className="flex flex-col gap-2 border-b border-[#E5EDF6] px-4 py-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-start gap-2">
                            <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-[#0F6CBD]" />
                            <div>
                              <h3 className="font-semibold leading-tight">Beneficio antes de atenderte</h3>
                              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
                                Agente conversacional: sintoma → especialidad en hospital/red, cruce con tu plan y copago exacto
                                en cada hospital; destacamos el mas economico.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isAiThinking && (
                              <div className="inline-flex items-center gap-2 rounded-full bg-[#0F6CBD]/10 px-3 py-1 text-xs text-[#0F6CBD]">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                IA analizando sintomas
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="max-h-[62vh] space-y-3 overflow-y-auto px-4 py-4">
                          {!messages.length && !isAiThinking && (
                            <div className="rounded-2xl border border-dashed border-[#D8E3F0] bg-[#F9FBFE] p-4 text-sm text-slate-500">
                              Cuenta tu sintoma o malestar. Te diremos la especialidad sugerida en hospital, cuanto pagarias de
                              copago en cada hospital de la red demo y cual te conviene mas por costo.
                            </div>
                          )}
                          {messages.map((message) => (
                            <motion.div
                              key={message.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`rounded-2xl p-3 text-sm ${
                                message.role === 'user'
                                  ? 'ml-auto max-w-[90%] bg-[#0F6CBD] text-white'
                                  : 'mr-auto max-w-[95%] border border-[#E2EBF5] bg-[#F9FBFE] text-slate-700'
                              }`}
                            >
                              {message.role === 'ai' && message.text.trim() ? (
                                <p className="whitespace-pre-wrap text-slate-600">{message.text}</p>
                              ) : null}
                              {message.role === 'user' ? (
                                <p className="whitespace-pre-wrap">{message.text}</p>
                              ) : null}
                              {message.role === 'ai' && message.structured && (
                                <div className="mt-3 rounded-2xl border border-[#C8D9ED] bg-gradient-to-b from-white to-[#F4F8FD] p-3 shadow-[0_8px_24px_rgba(15,108,189,0.08)]">
                                  <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0F6CBD]">
                                    Resumen — plan y red (demo)
                                  </p>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="flex min-h-[88px] flex-col rounded-xl border border-white bg-white/90 p-3 shadow-sm ring-1 ring-slate-100">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0F6CBD]/90">
                                        Especialidad recomendada
                                      </p>
                                      <p className="mt-auto pt-2 text-base font-semibold leading-snug text-slate-800">
                                        {message.structured.specialty}
                                      </p>
                                    </div>
                                    <div
                                      className={`flex min-h-[88px] flex-col rounded-xl border p-3 shadow-sm ring-1 ring-black/5 ${getPriorityTone(
                                        message.structured.priority,
                                      )}`}
                                    >
                                      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                                        Nivel de prioridad
                                      </p>
                                      <p className="mt-auto pt-2 text-base font-bold">{message.structured.priority}</p>
                                    </div>
                                    <div className="flex min-h-[72px] flex-col rounded-xl border border-white bg-white/90 p-3 shadow-sm ring-1 ring-slate-100 sm:col-span-2">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0F6CBD]/90">
                                        Cobertura
                                      </p>
                                      <p className="mt-2 text-sm leading-relaxed text-slate-700">
                                        {message.structured.coverage}
                                      </p>
                                    </div>
                                    <div className="flex min-h-[72px] flex-col rounded-xl border border-white bg-white/90 p-3 shadow-sm ring-1 ring-slate-100 sm:col-span-2">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0F6CBD]/90">
                                        Recomendaciones
                                      </p>
                                      <p className="mt-2 text-sm leading-relaxed text-slate-700">
                                        {message.structured.recommendation}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-3 rounded-xl border border-dashed border-[#0F6CBD]/25 bg-[#0F6CBD]/[0.04] p-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0F6CBD]">
                                      Copago por hospital (montos exactos)
                                    </p>
                                    <ul className="mt-2 space-y-1.5 font-mono text-[12px] text-slate-700">
                                      {message.structured.copayEstimate
                                        .split('\n')
                                        .map((line) => line.trim())
                                        .filter(Boolean)
                                        .map((line, i) => (
                                          <li key={`${message.id}-c-${i}`} className="flex gap-2">
                                            <span className="text-slate-300">•</span>
                                            <span>{line}</span>
                                          </li>
                                        ))}
                                    </ul>
                                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#0F6CBD]/10 pt-3 text-xs">
                                      <span className="font-medium text-slate-500">Mas economico:</span>
                                      <span className="rounded-full bg-[#0F6CBD] px-2.5 py-0.5 font-semibold text-white">
                                        {message.structured.bestHospitalEconomically}
                                      </span>
                                    </div>
                                  </div>
                                  {message.structured.hospitalsAcceptingInsurance.length > 0 && (
                                    <p className="mt-3 text-center text-[10px] text-slate-400">
                                      Hospitales elegidos por el agente para ti:{' '}
                                      {message.structured.hospitalsAcceptingInsurance.join(' · ')}. Verifica tu poliza real.
                                    </p>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          ))}
                          {isAiThinking && (
                            <div className="space-y-2">
                              <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                              <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                            </div>
                          )}
                        </div>
                        <form onSubmit={handleChatSubmit} className="border-t border-[#E5EDF6] p-3">
                          <div className="flex items-center gap-2 rounded-2xl border border-[#D8E3F0] bg-white px-3 shadow-sm">
                            <input
                              type="text"
                              value={chatInput}
                              onChange={(event) => setChatInput(event.target.value)}
                              className="h-12 w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                              placeholder="Ej: dolor de cabeza desde ayer, o dolor de estomago..."
                            />
                            <motion.button
                              whileTap={{ scale: 0.94 }}
                              type="submit"
                              disabled={!canSendChat}
                              className="rounded-xl bg-[#0F6CBD] p-2.5 text-white transition hover:bg-[#0E5CA2] disabled:cursor-not-allowed disabled:opacity-50"
                              title="Enviar mensaje"
                            >
                              <SendHorizontal className="h-4 w-4" />
                            </motion.button>
                          </div>
                        </form>
                      </section>
                      <aside className="space-y-3 rounded-3xl border border-[#DDE7F3] bg-white p-3 shadow-sm md:col-span-4">
                        <div className="mb-1 flex items-center justify-between px-1">
                          <h3 className="flex items-center gap-2 font-semibold">
                            <Building2 className="h-4 w-4 text-[#0F6CBD]" />
                            Hospitales recomendados
                          </h3>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#00B894]/10 px-2 py-1 text-xs font-medium text-[#008E70]">
                            <Sparkles className="h-3.5 w-3.5" /> Segun el agente
                          </span>
                        </div>
                        {!recommendedSidebarHospitals.length ? (
                          <div className="rounded-2xl border border-dashed border-[#D8E3F0] bg-[#F9FBFE] p-4 text-center text-xs text-slate-500">
                            Escribe tu sintoma en el chat. El agente elegira entre 3 y 4 hospitales de la red segun tu caso y
                            apareceran aqui con el mismo formato que en la vista Hospitales.
                          </div>
                        ) : (
                          recommendedSidebarHospitals.map((hospital) => (
                            <motion.article
                              key={hospital.id}
                              whileHover={{ y: -3 }}
                              className="rounded-2xl border border-[#E2EBF5] bg-[#FBFDFF] p-4 shadow-sm"
                            >
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-semibold text-slate-800">{hospital.name}</h4>
                                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {hospital.address}
                                  </p>
                                </div>
                                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getHospitalBadgeClass(hospital.badge)}`}>
                                  {hospital.badge}
                                </span>
                              </div>
                              <p className="mb-3 flex flex-wrap gap-1.5">
                                {hospital.specialties.map((specialty) => (
                                  <span key={specialty} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                                    {specialty}
                                  </span>
                                ))}
                              </p>
                              <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                                <div className="rounded-xl bg-slate-50 p-2">
                                  <p className="text-slate-500">Tiempo</p>
                                  <p className="inline-flex items-center gap-1 font-semibold">
                                    <Clock3 className="h-3.5 w-3.5 text-[#0F6CBD]" />
                                    {hospital.eta}
                                  </p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-2">
                                  <p className="text-slate-500">Copago</p>
                                  <p className="font-semibold text-[#0F6CBD]">${hospital.copay}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-2">
                                  <p className="text-slate-500">Cobertura</p>
                                  <p className="font-semibold text-[#00A884]">{hospital.coverage}%</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    window.open(
                                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                        hospital.name + ' ' + hospital.address,
                                      )}`,
                                      '_blank',
                                    )
                                  }
                                  className="rounded-xl border border-[#0F6CBD]/25 bg-white px-3 py-2 text-xs font-semibold text-[#0F6CBD] hover:bg-[#0F6CBD]/5"
                                >
                                  Ver en Maps
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleScheduleAppointment(hospital)}
                                  className={`rounded-xl px-3 py-2 text-xs font-semibold text-white ${
                                    selectedHospitalId === hospital.id ? 'bg-[#00B894]' : 'bg-[#0F6CBD] hover:bg-[#0E5CA2]'
                                  }`}
                                >
                                  Agendar cita
                                </button>
                              </div>
                            </motion.article>
                          ))
                        )}
                      </aside>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-5 right-5 z-50 rounded-xl border border-[#DDE7F3] bg-white px-4 py-3 text-xs font-medium text-[#1E3A5F] shadow-sm"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
