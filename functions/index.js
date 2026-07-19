import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

const OPENAI_API_KEY = { value: () => process.env.OPENAI_API_KEY };const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const GITHUB_TOKEN = defineSecret('GITHUB_TOKEN');
const REPO_EDIT_ALLOWLIST = defineSecret('REPO_EDIT_ALLOWLIST');
const REPO_EDIT_REQUIRE_APPROVAL = defineSecret('REPO_EDIT_REQUIRE_APPROVAL');

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const db = getFirestore();
const GITHUB_API = 'https://api.github.com';
const MAX_REPO_CHANGES = 20;
const MAX_FILE_CONTENT_LENGTH = 80_000;

function pickProvider(requested, keys) {
  if (requested) return requested;
  if (keys.openai) return 'openai';
  if (keys.gemini) return 'gemini';
  throw new HttpsError('failed-precondition', 'No hay proveedor IA configurado (OPENAI_API_KEY / GEMINI_API_KEY).');
}

function normalizeAllowlist(raw) {
  return String(raw || 'src/,functions/,docs/,README.md,package.json')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isPathAllowed(path, allowlist) {
  const p = String(path || '').trim();
  if (!p || p.startsWith('/') || p.includes('..')) return false;
  return allowlist.some((prefix) => p === prefix || p.startsWith(prefix));
}

async function githubFetch(path, token, { method = 'GET', body } = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      Authorization: ['Bearer', token].join(' '),
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'vivi-ai-functions',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`GitHub API ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

async function getRoleClaims(uid) {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const data = userSnap.exists ? userSnap.data() : {};
  return {
    isFounder: data?.is_founder === true,
    isAdmin: data?.role === 'admin',
  };
}

async function assertRepoWriteAuthorized(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
  const claims = await getRoleClaims(request.auth.uid);
  if (!claims.isFounder && !claims.isAdmin) {
    throw new HttpsError('permission-denied', 'Solo founder/admin puede editar repositorios.');
  }
  return claims;
}

async function assertRepoReadAuthorized(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
  const claims = await getRoleClaims(request.auth.uid);
  if (!claims.isFounder && !claims.isAdmin) {
    throw new HttpsError('permission-denied', 'Solo founder/admin puede leer el repositorio.');
  }
  return claims;
}

function validateRepoChangeRequest(data, allowlist) {
  const { owner, repo, baseBranch = 'main', changes, title } = data || {};
  if (!owner || !repo) throw new HttpsError('invalid-argument', 'Faltan owner/repo.');
  if (!title || String(title).trim().length < 5) throw new HttpsError('invalid-argument', 'Título de PR inválido.');
  if (!Array.isArray(changes) || changes.length === 0) throw new HttpsError('invalid-argument', 'Debe enviar cambios.');
  if (changes.length > MAX_REPO_CHANGES) {
    throw new HttpsError('invalid-argument', `Máximo ${MAX_REPO_CHANGES} operaciones por solicitud.`);
  }

  changes.forEach((c, index) => {
    const action = c?.action || 'update';
    if (!['create', 'update', 'delete'].includes(action)) {
      throw new HttpsError('invalid-argument', `Acción inválida en cambio #${index + 1}.`);
    }
    if (!isPathAllowed(c?.path, allowlist)) {
      throw new HttpsError('permission-denied', `Ruta no permitida: ${c?.path}`);
    }
    if (action !== 'delete') {
      const content = String(c?.content || '');
      if (!content.length) throw new HttpsError('invalid-argument', `Contenido vacío en ${c?.path}.`);
      if (content.length > MAX_FILE_CONTENT_LENGTH) {
        throw new HttpsError('invalid-argument', `Archivo excede límite (${c?.path}).`);
      }
    }
  });

  return { owner, repo, baseBranch, changes };
}

async function applyRepoChanges({ owner, repo, baseBranch, changes, title, description, token, actorUid }) {
  const ref = await githubFetch(`/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, token);
  const baseSha = ref?.object?.sha;
  if (!baseSha) throw new Error(`No se pudo resolver la rama base ${baseBranch}.`);

  const branch = `vivi/auto-${Date.now()}-${actorUid.slice(0, 6)}`;
  await githubFetch(`/repos/${owner}/${repo}/git/refs`, token, {
    method: 'POST',
    body: { ref: `refs/heads/${branch}`, sha: baseSha },
  });

  const appliedPaths = [];

  for (const change of changes) {
    const action = change.action || 'update';
    const path = change.path;
    const message = change.message || `vivi: ${action} ${path}`;

    let existing = null;
    try {
      existing = await githubFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`, token);
    } catch (err) {
      if (err.status !== 404) throw err;
    }

    if (action === 'delete') {
      if (!existing?.sha) continue;
      await githubFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, token, {
        method: 'DELETE',
        body: { message, sha: existing.sha, branch },
      });
      appliedPaths.push(path);
      continue;
    }

    await githubFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, token, {
      method: 'PUT',
      body: {
        message,
        branch,
        content: Buffer.from(String(change.content), 'utf-8').toString('base64'),
        ...(existing?.sha ? { sha: existing.sha } : {}),
      },
    });
    appliedPaths.push(path);
  }

  const pr = await githubFetch(`/repos/${owner}/${repo}/pulls`, token, {
    method: 'POST',
    body: {
      title,
      body: description || 'Cambios automáticos propuestos por Vivi (flujo seguro backend).',
      head: branch,
      base: baseBranch,
    },
  });

  return {
    branch,
    prNumber: pr?.number,
    prUrl: pr?.html_url,
    rollback: { baseBranch, baseSha, branch, appliedPaths },
  };
}

async function invokeOpenAI({ apiKey, prompt, responseSchema, fileUrls }) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  const content = [{ type: 'text', text: prompt }];
  for (const url of fileUrls || []) content.push({ type: 'image_url', image_url: { url } });

  const request = { model: 'gpt-4o', messages: [{ role: 'user', content }] };
  if (responseSchema) {
    request.response_format = {
      type: 'json_schema',
      json_schema: { name: 'vivi_response', schema: responseSchema, strict: true },
    };
  }

  const completion = await client.chat.completions.create(request);
  const text = completion.choices?.[0]?.message?.content || '';
  return responseSchema ? JSON.parse(text) : text;
}

async function generateImageOpenAI({ apiKey, prompt }) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const result = await client.images.generate({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024' });
  return { url: result.data?.[0]?.url };
}

async function generateSpeechOpenAI({ apiKey, text, uid }) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });
  const response = await client.audio.speech.create({ model: 'tts-1', voice: 'nova', input: text });
  const buffer = Buffer.from(await response.arrayBuffer());

  const bucket = getStorage().bucket();
  const path = `vivi-artifacts/${uid}/tts-cache/${Date.now()}.mp3`;
  const file = bucket.file(path);
  await file.save(buffer, { contentType: 'audio/mpeg' });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
  return { url };
}

function normalizeSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const copy = Array.isArray(schema) ? [] : {};
  for (const key in schema) {
    if (Object.prototype.hasOwnProperty.call(schema, key)) {
      if (key === 'type' && typeof schema[key] === 'string') {
        copy[key] = schema[key].toUpperCase();
      } else if (typeof schema[key] === 'object') {
        copy[key] = normalizeSchema(schema[key]);
      } else {
        copy[key] = schema[key];
      }
    }
  }
  return copy;
}

async function invokeGemini({ apiKey, prompt, responseSchema, fileUrls, model: requestedModel }) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Resolve requested model, fall back to gemini-3.5-flash
  let name = String(requestedModel || '').toLowerCase();
  let modelName = 'gemini-3.5-flash';
  if (name.includes('pro')) {
    modelName = 'gemini-3.1-pro-preview';
  } else if (name.includes('flash-lite') || name.includes('lite')) {
    modelName = 'gemini-3.1-flash-lite';
  } else if (name.includes('flash')) {
    modelName = 'gemini-3.5-flash';
  }

  const normalizedSchema = responseSchema ? normalizeSchema(responseSchema) : undefined;

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: normalizedSchema ? { responseMimeType: 'application/json', responseSchema: normalizedSchema } : undefined,
  });

  const parts = [{ text: prompt }];
  for (const url of fileUrls || []) {
    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());
    parts.push({
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: res.headers.get('content-type') || 'image/jpeg',
      },
    });
  }

  try {
    const result = await model.generateContent(parts);
    const text = result.response.text();
    return responseSchema ? JSON.parse(text) : text;
  } catch (err) {
    const status = err.status || 500;
    const statusText = err.statusText || 'Unknown Error';
    const errorDetails = err.errorDetails ? JSON.stringify(err.errorDetails, null, 2) : '';
    const bodyText = errorDetails || err.message;
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent`;
    const authMethod = "GoogleGenerativeAI SDK Key (GEMINI_API_KEY)";
    const file = "functions/index.js";
    const line = "272";
    
    console.error("=== DETAILED GEMINI API ERROR ===");
    console.error("HTTP Code:", status);
    console.error("Endpoint:", endpoint);
    console.error("Model:", modelName);
    console.error("Authentication Method:", authMethod);
    console.error("File and Line:", `${file}:${line}`);
    console.error("Response Body:", bodyText);
    console.error("Stack Trace:", err.stack);
    console.error("=================================");

    throw new Error(JSON.stringify({
      message: err.message,
      status,
      body: bodyText,
      endpoint,
      model: modelName,
      authMethod,
      file,
      line,
      stack: err.stack
    }));
  }
}

export const callLLM = onCall({ secrets: [OPENAI_API_KEY, GEMINI_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
  const { prompt, response_json_schema, file_urls, provider, model } = request.data || {};
  if (!prompt || typeof prompt !== 'string') throw new HttpsError('invalid-argument', 'Falta "prompt" (string).');

  const keys = { openai: OPENAI_API_KEY.value(), gemini: GEMINI_API_KEY.value() };
  const chosen = pickProvider(provider, keys);

  try {
    if (chosen === 'openai') return await invokeOpenAI({ apiKey: keys.openai, prompt, responseSchema: response_json_schema, fileUrls: file_urls });
    if (chosen === 'gemini') return await invokeGemini({ apiKey: keys.gemini, prompt, responseSchema: response_json_schema, fileUrls: file_urls, model });
    throw new HttpsError('invalid-argument', `Proveedor desconocido: ${chosen}`);
  } catch (err) {
    throw new HttpsError('internal', `Fallo del proveedor ${chosen}: ${err.message}`);
  }
});

export const generateSpeech = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
  const { text } = request.data || {};
  if (!text || typeof text !== 'string') throw new HttpsError('invalid-argument', 'Falta "text" (string).');

  const apiKey = OPENAI_API_KEY.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'OPENAI_API_KEY no configurada.');

  try {
    return await generateSpeechOpenAI({ apiKey, text: text.slice(0, 5000), uid: request.auth.uid });
  } catch (err) {
    throw new HttpsError('internal', `Fallo generando voz: ${err.message}`);
  }
});

export const generateImage = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Se requiere iniciar sesión.');
  const { prompt } = request.data || {};
  if (!prompt || typeof prompt !== 'string') throw new HttpsError('invalid-argument', 'Falta "prompt" (string).');

  const apiKey = OPENAI_API_KEY.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'OPENAI_API_KEY no configurada.');

  try {
    return await generateImageOpenAI({ apiKey, prompt });
  } catch (err) {
    throw new HttpsError('internal', `Fallo generando imagen: ${err.message}`);
  }
});

export const getRepoTree = onCall({ secrets: [GITHUB_TOKEN] }, async (request) => {
  await assertRepoReadAuthorized(request);
  const { owner, repo, branch = 'main' } = request.data || {};
  if (!owner || !repo) throw new HttpsError('invalid-argument', 'Faltan owner/repo.');

  const token = GITHUB_TOKEN.value();
  if (!token) throw new HttpsError('failed-precondition', 'GITHUB_TOKEN no configurado.');

  try {
    const data = await githubFetch(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, token);
    const files = (data.tree || []).map((n) => ({ path: n.path, type: n.type, size: n.size || 0 }));
    return { files, truncated: !!data.truncated };
  } catch (err) {
    throw new HttpsError('internal', `Fallo leyendo árbol repo: ${err.message}`);
  }
});

export const getRepoFile = onCall({ secrets: [GITHUB_TOKEN] }, async (request) => {
  await assertRepoReadAuthorized(request);
  const { owner, repo, path, branch = 'main' } = request.data || {};
  if (!owner || !repo || !path) throw new HttpsError('invalid-argument', 'Faltan owner/repo/path.');

  const token = GITHUB_TOKEN.value();
  if (!token) throw new HttpsError('failed-precondition', 'GITHUB_TOKEN no configurado.');

  try {
    const data = await githubFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`, token);
    if (Array.isArray(data)) throw new Error(`"${path}" es directorio; usa getRepoTree.`);
    const content = data.encoding === 'base64' ? Buffer.from(data.content, 'base64').toString('utf-8') : data.content;
    return { path, content, sha: data.sha, size: data.size };
  } catch (err) {
    throw new HttpsError('internal', `Fallo leyendo archivo: ${err.message}`);
  }
});

export const proposeRepoChanges = onCall(
  { secrets: [GITHUB_TOKEN, REPO_EDIT_ALLOWLIST, REPO_EDIT_REQUIRE_APPROVAL] },
  async (request) => {
    const claims = await assertRepoWriteAuthorized(request);
    const token = GITHUB_TOKEN.value();
    if (!token) throw new HttpsError('failed-precondition', 'GITHUB_TOKEN no configurado.');

    const allowlist = normalizeAllowlist(REPO_EDIT_ALLOWLIST.value());
    const validated = validateRepoChangeRequest(request.data, allowlist);
    const { owner, repo, baseBranch, changes } = validated;
    const title = String(request.data?.title || '').trim();
    const description = String(request.data?.description || '').trim();
    const reason = String(request.data?.reason || '').trim();
    const requireApproval = String(REPO_EDIT_REQUIRE_APPROVAL.value() || 'true').toLowerCase() === 'true';

    const auditRef = db.collection('repo_change_audits').doc();
    const auditBase = {
      id: auditRef.id,
      actor_uid: request.auth.uid,
      actor_role: claims.isFounder ? 'founder' : 'admin',
      owner,
      repo,
      base_branch: baseBranch,
      title,
      description,
      reason,
      changes,
      allowlist,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await auditRef.set({ ...auditBase, status: requireApproval ? 'pending_approval' : 'processing' });

    if (requireApproval) {
      return { audit_id: auditRef.id, status: 'pending_approval', requires_approval: true };
    }

    try {
      const result = await applyRepoChanges({
        owner,
        repo,
        baseBranch,
        changes,
        title,
        description,
        token,
        actorUid: request.auth.uid,
      });

      await auditRef.update({
        status: 'pr_opened',
        updated_at: Date.now(),
        branch: result.branch,
        pr_number: result.prNumber,
        pr_url: result.prUrl,
        rollback: result.rollback,
      });

      return { audit_id: auditRef.id, status: 'pr_opened', ...result };
    } catch (err) {
      await auditRef.update({ status: 'failed', updated_at: Date.now(), error: err.message });
      throw new HttpsError('internal', `Fallo aplicando cambios: ${err.message}`);
    }
  }
);

export const approveRepoChanges = onCall(
  { secrets: [GITHUB_TOKEN] },
  async (request) => {
    await assertRepoWriteAuthorized(request);
    const token = GITHUB_TOKEN.value();
    if (!token) throw new HttpsError('failed-precondition', 'GITHUB_TOKEN no configurado.');

    const auditId = String(request.data?.audit_id || '').trim();
    if (!auditId) throw new HttpsError('invalid-argument', 'Falta audit_id.');

    const auditRef = db.collection('repo_change_audits').doc(auditId);
    const snap = await auditRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Audit no encontrado.');
    const audit = snap.data();
    if (audit.status !== 'pending_approval') {
      throw new HttpsError('failed-precondition', `Estado no aprobable: ${audit.status}`);
    }

    await auditRef.update({
      status: 'processing',
      updated_at: Date.now(),
      approved_by: request.auth.uid,
      approved_at: Date.now(),
    });

    try {
      const result = await applyRepoChanges({
        owner: audit.owner,
        repo: audit.repo,
        baseBranch: audit.base_branch,
        changes: audit.changes,
        title: audit.title,
        description: audit.description,
        token,
        actorUid: request.auth.uid,
      });

      await auditRef.update({
        status: 'pr_opened',
        updated_at: Date.now(),
        branch: result.branch,
        pr_number: result.prNumber,
        pr_url: result.prUrl,
        rollback: result.rollback,
      });

      return { audit_id: auditId, status: 'pr_opened', ...result };
    } catch (err) {
      await auditRef.update({ status: 'failed', updated_at: Date.now(), error: err.message });
      throw new HttpsError('internal', `Fallo en aprobación: ${err.message}`);
    }
  }
);
