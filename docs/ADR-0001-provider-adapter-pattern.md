# ADR-0001 — Patrón de Adaptador de Proveedores para toda dependencia externa

**Estado:** Aceptado
**Horizonte de evaluación:** 5–10 años
**Fecha:** Sesión de reconstrucción de Vivi AI (independencia de Base44)
**Autor:** Claude, actuando como Arquitecto Principal de Vivi AI

## 1. Contexto
Vivi AI dependía por completo de Base44 (backend hospedado propietario) para autenticación, base de datos, storage e IA. El objetivo actual es la independencia total de cualquier backend propietario único, sin volver a quedar bloqueada por una sola plataforma o un solo proveedor de IA.

## 2. Decisión
Toda dependencia externa (IA, voz, memoria, base de datos, storage, herramientas, visión, aprendizaje) debe vivir **detrás de un adaptador** con una interfaz estable, de modo que el proveedor concreto (OpenAI, Gemini, Firebase, Web Speech API, etc.) sea intercambiable sin tocar la lógica de negocio que lo consume.

## 3. Estado real de cada categoría (verificado contra el código, no supuesto)

| Categoría | ¿Existe hoy en Vivi? | Estado del adaptador |
|---|---|---|
| **IA (LLM)** | Sí — 18 call sites vía `base44.integrations.Core.InvokeLLM` | ✅ Construido: `functions/index.js` (`callLLM`, proveedores OpenAI/Gemini intercambiables por config) + `src/lib/llmProviders.js` (cliente con la misma forma de API) |
| **Voz — TTS/STT** | Sí — `ViviVoice.js`, hoy acoplado directo a Web Speech API del navegador, con un único punto de fallback a `base44.integrations.Core.GenerateSpeech` | ✅ Fallback de nube migrado: `functions/index.js` (`generateSpeech`, OpenAI TTS + Storage) + `src/lib/llmProviders.js`. **Pendiente (decisión, no código todavía):** formalizar el propio `ViviVoice.js` como adaptador de dos proveedores (`browser` / `cloud`) en vez de dejarlo como lógica de fallback embebida — ver sección 5 |
| **Memoria** | Sí — `ViviMemory.js`, ya bien aislado (solo 4 puntos de contacto con Base44) | ✅ Construido: `src/lib/firebaseEntities.js` (`FirestoreEntities.Memory`, misma forma que `base44.entities.Memory`) |
| **Base de datos** (Conversation, ChatMessage, ToolAction, ImprovementProposal, CertificationTest) | Sí — `useChat.js` y varios módulos | ✅ Construido: `src/lib/firebaseEntities.js` cubre las 6 entidades mapeadas en el informe de auditoría §3 |
| **Storage** | Sí — subida de archivos e imágenes en `useChat.js`, `TextComposer.jsx`, `FileManagementTool.js` | ✅ Construido: `src/lib/firebaseStorageAdapter.js` |
| **Herramientas** | Sí — `src/vivi/tools/*` | ✅ **Ya existía correctamente diseñado.** `ToolBase.js` (`execute(params, context)`, `getPromptDescription()`) ya es un adaptador de plugins limpio — 8 herramientas lo extienden hoy (`CodeTool`, `DocumentationTool`, `FileManagementTool`, `KnowledgeQueryTool`, `MemoryTool`, `ProjectManagementTool`, `SystemDiagnosticTool`, `WebSearchTool`). No requiere cambios, solo se documenta aquí como el estándar a replicar |
| **Visión** | Sí — `ViviVisionEngine.js` | ✅ Cubierto automáticamente por el adaptador de IA (usa `InvokeLLM` con `file_urls`, mismo `callLLM`) |
| **Aprendizaje** | Sí — `ViviLearningEngine.js` | ✅ Cubierto automáticamente por el adaptador de IA + memoria (no tiene dependencias propias adicionales) |
| **Automatizaciones** | ❌ No existe en el código actual | Sin adaptador — no hay nada que adaptar todavía. Ver sección 6 |
| **Pagos** | ❌ No existe (`@stripe/stripe-js` está en `package.json` pero **cero imports** en `src/`) | Sin adaptador — dependencia instalada pero no usada en ningún flujo real |
| **Video** | ❌ No existe | Sin adaptador |
| **Redes sociales** | ❌ No existe | Sin adaptador |
| **Navegador** (automatización/browsing) | ❌ No existe | Sin adaptador |

## 4. Regla de diseño para cualquier adaptador nuevo (incluidas las 5 categorías futuras)
1. La interfaz se define primero por el **contrato real que ya consume la lógica de negocio** (nunca al revés) — así se hizo con `InvokeLLM`/`GenerateImage`/`GenerateSpeech`/`UploadFile`: se extrajo el contrato exacto de los call sites existentes antes de escribir una sola línea del adaptador.
2. Un adaptador nunca es "más inteligente" que su contrato — no añade parámetros ni comportamientos que el código consumidor no pida, para no romper compatibilidad silenciosamente.
3. Un proveedor nuevo se añade como una función más dentro del adaptador (ver `invokeOpenAI` / `invokeGemini` en `functions/index.js`), nunca modificando el contrato público.
4. Ningún adaptador se conecta a producción hasta tener paridad verificada — mismo principio que ya se aplicó en las sesiones anteriores.

## 5. Pendiente de decisión (no bloquea el trabajo actual)
Refactorizar `ViviVoice.js` (1230 líneas, máquina de estados half-duplex delicada) para que el fallback embebido a `GenerateSpeech` se convierta en un adaptador formal de dos proveedores es una operación de **riesgo medio**: toca el módulo de voz en vivo. Antes de hacerlo necesito confirmación tuya, porque es exactamente el tipo de módulo donde un error sutil (por ejemplo, en la lógica de generación/cancelación de habla) puede ser difícil de detectar sin poder probarlo en un navegador real. Recomiendo dejarlo para cuando puedas probarlo tú mismo en `npm run dev`.

## 6. Sobre Automatizaciones, Pagos, Video, Redes sociales y Navegador
Estas 5 categorías no tienen ninguna funcionalidad existente en Vivi hoy. Antes de construir adaptadores para ellas necesito saber de ti:
- ¿Son funciones nuevas que quieres agregar al roadmap de Vivi (en cuyo caso son features nuevas, no parte de "recuperar" o "migrar" lo existente), o
- ¿Es una previsión de arquitectura para el futuro (en cuyo caso lo correcto es documentar el patrón, como en este ADR, y construir el adaptador real cuando la primera función concreta de esa categoría se necesite — construir antes vacío sería el tipo de código especulativo que tu primera regla de este proyecto prohíbe explícitamente)?

## 7. Consecuencias
- Positivo: cambiar de proveedor de IA (OpenAI ↔ Gemini ↔ futuro) es hoy un cambio de un parámetro (`provider`) en `callLLM`, no una reescritura.
- Positivo: `ToolBase.js` confirma que el equipo (o la sesión anterior de desarrollo) ya tenía buen instinto arquitectónico antes de esta auditoría — no es una reconstrucción desde cero, es continuar un patrón que ya funcionaba.
- Riesgo aceptado: mientras el adaptador de voz no se formalice, `ViviVoice.js` sigue teniendo un único punto de acoplamiento a Base44 (`GenerateSpeech`) además del ya migrado — de bajo impacto porque es solo el camino de fallback, no el flujo principal (Web Speech API cubre la mayoría de los casos).
