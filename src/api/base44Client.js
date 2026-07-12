import { appParams } from "@/lib/app-params";

const { appId } = appParams;

function createStub() {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        return (...args) => {
          console.warn(
            `[Base44 deshabilitado] Se intentó usar "${String(
              prop
            )}" pero Base44 está desactivado.`,
            args
          );

          return Promise.resolve(null);
        };
      },
    }
  );
}

if (!appId) {
  console.warn(
    "[Base44] No hay VITE_BASE44_APP_ID configurado. Vivi funcionará usando Firebase."
  );
}

export const base44 = createStub();
