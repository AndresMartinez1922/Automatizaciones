// Importa el cliente de request de Playwright para hacer llamadas HTTP autenticadas.
import { request, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
// Importa la configuracion centralizada de las APIs de Midasoft.
import { midasoftApiConfig } from './midasoft-env';
// Reutiliza el login existente para abrir una sesion valida antes de consumir las APIs.
import { loginToMidasoft } from './midasoft-login';
// Reutiliza las credenciales centralizadas del proyecto.
import { getMidasoftCredentials } from './midasoft-env';

// Describe el conjunto de valores que puede serializarse como query string.
type QueryValue = string | number | boolean | null | undefined | Record<string, unknown> | readonly QueryValue[];

// Define el contrato de entrada para MovimientosLiquidadosSabana.
export type MovimientosLiquidadosSabanaQuery = {
  EMPLEADO?: string;
  ANO?: string;
  MES?: string;
  PERIODO?: string;
  DIVISION?: string;
  AGRUPACION?: string;
  DPTO?: string;
  CCOSTO?: string;
  SECCION?: string;
  AREA?: string;
  NIVEL?: string;
  UBICACION?: string;
  GRUPO?: string;
  SUBGRUPO?: string;
  PROYECTO?: string;
  SUBDIVISION?: string;
  REL_LABORAL?: string;
  REL_SINDICAL?: string;
  CLASE_EMP?: string;
  OFICIO?: string;
  PRODUCTO?: string;
  SUCURSAL?: string;
  CLASE_NOM?: string;
  TIPO_NOM?: string;
  'Search.value'?: string;
  start?: number;
  length?: number;
};

// Define el contrato de entrada para SabanaAcumulados.
export type SabanaAcumuladosQuery = {
  CNSACU?: number;
  EMPLEADO?: string;
  TIPO_NOM?: string;
  CLASE_NOM?: string;
  ANO?: string;
  MES?: string;
  PERIODO?: string;
  CONCEPTOS?: readonly string[];
  DIVISION?: string;
  PERIODOS?: QueryValue;
  'Search.value'?: string;
  start?: number;
  length?: number;
};

// Define el contrato de entrada para SabanaMovimientoContableNomina.
export type SabanaMovimientoContableNominaQuery = {
  CNSMCN?: number;
  COMPANIA?: string;
  DIVISION?: string;
  COMPROBANTE?: string;
  ANO?: string;
  MES?: string;
  TIPO_NOM?: string;
  CLASE_NOM?: string;
  PERIODO_N?: string;
  'Search.value'?: string;
  start?: number;
  length?: number;
};

// Define el contrato de entrada para SabanaNovedadesNomina.
export type SabanaNovedadesNominaQuery = {
  CNSNVN?: number;
  AGRUPACION?: string;
  TIPO_NOM?: string;
  CLASE_NOM?: string;
  ANO?: string;
  MES?: string;
  PERIODO?: string;
  CONCEPTOS?: readonly string[];
  EMPLEADO?: string;
  CCOSTO?: string;
  F_NOVEDAD?: string;
  F_NOVEDAD_INI?: string;
  F_NOVEDAD_FIN?: string;
  'Search.value'?: string;
  start?: number;
  length?: number;
};

// Describe el cliente de API ya autenticado que usaran los casos de prueba.
export type MidasoftApiClient = {
  // Indica de donde salio el token usado para las llamadas.
  authSource: 'env' | 'storage' | 'none';
  // Guarda el token encontrado, si existe, para diagnostico y trazabilidad.
  token?: string;
  // Contexto de request que enviara los headers y cookies correctos.
  request: APIRequestContext;
  // Cierra el contexto HTTP cuando el caso termina.
  dispose(): Promise<void>;
  // Llama al endpoint de MovimientosLiquidadosSabana.
  getMovimientosLiquidadosSabana(query?: MovimientosLiquidadosSabanaQuery): Promise<APIResponse>;
  // Llama al endpoint de SabanaAcumulados.
  getSabanaAcumulados(query?: SabanaAcumuladosQuery): Promise<APIResponse>;
  // Llama al endpoint de SabanaMovimientoContableNomina.
  getSabanaMovimientoContableNomina(query?: SabanaMovimientoContableNominaQuery): Promise<APIResponse>;
  // Llama al endpoint de SabanaNovedadesNomina.
  getSabanaNovedadesNomina(query?: SabanaNovedadesNominaQuery): Promise<APIResponse>;
};

// Reconoce valores que ya vienen listos como token Bearer o JWT.
function normalizeTokenCandidate(value: string): string | null {
  // Limpia espacios antes de comparar.
  const trimmed = value.trim();

  // Ignora cadenas vacias o muy cortas.
  if (!trimmed) {
    return null;
  }

  // Si el valor ya viene prefijado con Bearer, conserva solo el token.
  const bearerMatch = trimmed.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch?.[1]) {
    return bearerMatch[1].trim();
  }

  // Reconoce JWTs clasicos con tres bloques separados por puntos.
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  // Devuelve null cuando el valor no parece util para autenticacion Bearer.
  return null;
}

// Convierte un valor de query string al formato que entiende URLSearchParams.
function appendQueryValue(searchParams: URLSearchParams, key: string, value: QueryValue): void {
  // Omite valores vacios para no contaminar la URL final.
  if (value === undefined || value === null || value === '') {
    return;
  }

  // Si el valor es un arreglo, lo serializa elemento por elemento.
  if (Array.isArray(value)) {
    for (const item of value) {
      appendQueryValue(searchParams, key, item);
    }

    return;
  }

  // Si el valor es un objeto, lo convierte a JSON porque ese es el formato que usa el servicio para filtros compuestos.
  if (typeof value === 'object') {
    searchParams.append(key, JSON.stringify(value));
    return;
  }

  // Para strings, numeros y booleanos basta con enviarlos como texto.
  searchParams.append(key, String(value));
}

// Serializa un objeto de query a una cadena lista para anexar a la URL.
function buildQueryString(query: Record<string, QueryValue>): string {
  // Crea el contenedor de pares llave-valor.
  const searchParams = new URLSearchParams();

  // Recorre las claves definidas por el caso de prueba.
  for (const [key, value] of Object.entries(query)) {
    // Agrega cada valor respetando arrays, objetos y tipos primitivos.
    appendQueryValue(searchParams, key, value);
  }

  // Devuelve la query serializada.
  return searchParams.toString();
}

// Recolecta cualquier token util desde variables de entorno, cookies o storage del navegador.
async function discoverApiToken(page: Page): Promise<string | undefined> {
  // Si ya existe un token directo en variables de entorno, no hace falta inspeccionar el navegador.
  const explicitToken = midasoftApiConfig.token;

  if (explicitToken) {
    return explicitToken;
  }

  // Construye una lista de candidatos a partir de la sesion del navegador.
  const candidates: Array<{ source: string; key: string; value: string }> = [];

  // Consulta el estado del contexto para obtener cookies y localStorage persistido.
  const storageState = await page.context().storageState();

  // Agrega cookies como candidatos, porque algunas sesiones guardan el token ahi.
  for (const cookie of storageState.cookies) {
    candidates.push({ source: 'cookie', key: cookie.name, value: cookie.value });
  }

  // Agrega localStorage persistido por origen.
  for (const origin of storageState.origins) {
    for (const item of origin.localStorage) {
      candidates.push({ source: 'localStorage', key: item.name, value: item.value });
    }
  }

  // Agrega localStorage y sessionStorage en tiempo real por si el token solo vive en memoria del front.
  const runtimeStorage = await page.evaluate(() => ({
    localStorage: Object.entries(localStorage),
    sessionStorage: Object.entries(sessionStorage),
    cookie: document.cookie
  }));

  for (const [key, value] of runtimeStorage.localStorage) {
    candidates.push({ source: 'localStorage', key, value });
  }

  for (const [key, value] of runtimeStorage.sessionStorage) {
    candidates.push({ source: 'sessionStorage', key, value });
  }

  if (runtimeStorage.cookie) {
    for (const cookieChunk of runtimeStorage.cookie.split(';')) {
      const [rawKey, ...rawValue] = cookieChunk.split('=');
      const key = rawKey?.trim();
      const value = rawValue.join('=').trim();

      if (key && value) {
        candidates.push({ source: 'document.cookie', key, value });
      }
    }
  }

  // Prioriza tokens hallados en claves que ya suenan a autenticacion.
  for (const candidate of candidates) {
    const normalized = normalizeTokenCandidate(candidate.value);

    if (normalized) {
      return normalized;
    }
  }

  // Si no hay JWT, intenta capturar el valor almacenado bajo llaves tipicas de autenticacion.
  const recognizedKeyNames = new Set(['token', 'accesstoken', 'authtoken', 'idtoken', 'refreshtoken', 'authorization', 'bearer', 'auth']);

  for (const candidate of candidates) {
    const normalizedKey = candidate.key.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!recognizedKeyNames.has(normalizedKey)) {
      continue;
    }

    const trimmed = candidate.value.trim();

    if (trimmed.length > 20) {
      return trimmed;
    }
  }

  // Si no se encontro nada, deja que el request use solo cookies del storageState.
  return undefined;
}

// Crea el contexto HTTP autenticado que reutilizan las pruebas de APIs.
export async function createMidasoftApiClient(page: Page): Promise<MidasoftApiClient> {
  // Guarda el estado completo del navegador para conservar cookies de la sesion iniciada.
  const storageState = await page.context().storageState();

  // Intenta recuperar un token Bearer cuando el front lo guarda en storage o cookies legibles.
  const token = await discoverApiToken(page);

  // Construye los headers base para todas las llamadas.
  const extraHTTPHeaders: Record<string, string> = {
    Accept: 'application/json'
  };

  // Si el token existe, lo manda en Authorization para cubrir el contrato Bearer del backend.
  if (token) {
    extraHTTPHeaders.Authorization = `Bearer ${token}`;
  }

  // Abre un request context dedicado a las APIs de integracion.
  const apiContext = await request.newContext({
    baseURL: midasoftApiConfig.baseUrl,
    storageState,
    extraHTTPHeaders
  });

  // Reutiliza una sola funcion para llamar a cualquier endpoint de la integracion.
  const get = (path: string, query: Record<string, QueryValue> = {}): Promise<APIResponse> => {
    // Convierte la query al formato esperado por el backend.
    const queryString = buildQueryString(query);

    // Arma la URL relativa dentro del api/v1.
    const url = queryString ? `${path}?${queryString}` : path;

    // Ejecuta la llamada GET con la autenticacion configurada.
    return apiContext.get(url);
  };

  // Devuelve el cliente con helpers de dominio y un dispose controlado.
  return {
    authSource:
      token ? 'env' : storageState.cookies.length || storageState.origins.some((origin) => origin.localStorage.length) ? 'storage' : 'none',
    token,
    request: apiContext,
    dispose: async () => {
      await apiContext.dispose();
    },
    getMovimientosLiquidadosSabana: (query = { start: 1, length: 1 }) =>
      get('MovimientosLiquidadosSabana/ObtenerSabanaMovimientosLiquidados', query),
    getSabanaAcumulados: (query = { start: 1, length: 1 }) => get('SabanaAcumulados/ObtenerSabanaAcumulados', query),
    getSabanaMovimientoContableNomina: (query = { start: 1, length: 1 }) =>
      get('SabanaMovimientoContableNomina/ObtenerSabanaMovimientoContableNomina', query),
    getSabanaNovedadesNomina: (query = { start: 1, length: 1 }) =>
      get('SabanaNovedadesNomina/ObtenerSabanaNovedadesNomina', query)
  };
}

// Ejecuta el login del front y luego crea el cliente autenticado para las APIs.
export async function createAuthenticatedMidasoftApiClient(page: Page): Promise<MidasoftApiClient> {
  // Inicia sesion con las credenciales configuradas en el entorno.
  await loginToMidasoft(page, getMidasoftCredentials());

  // Reutiliza la sesion ya abierta para construir el contexto HTTP autenticado.
  return createMidasoftApiClient(page);
}
