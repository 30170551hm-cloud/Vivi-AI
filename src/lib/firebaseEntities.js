// firebaseEntities.js — Adaptador Firestore que replica la forma exacta de la
// API `base44.entities.<Nombre>.*` usada hoy por ViviMemory.js y useChat.js.
//
// OBJETIVO: que migrar un módulo sea cambiar UNA línea de import, no reescribir
// la lógica de negocio. Cada método de aquí replica el método equivalente de
// Base44 verificado por grep en el repo real:
//   .list(sort, limit)              → ej: Memory.list('-importance', 200)
//   .filter(query, sort, limit)     → ej: ChatMessage.filter({conversation_id}, 'created_date', 200)
//   .create(data)                   → añade ownerId automáticamente (request.auth.uid)
//   .update(id, patch)
//   .delete(id)
//   .deleteMany(query)
//   .bulkCreate(records)
//
// ESTADO: escrito y sintácticamente verificado (node --check), pero NO PROBADO
// contra un proyecto Firebase real (este entorno no tiene credenciales ni red).
// NO está importado por ningún módulo de producción todavía — cero riesgo para
// el flujo actual, que sigue funcionando 100% sobre Base44.
//
// Antes de conectar esto de verdad:
//   1. Desplegar firestore.rules a un proyecto real.
//   2. Probar cada método contra el emulador o un proyecto de staging.
//   3. Recién entonces cambiar el import en ViviMemory.js / useChat.js / etc.

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as fsLimit,
  writeBatch,
  serverTimestamp,
  getFirestore,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import app from './firebase';

/**
 * Convierte el string de orden estilo Base44 ('-importance', 'created_date')
 * en los parámetros de orderBy de Firestore.
 */
function parseSort(sort) {
  if (!sort) return null;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return orderBy(field, desc ? 'desc' : 'asc');
}

function requireUid() {
  const auth = getAuth(app);
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('No hay usuario autenticado (Firebase Auth). Operación bloqueada.');
  }
  return uid;
}

function docToRecord(d) {
  return { id: d.id, ...d.data() };
}

/**
 * Crea un adaptador de entidad para una colección de Firestore, con la misma
 * forma de API que `base44.entities.<Nombre>`.
 * @param {string} collectionName - nombre de la colección Firestore, ej. 'memories'
 * @param {{ scopedToOwner?: boolean }} opts - si true (default), filtra/inyecta
 *   ownerId = uid actual en todas las operaciones (aislamiento por usuario).
 */
export function createFirestoreEntity(collectionName, opts = {}) {
  const { scopedToOwner = true } = opts;
  const db = getFirestore(app);
  const colRef = collection(db, collectionName);

  return {
    /** Lista documentos, ordenados como en Base44 ('-campo' = descendente). */
    async list(sort, limitCount) {
      const constraints = [];
      if (scopedToOwner) constraints.push(where('ownerId', '==', requireUid()));
      const sortConstraint = parseSort(sort);
      if (sortConstraint) constraints.push(sortConstraint);
      if (limitCount) constraints.push(fsLimit(limitCount));
      const snap = await getDocs(query(colRef, ...constraints));
      return snap.docs.map(docToRecord);
    },

    /** Filtra por campos exactos (equivalente a base44 .filter(queryObj, sort, limit)). */
    async filter(filterObj = {}, sort, limitCount) {
      const constraints = [];
      if (scopedToOwner) constraints.push(where('ownerId', '==', requireUid()));
      for (const [field, value] of Object.entries(filterObj)) {
        constraints.push(where(field, '==', value));
      }
      const sortConstraint = parseSort(sort);
      if (sortConstraint) constraints.push(sortConstraint);
      if (limitCount) constraints.push(fsLimit(limitCount));
      const snap = await getDocs(query(colRef, ...constraints));
      return snap.docs.map(docToRecord);
    },

    /** Crea un documento, inyectando ownerId + timestamps automáticamente. */
    async create(data) {
      const payload = {
        ...data,
        ...(scopedToOwner ? { ownerId: requireUid() } : {}),
        created_date: serverTimestamp(),
        updated_date: serverTimestamp(),
      };
      const ref = await addDoc(colRef, payload);
      return { id: ref.id, ...payload };
    },

    /** Actualiza un documento existente por id. */
    async update(id, patch) {
      const ref = doc(db, collectionName, id);
      const payload = { ...patch, updated_date: serverTimestamp() };
      await updateDoc(ref, payload);
      return { id, ...payload };
    },

    /** Elimina un documento por id. */
    async delete(id) {
      await deleteDoc(doc(db, collectionName, id));
      return { id };
    },

    /** Elimina todos los documentos que matcheen el filtro (batch). */
    async deleteMany(filterObj = {}) {
      const constraints = [];
      if (scopedToOwner) constraints.push(where('ownerId', '==', requireUid()));
      for (const [field, value] of Object.entries(filterObj)) {
        constraints.push(where(field, '==', value));
      }
      const snap = await getDocs(query(colRef, ...constraints));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      return { deleted: snap.docs.length };
    },

    /** Crea múltiples documentos en una sola escritura por lotes. */
    async bulkCreate(records) {
      const uid = scopedToOwner ? requireUid() : null;
      const batch = writeBatch(db);
      const created = [];
      for (const data of records) {
        const ref = doc(colRef);
        const payload = {
          ...data,
          ...(uid ? { ownerId: uid } : {}),
          created_date: serverTimestamp(),
          updated_date: serverTimestamp(),
        };
        batch.set(ref, payload);
        created.push({ id: ref.id, ...payload });
      }
      await batch.commit();
      return created;
    },
  };
}

// ── Entidades mapeadas 1:1 contra base44/entities/*.jsonc (ver informe de auditoría) ──
export const FirestoreEntities = {
  Memory: createFirestoreEntity('memories'),
  Conversation: createFirestoreEntity('conversations'),
  ChatMessage: createFirestoreEntity('chat_messages'),
  ToolAction: createFirestoreEntity('tool_actions'),
  ImprovementProposal: createFirestoreEntity('improvement_proposals', { scopedToOwner: false }),
  CertificationTest: createFirestoreEntity('certification_tests', { scopedToOwner: false }),
};
