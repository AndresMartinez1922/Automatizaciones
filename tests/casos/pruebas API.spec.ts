// Importa las aserciones y el runner de Playwright para crear los smoke tests de API.
import { expect, test } from '@playwright/test';
// Importa el cliente autenticado que reutiliza el login existente de Midasoft.
import {
  createAuthenticatedMidasoftApiClient,
  type MidasoftApiClient
} from '../support/midasoft-api';

// Ejecuta esta suite de forma serial porque reutiliza una sola sesion autenticada.
test.describe.configure({ mode: 'serial' });

// Define los endpoints que vamos a validar en esta primera capa de conexion.
const apiSmokeChecks = [
  {
    title: 'MovimientosLiquidadosSabana',
    pathFragment: 'MovimientosLiquidadosSabana/ObtenerSabanaMovimientosLiquidados',
    call: (client: MidasoftApiClient) => client.getMovimientosLiquidadosSabana({ start: 1, length: 1 })
  },
  {
    title: 'SabanaAcumulados',
    pathFragment: 'SabanaAcumulados/ObtenerSabanaAcumulados',
    call: (client: MidasoftApiClient) =>
      client.getSabanaAcumulados({
        PERIODOS: {
          TipoNom: 'string',
          ClaseNom: 'string',
          Ano: 'string',
          Mes: 'string',
          Periodo: 'string'
        },
        start: 1,
        length: 1
      })
  },
  {
    title: 'SabanaMovimientoContableNomina',
    pathFragment: 'SabanaMovimientoContableNomina/ObtenerSabanaMovimientoContableNomina',
    call: (client: MidasoftApiClient) => client.getSabanaMovimientoContableNomina({ start: 1, length: 1 })
  },
  {
    title: 'SabanaNovedadesNomina',
    pathFragment: 'SabanaNovedadesNomina/ObtenerSabanaNovedadesNomina',
    call: (client: MidasoftApiClient) => client.getSabanaNovedadesNomina({ start: 1, length: 1 })
  }
] as const;

// Guarda una sola sesion API para reutilizarla en todos los smoke tests.
let apiClient: MidasoftApiClient | undefined;
// Conserva el contexto del navegador que se usa para abrir la sesion inicial.
let browserContext: { close(): Promise<void> } | undefined;

// Prepara la sesion una sola vez antes de ejecutar la bateria de conexiones.
test.beforeAll(async ({ browser }) => {
  // Da mas tiempo a la preparacion porque incluye login real contra Midasoft.
  test.setTimeout(120_000);

  // Abre un contexto aislado para obtener la sesion autenticada.
  browserContext = await browser.newContext();

  // Crea una pagina temporal donde se hace el login y se extrae la autenticacion.
  const page = await browserContext.newPage();

  // Construye el cliente API ya autenticado.
  apiClient = await createAuthenticatedMidasoftApiClient(page);

  // Cierra la pagina temporal porque ya no la necesitamos una vez creado el cliente.
  await page.close();
});

// Libera el contexto y el cliente de request al terminar la suite.
test.afterAll(async () => {
  // Cierra el cliente HTTP si llego a construirse.
  await apiClient?.dispose();

  // Cierra el contexto del navegador creado para la sesion compartida.
  await browserContext?.close();
});

// Valida que el servicio responda a cada endpoint con una sesion autenticada.
for (const smokeCheck of apiSmokeChecks) {
  // Crea un caso independiente por endpoint para facilitar el diagnostico.
  test(`conecta a ${smokeCheck.title}`, async () => {
    // El caso se ejecuta rapido; solo verificamos la capa API usando la sesion ya abierta.
    test.setTimeout(60_000);

    // Reusa la sesion autenticada preparada en beforeAll.
    const api = apiClient;

    if (!api) {
      throw new Error('No se pudo preparar el cliente autenticado de Midasoft para las APIs.');
    }

    try {
      // Ejecuta la llamada puntual del endpoint bajo prueba.
      const response = await smokeCheck.call(api);

      // La respuesta debe venir del propio servicio de integracion, no de una redirecccion o del login.
      expect(response.url()).toContain(smokeCheck.pathFragment);

      // La conexion ya no debe quedar bloqueada por falta de autenticacion.
      expect(response.status()).not.toBe(401);
      expect(response.status()).not.toBe(403);
    } finally {
      // Los recursos compartidos se cierran en afterAll; aqui no hacemos nada adicional.
    }
  });
}
