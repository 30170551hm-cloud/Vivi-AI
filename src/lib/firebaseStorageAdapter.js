// firebaseStorageAdapter.js — Reemplazo de backend.integrations.Core.UploadFile.
// Subida directa a Firebase Storage desde el cliente (no necesita Cloud
// Function). Verificado contra los 4 call sites reales del repo
// (TextComposer.jsx x2, useChat.js, FileManagementTool.js):
//
//   const result = await backend.integrations.Core.UploadFile({ file });
//   // result.file_url usado después
//
// ESTADO: escrito y verificado sintácticamente. NO conectado a ningún módulo
// de producción todavía. Requiere que firebase.storage esté habilitado en el
// proyecto real y que las Storage Security Rules permitan la escritura del
// usuario autenticado (regla equivalente a firestore.rules, pendiente de
// escribir junto con el resto de storage.rules cuando exista el proyecto real).

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app, auth, storage } from './firebase';

/**
 * Reemplazo directo de backend.integrations.Core.UploadFile.
 * @param {{file: File}} params
 * @returns {Promise<{file_url: string}>}
 */
export async function UploadFile({ file }) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('No hay usuario autenticado — no se puede subir el archivo.');

  const safeName = `${Date.now()}_${file.name}`.replace(/[^\w.\-]/g, '_');
  const path = `uploads/${uid}/${safeName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  return { file_url: url };
}
