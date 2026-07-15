// ViviRealtimeFacts — Provides verified real-time data from the device or APIs.
// This module is the ONLY authorized source for time, date, location, and weather.
// It NEVER invents: if a source is unavailable it returns null, and the caller
// must respond with the standard "no access" fallback — never a guess.

import { ModuleBase } from '../core/ModuleBase';
import { AI } from '@/lib/aiProvider';

// Detection patterns — intentionally broad to catch natural phrasings.
const TIME_PATTERNS =
  /(?:qué\s+(?:hora|tal)\s+(?:es|son|tal)|a\s+qué\s+hora|dime\s+la\s+hora|hora\s+actual|what\s+time|what.?s\s+the\s+time)/i;

const DATE_PATTERNS =
  /(?:qué\s+(?:día|fecha)\s+(?:es|somos|estamos|tenemos)|a\s+qué\s+día|dime\s+la\s+fecha|fecha\s+actual|hoy\s+es|what\s+(?:day|date)\s+(?:is\s+it|today|is))/i;

const LOCATION_PATTERNS =
  /(?:dónde\s+(?:estoy|estamos|me\s+encuentro|nos\s+encontramos)|where\s+am\s+i|mi\s+ubicaci[oó]n|cu[aá]l\s+es\s+mi\s+ubicaci[oó]n|ubicaci[oó]n\s+actual|en\s+qu[eé]\s+(?:ciudad|pa[ií]s)\s+estoy)/i;

const WEATHER_PATTERNS =
  /(?:c[oó]mo\s+(?:est[aá]|est[aá]n|va)\s+(?:el|la)\s+(?:clima|tiempo)|qu[eé]\s+(?:tal|clima)\s+(?:hace|hay)|what.?s\s+the\s+weather|tiempo\s+actual|clima\s+(?:actual|de\s+hoy|hoy)|hace\s+(?:fr[ií]o|calor|sol|viento)|va\s+a\s+llover|temperatura\s+actual)/i;

const NO_ACCESS_MSG =
  'No puedo confirmar ese dato porque no tengo acceso en este momento.';

export default class ViviRealtimeFacts extends ModuleBase {
  constructor(bus) {
    super('realtime_facts', bus);
  }

  /**
   * Classify whether the user is asking for real-time data.
   * Returns the query type ('time' | 'date' | 'location' | 'weather') or null.
   */
  detectQuery(text) {
    if (!text) return null;
    if (TIME_PATTERNS.test(text)) return 'time';
    if (DATE_PATTERNS.test(text)) return 'date';
    if (WEATHER_PATTERNS.test(text)) return 'weather';
    if (LOCATION_PATTERNS.test(text)) return 'location';
    return null;
  }

  /** Get current time from the device clock. Always succeeds. */
  getTime(lang) {
    const now = new Date();
    const locale = this._localeFor(lang);
    const timeStr = now.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `Son las ${timeStr}.`;
  }

  /** Get current date from the device clock. Always succeeds. */
  getDate(lang) {
    const now = new Date();
    const locale = this._localeFor(lang);
    const dateStr = now.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return `Hoy es ${dateStr}.`;
  }

  /**
   * Get the user's location via the browser Geolocation API, then reverse-geocode
   * to a readable city/country using an LLM with internet context.
   * Returns null if geolocation is unavailable or the user denies permission.
   */
  async getLocation(lang) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

    const position = await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 }
      );
    });

    if (!position) return null;

    const { latitude, longitude } = position.coords;
    const locale = this._localeFor(lang);

    try {
      const res = await AI.InvokeLLM({
        prompt: `Reverse geocode these coordinates to the nearest city and country. Latitude: ${latitude}, Longitude: ${longitude}. Reply in locale ${locale}.`,
        add_context_from_internet: true,
        model: 'gemini-3.5-flash',
        response_json_schema: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['city', 'country'],
        },
      });
      if (res?.city && res?.country) {
        return `Te encuentras en ${res.city}, ${res.country}.`;
      }
      return `Te encuentras cerca de latitud ${latitude.toFixed(2)}, longitud ${longitude.toFixed(2)}.`;
    } catch {
      // Geolocation succeeded but reverse-geocoding failed — still provide coords.
      return `Te encuentras cerca de latitud ${latitude.toFixed(2)}, longitud ${longitude.toFixed(2)}.`;
    }
  }

  /**
   * Get current weather via LLM with internet context.
   * Requires a location string; returns null if the lookup fails.
   */
  async getWeather(location, lang) {
    if (!location) return null;
    const locale = this._localeFor(lang);
    try {
      const res = await AI.InvokeLLM({
        prompt: `What is the current weather in ${location}? Provide the temperature in Celsius and a brief description of conditions. Reply in locale ${locale}.`,
        add_context_from_internet: true,
        model: 'gemini-3.5-flash',
        response_json_schema: {
          type: 'object',
          properties: {
            temperature: { type: 'string' },
            conditions: { type: 'string' },
            location: { type: 'string' },
          },
          required: ['temperature', 'conditions'],
        },
      });
      if (res?.temperature && res?.conditions) {
        const loc = res.location || location;
        return `En ${loc}, la temperatura es de ${res.temperature} con ${res.conditions}.`;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Resolve a real-time query end-to-end.
   * Returns { text, available } — if available is false, text is the standard
   * "no access" message and the caller should NOT fall back to the LLM.
   */
  async resolveQuery(type, lang) {
    try {
      switch (type) {
        case 'time':
          return { text: this.getTime(lang), available: true };
        case 'date':
          return { text: this.getDate(lang), available: true };
        case 'location': {
          const loc = await this.getLocation(lang);
          return { text: loc || NO_ACCESS_MSG, available: !!loc };
        }
        case 'weather': {
          // Weather needs a location first. Try device geolocation, then query.
          const geoLoc = await this._getRawLocation();
          if (!geoLoc) return { text: NO_ACCESS_MSG, available: false };
          const weather = await this.getWeather(geoLoc, lang);
          return { text: weather || NO_ACCESS_MSG, available: !!weather };
        }
        default:
          return { text: NO_ACCESS_MSG, available: false };
      }
    } catch {
      return { text: NO_ACCESS_MSG, available: false };
    }
  }

  /** Internal: get a readable location string for weather lookups. */
  async _getRawLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    const position = await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { timeout: 10000, enableHighAccuracy: false, maximumAge: 60000 }
      );
    });
    if (!position) return null;
    const { latitude, longitude } = position.coords;
    try {
      const res = await AI.InvokeLLM({
        prompt: `Reverse geocode to city and country: latitude ${latitude}, longitude ${longitude}.`,
        add_context_from_internet: true,
        model: 'gemini-3.5-flash',
        response_json_schema: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            country: { type: 'string' },
          },
          required: ['city', 'country'],
        },
      });
      if (res?.city) return `${res.city}, ${res.country || ''}`;
      return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    } catch {
      return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    }
  }

  _localeFor(lang) {
    if (!lang || lang === 'auto') return 'es-ES';
    return lang;
  }

  getStatus() {
    return {
      geolocation: typeof navigator !== 'undefined' && !!navigator.geolocation,
    };
  }
}