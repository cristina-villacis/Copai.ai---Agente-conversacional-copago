# Copai.ai — Agente conversacional de copago (SaludPredict)

Demo React (Vite + TypeScript + Tailwind) con API serverless para chat Gemini privado: síntomas → especialidad, copagos y hospitales recomendados (demo Ecuador).

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior
- npm (incluido con Node)
- Una API key de [Google AI Studio](https://aistudio.google.com/apikey) para Gemini

## Instalación

```bash
git clone https://github.com/cristina-villacis/Copai.ai---Agente-conversacional-copago.git
cd Copai.ai---Agente-conversacional-copago
npm install
```

## Variables de entorno

No subas la clave al repositorio. Crea un archivo `.env.local` en la raíz (está ignorado por git):

```bash
cp .env.example .env.local
```

Edita `.env.local` (clave privada de servidor):

```env
GEMINI_API_KEY=tu_api_key_aqui
```

Opcional:

```env
GEMINI_MODEL=gemini-2.5-flash
```

La API key ya no se expone al navegador: el frontend llama a `/api/chat` y Gemini se consulta desde backend.

## Ejecutar en desarrollo

```bash
npm run dev
```

Abre la URL que muestre la consola (por defecto suele ser `http://localhost:3000/`).

## Build de producción

```bash
npm run build
npm run preview
```

## Despliegue en Vercel

El proyecto ya está en React + Vite, así que Vercel lo detecta como frontend estático.

1. Entra a [Vercel](https://vercel.com/) y selecciona **Add New Project**.
2. Importa este repositorio de GitHub.
3. Configura:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. En **Environment Variables**, agrega:
   - `GEMINI_API_KEY` = tu clave real
   - `GEMINI_MODEL` (opcional, por ejemplo `gemini-2.5-flash`)
5. Deploy.

Si el frontend usa rutas del lado del cliente (SPA), el archivo `vercel.json` del repo ya incluye rewrite a `index.html`.

## Lint / TypeScript

```bash
npm run lint
```

## Notas

- Los hospitales y tarifas de la demo están en `src/constants.ts`.
- La lógica del agente y el prompt de sistema están en `src/services/geminiService.ts`.
