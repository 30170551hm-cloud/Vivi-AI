// MOCK_base44_sdk.mjs — MOCK explícito, NO el paquete real @base44/sdk.
// Objetivo único: permitir que el bootstrap de 27 módulos de Vivi cargue en
// Node puro para verificar que no hay ReferenceError/ImportError en la
// cadena de registro. NO PRUEBA que la autenticación, memoria o LLM de
// Base44 funcionen de verdad — todos sus métodos son funciones vacías que
// devuelven valores por defecto inertes.
export function createClient() {
  const inert = async () => null;
  const inertList = async () => [];
  return {
    auth: {
      me: inert,
      updateMe: inert,
      loginViaEmailPassword: inert,
      loginWithProvider: () => {},
      logout: () => {},
      redirectToLogin: () => {},
    },
    entities: new Proxy({}, {
      get: (target, prop) => {
        if (!target[prop]) {
          target[prop] = {
            list: inertList, filter: inertList, create: inert, update: inert,
            delete: inert, deleteMany: inert, bulkCreate: inertList,
          };
        }
        return target[prop];
      },
    }),
    integrations: {
      Core: {
        InvokeLLM: inert,
        UploadFile: inert,
        GenerateImage: inert,
        GenerateSpeech: inert,
      },
    },
  };
}
