// GoogleMapsPlatformTool — Maps, Geocoding, Routing, and Weather tool.
// Implements real external API integrations with full error handling.

import { ToolBase } from './ToolBase';

export default class GoogleMapsPlatformTool extends ToolBase {
  constructor() {
    super({
      name: 'maps_and_weather',
      description: 'Consulta direcciones, calcula rutas entre puntos, busca lugares de interés y obtiene pronósticos del clima.',
      category: 'research',
      permissions: ['maps:read', 'weather:read'],
      timeout: 12000,
      retries: 1,
    });
  }

  async execute(params, _context) {
    const action = params?.action; // 'geocode' | 'route' | 'weather' | 'places'
    const apiKey = params?.maps_api_key || process.env.GOOGLE_MAPS_API_KEY || null;

    try {
      if (action === 'weather') {
        return await this.fetchWeather(params);
      }

      // Maps actions require a Google Maps API Key
      if (!apiKey) {
        return {
          success: false,
          data: null,
          error: `Se requiere una clave de API de Google Maps ('GOOGLE_MAPS_API_KEY') para geolocalización, rutas o lugares. 
Por favor declárala en tu configuración o pásala en los parámetros.
Sin embargo, ¡puedes usar la acción "weather" sin clave para ver el clima!`,
        };
      }

      switch (action) {
        case 'geocode':
          return await this.geocodeAddress(params, apiKey);
        case 'route':
          return await this.calculateRoute(params, apiKey);
        case 'places':
          return await this.searchPlaces(params, apiKey);
        default:
          return {
            success: false,
            data: null,
            error: `Acción '${action}' no soportada por el motor de mapas y clima.`,
          };
      }
    } catch (err) {
      return {
        success: false,
        data: null,
        error: `Error en maps_and_weather (${action}): ${err.message || err}`,
      };
    }
  }

  // ── Weather integration (no API key required, uses open-meteo/geocoding) ──
  async fetchWeather(params) {
    const location = params?.location || 'Caracas, VE';
    
    // First geocode using public nominatim
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
    const geoRes = await fetch(geoUrl, {
      headers: { 'User-Agent': 'ViviAI-Assistant-App' }
    });
    
    if (!geoRes.ok) {
      throw new Error(`Fallo de geolocalización pública para el clima de '${location}'`);
    }
    
    const geoData = await geoRes.json();
    if (!geoData || geoData.length === 0) {
      return { success: false, error: `No se pudo encontrar la ubicación: '${location}'` };
    }

    const { lat, lon, display_name } = geoData[0];

    // Fetch real-time weather from open-meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
    const weatherRes = await fetch(weatherUrl);
    if (!weatherRes.ok) {
      throw new Error(`Fallo de conexión con el servicio meteorológico para '${location}'`);
    }

    const weatherData = await weatherRes.json();
    const current = weatherData?.current_weather;

    // Map weather codes to simple descriptions
    const weatherCodes = {
      0: 'Despejado',
      1: 'Principalmente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
      45: 'Niebla', 48: 'Niebla de escarcha',
      51: 'Llovizna ligera', 53: 'Llovizna moderada', 55: 'Llovizna densa',
      61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia fuerte',
      71: 'Nieve ligera', 73: 'Nieve moderada', 75: 'Nieve fuerte',
      80: 'Chubascos de lluvia ligeros', 81: 'Chubascos de lluvia moderados', 82: 'Chubascos de lluvia violentos',
      95: 'Tormenta eléctrica ligera o moderada', 96: 'Tormenta con granizo ligero', 99: 'Tormenta con granizo fuerte'
    };

    const condition = weatherCodes[current?.weathercode] || 'Condiciones variables';

    return {
      success: true,
      data: {
        location: display_name,
        latitude: lat,
        longitude: lon,
        temperature: current?.temperature,
        wind_speed: current?.windspeed,
        wind_direction: current?.winddirection,
        condition,
        time: current?.time,
        unit: '°C'
      }
    };
  }

  // ── Google Geocoding API ──
  async geocodeAddress(params, apiKey) {
    const address = params?.address;
    if (!address) return { success: false, error: 'Parámetro "address" requerido.' };

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Geocoding falló: HTTP ${res.status}`);

    const data = await res.json();
    if (data.status !== 'OK') {
      return { success: false, error: `Error de Google Maps API: ${data.status} - ${data.error_message || ''}` };
    }

    const result = data.results[0];
    return {
      success: true,
      data: {
        formatted_address: result.formatted_address,
        location: result.geometry?.location, // { lat, lng }
        place_id: result.place_id,
        types: result.types
      }
    };
  }

  // ── Google Routes/Directions API ──
  async calculateRoute(params, apiKey) {
    const origin = params?.origin;
    const destination = params?.destination;
    const mode = params?.mode || 'driving'; // driving, walking, bicycling, transit

    if (!origin || !destination) {
      return { success: false, error: 'Parámetros "origin" y "destination" requeridos.' };
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Directions falló: HTTP ${res.status}`);

    const data = await res.json();
    if (data.status !== 'OK') {
      return { success: false, error: `Error de Google Directions API: ${data.status} - ${data.error_message || ''}` };
    }

    const route = data.routes[0];
    const leg = route?.legs?.[0];

    return {
      success: true,
      data: {
        origin_address: leg?.start_address,
        destination_address: leg?.end_address,
        distance: leg?.distance?.text,
        duration: leg?.duration?.text,
        summary: route?.summary,
        steps: (leg?.steps || []).map((step) => ({
          instruction: step.html_instructions?.replace(/<[^>]*>/g, ''), // strip HTML
          distance: step.distance?.text,
          duration: step.duration?.text
        }))
      }
    };
  }

  // ── Google Places API (New/Legacy) ──
  async searchPlaces(params, apiKey) {
    const query = params?.query;
    const location = params?.location; // e.g. "lat,lng"
    const radius = params?.radius || 5000; // default 5km

    if (!query) return { success: false, error: 'Parámetro "query" para búsqueda de lugares requerido.' };

    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    if (location) {
      url += `&location=${encodeURIComponent(location)}&radius=${radius}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Places falló: HTTP ${res.status}`);

    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return { success: false, error: `Error de Google Places API: ${data.status}` };
    }

    const places = (data.results || []).slice(0, 10).map((p) => ({
      name: p.name,
      formatted_address: p.formatted_address,
      rating: p.rating,
      user_ratings_total: p.user_ratings_total,
      location: p.geometry?.location,
      types: p.types
    }));

    return { success: true, data: { places } };
  }
}
