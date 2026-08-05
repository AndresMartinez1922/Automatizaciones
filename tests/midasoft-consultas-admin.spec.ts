// Importa las herramientas principales de Playwright Test.
import { expect, test } from '@playwright/test';
// Importa el generador de evidencias que crea el documento Word con pantallazos por paso.
import { EvidenceReport } from './support/evidence-report';
// Importa configuracion, credenciales y clave admin desde variables de entorno.
import { getMidasoftAdminPassword, getMidasoftCredentials, midasoftConfig } from './support/midasoft-env';
// Importa las partes reutilizables de login.
import { openMidasoftLogin, submitMidasoftLogin } from './support/midasoft-login';
// Importa las partes reutilizables del modulo de consultas admin.
import { consultasAdminSelectors, enterConsultasAdmin, executeAdminQuery } from './support/midasoft-consultas-admin';

// Agrupa las pruebas relacionadas con el modulo de consultas admin de Midasoft.
test.describe('Midasoft consultas admin', () => {
  // Omite Firefox y WebKit porque este flujo usa una cuenta real y se estabilizo para Chromium.
  test.skip(({ browserName }) => browserName !== 'chromium', 'Este flujo usa una cuenta real y se valida solo en Chromium.');

  // Define el caso de prueba principal: entrar, ejecutar la consulta y validar los resultados.
  test('usuario puede ejecutar query top 5 de EMP', async ({ page }) => {
    // Aumenta el tiempo maximo de esta prueba porque usa una pagina real y puede tardar mas de 30 segundos.
    test.setTimeout(180_000);

    // Obtiene usuario y contrasena desde variables de entorno para no guardar credenciales en el codigo.
    const credentials = getMidasoftCredentials();
    // Obtiene la clave admin desde variable de entorno.
    const adminPassword = getMidasoftAdminPassword();
    // Lee la consulta SQL centralizada para que otros tests puedan cambiarla por entorno.
    const query = midasoftConfig.query;

    // Crea el documento de evidencias que se llenara con pantallazos durante la ejecucion.
    const evidence = new EvidenceReport(test.info(), {
      caseId: 'MIDASOFT-CONSULTAS-ADMIN-EMP-TOP-5',
      description: 'Validar que el usuario pueda ingresar a Midasoft, abrir consultas admin y ejecutar la query top 5 de EMP.',
      analyst: process.env.EVIDENCE_ANALYST ?? 'Andres Giovanni Martinez Merchan',
      expectedResult: 'El sistema debe permitir ejecutar la consulta y mostrar 5 resultados.',
      query
    });

    // Guarda el error si la prueba falla para reportarlo en el documento final.
    let executionError: unknown;

    try {
      // Crea un paso BDD: Given, el estado inicial de la prueba.
      await test.step('Given el usuario abre la pagina de login', async () => {
        // Reutiliza el bloque que abre y valida la pantalla de login.
        await openMidasoftLogin(page);

        // Toma pantallazo del login cargado y lo agrega al documento de evidencias.
        await evidence.capture(page, {
          title: 'Pagina de login cargada',
          description: 'Se abre la URL de login de Midasoft y se verifica que el formulario este disponible.',
          expected: 'La pagina debe cargar y mostrar el campo Usuario.',
          actual: 'La pagina de login cargo correctamente.'
        });
      });

      // Crea un paso BDD: When, la accion que ejecuta el usuario.
      await test.step('When inicia sesion en Midasoft', async () => {
        // Reutiliza el bloque que diligencia credenciales y espera el resultado del login.
        await submitMidasoftLogin(page, credentials);

        // Toma pantallazo despues del login exitoso.
        await evidence.capture(page, {
          title: 'Sesion iniciada',
          description: 'Se diligencia usuario y contrasena, se presiona Ingresar y se espera el resultado del login.',
          expected: 'La aplicacion debe salir del formulario de login.',
          actual: 'El usuario ingreso correctamente a Midasoft.'
        });
      });

      // Crea un paso BDD intermedio para entrar al modulo administrativo.
      await test.step('And ingresa a consultas admin', async () => {
        // Reutiliza el bloque que navega a consultas admin y deja listo el editor SQL.
        const queryFrame = await enterConsultasAdmin(page, adminPassword);
        // Valida que el textarea de consulta este visible antes de continuar.
        await expect(queryFrame.locator(consultasAdminSelectors.queryTextarea)).toBeVisible();

        // Toma pantallazo del modulo admin listo para escribir SQL.
        await evidence.capture(page, {
          title: 'Modulo consultas admin habilitado',
          description: 'Se abre consultas admin, se digita la clave administrativa y se valida que aparezca el editor SQL.',
          expected: 'El sistema debe mostrar el campo para escribir la query.',
          actual: 'El editor SQL quedo visible y disponible.'
        });
      });

      // Crea un paso BDD: Then, las validaciones finales esperadas.
      await test.step('Then ejecuta la consulta y valida 5 resultados', async () => {
        // Reutiliza el bloque que ejecuta la consulta y valida que exista tabla de resultados.
        const queryFrame = await executeAdminQuery(page, query);
        // Valida que la pagina informe exactamente 5 resultados.
        await expect(queryFrame.getByText(/5 Resultados/i)).toBeVisible();

        // Toma pantallazo de la consulta ejecutada y los resultados visibles.
        await evidence.capture(page, {
          title: 'Query ejecutada con 5 resultados',
          description: `Se ejecuta la consulta SQL: ${query}.`,
          expected: 'El sistema debe mostrar ejecucion correcta y 5 resultados.',
          actual: 'La consulta se ejecuto correctamente y la tabla de resultados quedo visible.'
        });
      });
    } catch (error) {
      // Guarda el error para documentarlo antes de dejar que Playwright marque la prueba como fallida.
      executionError = error;
      // Relanza el error para conservar el comportamiento normal de Playwright.
      throw error;
    } finally {
      // Genera el documento Word y lo adjunta al reporte HTML de Playwright.
      await evidence.finalize(page, executionError);
    }
  });
});
