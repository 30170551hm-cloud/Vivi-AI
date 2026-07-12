# Runbook — Probar Vivi AI en tu máquina real

Esto es exactamente lo que yo no puedo ejecutar aquí (sin red, sin navegador). Sigue los pasos en orden. Cada uno tiene una salida esperada — si algo se ve distinto, copia el texto exacto del error y pégamelo; lo reviso con el mismo rigor de esta sesión.

## 0. Requisitos previos
- **Node.js 20 o 22** (LTS). Verifica con:
  ```bash
  node --version
  npm --version
  ```
  Vite 6.4.3 (el que usa este proyecto) no funciona bien con Node 16 o inferior.
- Un navegador basado en Chromium (Chrome o Edge) — `ViviVoice.js` usa la Web Speech API, que Firefox y Safari soportan de forma incompleta o distinta.

## 1. Descomprimir y entrar al proyecto
```bash
unzip VIVI-AI-main-updated.zip
cd VIVI-AI-main
```

## 2. Configurar variables de entorno
```bash
cp .env.example .env
```
Abre `.env` y completa **solo las 3 variables de Base44** (Vivi sigue funcionando sobre Base44 hoy — Firebase todavía no está conectado):
```
VITE_BASE44_APP_ID=<tu app id real>
VITE_BASE44_FUNCTIONS_VERSION=<tu valor real>
VITE_BASE44_APP_BASE_URL=<tu url real>
```
Si no recuerdas estos valores, deberían estar en el dashboard de Base44 de tu app original, o en un `.env` que ya tuvieras de antes de que esto se rompiera.

## 3. Instalar dependencias (esto es lo que aquí me da 403)
```bash
npm install
```
**Importante:** usa `npm install`, **no `npm ci`** — el `package-lock.json` de este repo tiene una inconsistencia preexistente (el paquete `firebase` está en `package.json` pero nunca se agregó al lockfile; no es algo que haya causado en esta sesión, ya estaba así). `npm install` lo resuelve solo; `npm ci` fallaría porque exige coincidencia exacta.

**Salida esperada:** termina sin errores, crea `node_modules/`. Puede tardar 1-3 minutos.
**Si falla:** copia el error completo. Los sospechosos más probables por lo que auditamos: versión de Node incompatible, o algún paquete con nombre mal escrito (ya verificamos `package.json` a mano, pero `npm install` es la primera verificación real que nadie ha podido correr todavía).

## 4. Verificar lint y build ANTES de abrir el navegador
```bash
npm run lint
```
**Salida esperada:** sin errores (puede haber warnings, eso es aceptable). Si hay errores, cópialos tal cual.

```bash
npm run build
```
**Salida esperada:** termina con algo como `✓ built in X s` y crea la carpeta `dist/`. Esta es la primera vez que esto se ejecuta de verdad en todo el proceso — es la prueba real de que no hay errores de compilación, imports rotos, o sintaxis inválida en todo el árbol (incluyendo los `.jsx` que yo no pude verificar aquí, solo los `.js`).
**Si falla:** el mensaje de Vite normalmente apunta al archivo y línea exactos — pégamelo así, sin resumir.

## 5. Levantar el servidor de desarrollo
```bash
npm run dev
```
**Salida esperada:** algo como:
```
VITE v6.4.x  ready in XXX ms
➜  Local:   http://localhost:5173/
```

## 6. Abrir en el navegador y verificar, en este orden
1. Abre `http://localhost:5173/` en Chrome.
2. **Abre la consola del navegador ANTES de que cargue** (F12 → pestaña "Console"), para capturar cualquier error desde el primer render.
3. Verifica en orden:
   - ¿Carga la pantalla de login o directo la app? (depende de si ya tienes sesión de Base44)
   - Inicia sesión.
   - ¿Aparece el avatar de Vivi?
   - Escríbele un mensaje de texto (no hace falta voz todavía) — ¿responde?
   - Ve a `/founder` — ¿carga el panel? (Solo funcionará si tu usuario de Base44 tiene `is_founder: true`, o tu email está en la lista `FOUNDER_EMAILS` de `ViviFounderAuth.js`)
   - Ve a `/memoria` — crea una memoria manualmente, recarga la página, ¿sigue ahí?
   - Prueba el micrófono (botón de voz) — Chrome pedirá permiso de micrófono, acéptalo.

## 7. Qué mandarme si algo falla
Para cada punto que falle, necesito exactamente:
- El comando que corriste.
- El texto completo del error (consola del navegador Y terminal donde corre `npm run dev`).
- En qué paso del punto 6 se rompió.

Con eso reviso el código real, replico el error de forma aislada (como hice con el bug de `app-params.js` y el de `ModuleBase.js` en esta sesión), lo corrijo, y te doy evidencia del antes/después — mismo estándar que ya usamos.

## 8. Cuando todo lo de arriba funcione
Recién ahí seguimos con el empaquetado móvil (PWA o Capacitor) — no antes, porque empaquetar algo que no arranca no resuelve nada.
