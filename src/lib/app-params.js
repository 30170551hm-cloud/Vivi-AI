const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

// Normaliza valores de variables de entorno: trata "null", "undefined" y
// cadenas vacías/solo-espacios como NO configurado. Sin esto, un .env con
// VITE_BASE44_APP_ID=null escrito como texto literal (en vez de estar
// vacío) se trataba como un app_id real y válido, porque el string "null"
// es truthy en JavaScript — causa raíz confirmada del bug reportado
// (404 en /api/apps/auth/login con un appId inválido).
export const normalizeEnvValue = (value) => {
	if (value === undefined || value === null) return undefined;
	const trimmed = String(value).trim();
	if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
		return undefined;
	}
	return trimmed;
};

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	if (defaultValue) {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	// Limpia valores "null"/"undefined" que hayan quedado guardados de una
	// ejecución anterior con el .env mal configurado — si no se limpian,
	// seguirían devolviéndose aunque el .env ya esté corregido.
	if (storedValue) {
		const normalizedStored = normalizeEnvValue(storedValue);
		if (!normalizedStored) {
			storage.removeItem(storageKey);
			return null;
		}
		return normalizedStored;
	}
	return null;
}

const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
	}
	return {
		appId: getAppParamValue("app_id", { defaultValue: normalizeEnvValue(import.meta.env.VITE_BASE44_APP_ID) }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: isNode ? undefined : window.location.href }),
		functionsVersion: getAppParamValue("functions_version", { defaultValue: normalizeEnvValue(import.meta.env.VITE_BASE44_FUNCTIONS_VERSION) }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: normalizeEnvValue(import.meta.env.VITE_BASE44_APP_BASE_URL) }),
	}
}


export const appParams = {
	...getAppParams()
}
