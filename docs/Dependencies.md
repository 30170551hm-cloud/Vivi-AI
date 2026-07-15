# Vivi AI - Dependency Management

This document provides a detailed log of the external packages, tools, compilation scripts, and third-party integrations defining the Vivi AI runtime environment.

---

## 1. Production Build & Execution Scripts

Vivi AI operates as a robust full-stack (React + Express) system. In production, compilation and bootstrapping rely on a specific script matrix defined in `package.json`:

- **`npm run dev`**: Launches the local development server running `tsx server.js`, which transparently interprets Node.js TypeScript on the fly.
- **`npm run build`**:
  - Compiles the frontend assets into static files using `vite build` (optimized outputs written to `dist/`).
  - Bundles the backend Express server entry-point `server.js` using `esbuild` with parameters: `--bundle --platform=node --format=esm --packages=external --sourcemap --outfile=dist/server.js`. This resolves all module pathways, outputs ES modules, and excludes standard external libraries.
- **`npm run start`**: Directly boots the precompiled backend via `node dist/server.js` for container runtime scaling (e.g. Google Cloud Run, Vercel, Firebase Hosting).
- **`npm run lint`**: Executes the code quality checks across the workspace using `eslint . --quiet`.

---

## 2. Core Dependencies (Production-Critical)

### A. Artificial Intelligence & Orchestration
- **`@google/genai` (^2.11.0)**: The official high-performance Google GenAI SDK used for prompting the Gemini model suite (Gemini 2.5 Flash, etc.) via secure server-side proxy flows.
- **`framer-motion` (^11.16.4)**: Powers the aesthetic transitions, layout reflows, and route entries for a polished presentation experience.

### B. Backend Services & Storage
- **`firebase` (^10.7.1)**: Connects to Firebase Authentication and Google Cloud Firestore. Used exclusively for durable user-authored content, identity state tracking, and persistent conversational logs.
- **`express` (^5.2.1)**: Serves the SPA static files in production, provides secure server proxy endpoints for model APIs, and exposes health verification routes.

### C. Visual Interfaces & UX Elements
- **`react` (^18.2.0) & `react-dom` (^18.2.0)**: Main client-side rendering layer.
- **`react-router-dom` (^6.26.0)**: Declares application navigation trees, route guards (such as `ProtectedRoute`), and layout layouts.
- **`lucide-react` (^0.475.0)**: Serves as the central, consistent vector icon library. Custom SVG files are strictly forbidden to ensure interface uniformity.
- **`recharts` (^2.15.4)**: Generates highly detailed interactive analytics charts for user trends and performance statistics.
- **`three` (^0.171.0)**: Powers any advanced webGL or vector 3D animation requirements.

---

## 3. DevDependencies (Build & Validation Tools)

- **`vite` (^6.4.3)**: High-speed local asset bundler and development server proxy.
- **`esbuild` (^0.28.1)**: Compiles high-performance Node servers instantly.
- **`eslint` (^9.19.0)**: Controls syntax rules, handles unused imports with `eslint-plugin-unused-imports`, and flags structural React Hook issues.
- **`tsx` (^4.23.0)**: Directly executes TSX/JSX server-side script entries without manual ahead-of-time compilations.
- **`typescript` (^5.8.2)**: Enforces code reliability and type constraints.

---

## 4. Base44 Decoupling Declaration

As of the current production audit, **all dependencies and configurations related to Base44 have been completely removed or deprecated**. 

- No Base44 SDK packages remain in `package.json`.
- The application relies exclusively on standard **Firebase Authentication and Firestore** for persistence and identity.
- No Base44 hooks or custom middleware are included, eliminating bloat and keeping Vivi AI's runtime footprint lightweight and fully self-contained.
