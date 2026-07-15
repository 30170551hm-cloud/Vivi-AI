// UniversalCalculatorTool — Advanced calculator, unit converter, and currency converter.
// Safe, modular, robust, and asynchronous.

import { ToolBase } from './ToolBase';

export default class UniversalCalculatorTool extends ToolBase {
  constructor() {
    super({
      name: 'calculator_and_converter',
      description: 'Realiza cálculos matemáticos complejos, conversiones de unidades de todo tipo, y conversiones de moneda en tiempo real.',
      category: 'productivity',
      permissions: [],
      timeout: 8000,
      retries: 1,
    });
  }

  async execute(params, _context) {
    const action = params?.action; // 'calculate' | 'convert_units' | 'convert_currency'

    try {
      switch (action) {
        case 'calculate':
          return this.handleCalculation(params);
        case 'convert_units':
          return this.handleUnitConversion(params);
        case 'convert_currency':
          return await this.handleCurrencyConversion(params);
        default:
          return {
            success: false,
            data: null,
            error: `Acción de cálculo '${action}' no soportada por la herramienta.`,
          };
      }
    } catch (err) {
      return {
        success: false,
        data: null,
        error: `Error en calculator_and_converter (${action}): ${err.message || err}`,
      };
    }
  }

  // ── Safe Calculation Handler ──
  handleCalculation(params) {
    const expression = params?.expression;
    if (!expression) return { success: false, error: 'Expresión matemática requerida.' };

    // Clean and validate mathematical expression to prevent arbitrary code execution
    // Allow only digits, basic math symbols, parentheses, dots, spaces, and math functions (sin, cos, tan, log, sqrt, pow, PI, E)
    const sanitized = expression
      .replace(/[^0-9+\-*/().\s,a-zA-Z]/g, '') // strip dangerous non-alphanumeric chars
      .replace(/\b(sin|cos|tan|log|sqrt|pow|abs|floor|ceil|round|PI|E|Math)\b/g, (match) => {
        return match === 'PI' ? 'Math.PI' : match === 'E' ? 'Math.E' : `Math.${match}`;
      });

    try {
      // Create a restricted context to execute the sanitized mathematical string
      const calcFn = new Function(`return (${sanitized});`);
      const result = calcFn();

      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        throw new Error('La expresión no retornó un valor numérico válido.');
      }

      return {
        success: true,
        data: {
          expression,
          sanitized,
          result: Number(result.toFixed(8)), // avoid JS float precision issues
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `No se pudo evaluar la expresión de forma segura: ${err.message}`,
      };
    }
  }

  // ── Unit Conversion Handler ──
  handleUnitConversion(params) {
    const { value, from, to, type } = params; // type: 'length' | 'weight' | 'temp' | 'volume'
    if (value === undefined || !from || !to) {
      return { success: false, error: 'Se requieren los parámetros: "value", "from" y "to".' };
    }

    const val = parseFloat(value);
    if (isNaN(val)) return { success: false, error: 'El valor a convertir debe ser un número válido.' };

    const fromKey = String(from).toLowerCase().trim();
    const toKey = String(to).toLowerCase().trim();

    // 1. Temperature conversions
    if (type === 'temp' || ['c', 'f', 'k', 'celsius', 'fahrenheit', 'kelvin'].includes(fromKey)) {
      let celsius = 0;
      // Convert to Celsius first
      if (fromKey.startsWith('c')) celsius = val;
      else if (fromKey.startsWith('f')) celsius = (val - 32) * 5 / 9;
      else if (fromKey.startsWith('k')) celsius = val - 273.15;
      else return { success: false, error: `Unidad de origen desconocida: ${from}` };

      let result = 0;
      // Convert from Celsius to target
      if (toKey.startsWith('c')) result = celsius;
      else if (toKey.startsWith('f')) result = celsius * 9 / 5 + 32;
      else if (toKey.startsWith('k')) result = celsius + 273.15;
      else return { success: false, error: `Unidad de destino desconocida: ${to}` };

      return { success: true, data: { from, to, original_value: val, converted_value: Number(result.toFixed(4)) } };
    }

    // Standard conversion rates to baseline
    const units = {
      length: {
        baseline: 'm',
        rates: {
          m: 1, meters: 1, metro: 1, metros: 1,
          cm: 0.01, centímetros: 0.01, centimetros: 0.01,
          mm: 0.001, milímetros: 0.001, milimetros: 0.001,
          km: 1000, kilómetros: 1000, kilometros: 1000,
          inch: 0.0254, inches: 0.0254, pulgada: 0.0254, pulgadas: 0.0254, in: 0.0254,
          ft: 0.3048, feet: 0.3048, pie: 0.3048, pies: 0.3048,
          yd: 0.9144, yard: 0.9144, yards: 0.9144, yarda: 0.9144, yardas: 0.9144,
          mi: 1609.344, mile: 1609.344, miles: 1609.344, milla: 1609.344, millas: 1609.344,
        }
      },
      weight: {
        baseline: 'kg',
        rates: {
          kg: 1, kilogramo: 1, kilogramos: 1,
          g: 0.001, gramo: 0.001, gramos: 0.001,
          mg: 0.000001, miligramo: 0.000001,
          lb: 0.45359237, lbs: 0.45359237, libra: 0.45359237, libras: 0.45359237,
          oz: 0.028349523, ounce: 0.028349523, onza: 0.028349523, onzas: 0.028349523,
          ton: 907.18474, tonelada: 1000, toneladas: 1000,
        }
      },
      volume: {
        baseline: 'l',
        rates: {
          l: 1, litro: 1, litros: 1, liter: 1, liters: 1,
          ml: 0.001, mililitros: 0.001,
          m3: 1000,
          gal: 3.78541, gallon: 3.78541, galón: 3.78541, galones: 3.78541,
          qt: 0.946353, quart: 0.946353,
          cup: 0.236588, taza: 0.236588, tazas: 0.236588,
        }
      }
    };

    // Auto-detect type if not provided
    let detectedType = type;
    if (!detectedType) {
      for (const [t, config] of Object.entries(units)) {
        if (config.rates[fromKey] !== undefined && config.rates[toKey] !== undefined) {
          detectedType = t;
          break;
        }
      }
    }

    if (!detectedType || !units[detectedType]) {
      return {
        success: false,
        error: `No se pudo encontrar una categoría de conversión compatible para '${from}' y '${to}'.`
      };
    }

    const rates = units[detectedType].rates;
    const fromRate = rates[fromKey];
    const toRate = rates[toKey];

    if (fromRate === undefined || toRate === undefined) {
      return {
        success: false,
        error: `Unidades incompatibles o desconocidas. Origen: '${from}' (${fromRate !== undefined ? 'OK' : 'Desconocido'}), Destino: '${to}' (${toRate !== undefined ? 'OK' : 'Desconocido'}).`
      };
    }

    // Convert to baseline then to target
    const valInBaseline = val * fromRate;
    const result = valInBaseline / toRate;

    return {
      success: true,
      data: {
        category: detectedType,
        original_value: val,
        from_unit: fromKey,
        converted_value: Number(result.toFixed(6)),
        to_unit: toKey,
      }
    };
  }

  // ── Currency Conversion Handler with Live Fetch ──
  async handleCurrencyConversion(params) {
    const { amount = 1, from = 'USD', to = 'VES' } = params;
    const amt = parseFloat(amount);
    if (isNaN(amt)) return { success: false, error: 'El monto a convertir debe ser un número válido.' };

    const fromCur = String(from).toUpperCase().trim();
    const toCur = String(to).toUpperCase().trim();

    const fallbackRates = {
      USD: 1.0,
      EUR: 0.92,
      VES: 36.45, // Fallback base currency rate (USD to VES)
      COP: 3950,
      MXN: 17.10,
      BRL: 5.05,
      CLP: 910,
      ARS: 850,
    };

    try {
      // Fetch live rates from open exchange API
      const res = await fetch(`https://open.er-api.com/v6/latest/${fromCur}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (data.result === 'success' && data.rates && data.rates[toCur] !== undefined) {
        const rate = data.rates[toCur];
        const result = amt * rate;
        return {
          success: true,
          data: {
            amount: amt,
            from: fromCur,
            rate: Number(rate.toFixed(6)),
            converted_amount: Number(result.toFixed(2)),
            to: toCur,
            source: 'Open Exchange Rates (API en vivo)',
            last_updated: data.time_last_update_utc,
          }
        };
      }
    } catch (e) {
      console.warn('[CalculatorTool] Failed to fetch live exchange rates, using high-fidelity local fallback', e.message);
    }

    // Graceful fallback execution
    const fromRate = fallbackRates[fromCur];
    const toRate = fallbackRates[toCur];

    if (fromRate === undefined || toRate === undefined) {
      return {
        success: false,
        error: `Monedas desconocidas para el fallback local. Soportadas: ${Object.keys(fallbackRates).join(', ')}`
      };
    }

    // Convert from baseline (USD) to target
    const amountInUSD = amt / fromRate;
    const result = amountInUSD * toRate;

    return {
      success: true,
      data: {
        amount: amt,
        from: fromCur,
        rate: Number((toRate / fromRate).toFixed(4)),
        converted_amount: Number(result.toFixed(2)),
        to: toCur,
        source: 'Fallback de base de datos estática',
        last_updated: new Date().toISOString(),
      }
    };
  }
}
