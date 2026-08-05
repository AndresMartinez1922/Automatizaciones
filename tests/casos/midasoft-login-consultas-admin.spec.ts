// Importa las herramientas principales de Playwright Test.
import { expect, test } from '@playwright/test';
// Importa el generador de evidencias que crea el documento Word con pantallazos.
import { EvidenceReport } from '../support/evidence-report';
// Importa credenciales y clave admin desde variables de entorno.
import { getMidasoftAdminPassword, getMidasoftCredentials } from '../support/midasoft-env';
// Importa las partes reutilizables del login.
import { openMidasoftLogin, submitMidasoftLogin } from '../support/midasoft-login';
// Importa la parte reutilizable que abre consultas admin y sus selectores centralizados.
import { consultasAdminSelectors, enterConsultasAdmin } from '../support/midasoft-consultas-admin';

// Agrupa el flujo base que ejecuta las dos partes automatizadas en orden.
test.describe('Midasoft flujo base', () => {
  // Omite Firefox y WebKit porque este flujo usa una cuenta real y se estabilizo para Chromium.
  test.skip(({ browserName }) => browserName !== 'chromium', 'Este flujo usa una cuenta real y se valida solo en Chromium.');

  // Ejecuta primero el login y luego el acceso a consultas admin dentro del mismo caso.
  test('usuario puede iniciar sesion y entrar a consultas admin', async ({ page }) => {
    // Aumenta el tiempo maximo porque el flujo usa una pagina real y dos navegaciones.
    test.setTimeout(180_000);

    // Obtiene usuario y contrasena desde variables de entorno.
    const credentials = getMidasoftCredentials();
    // Obtiene la clave administrativa desde variables de entorno.
    const adminPassword = getMidasoftAdminPassword();

    // Crea el documento de evidencias que se guardara en output/evidencias.
    const evidence = new EvidenceReport(test.info(), {
      caseId: 'MIDASOFT-FLUJO-BASE-LOGIN-CONSULTAS-ADMIN',
      description: 'Validar que el usuario pueda iniciar sesion en Midasoft e ingresar al modulo Consultas Admin.',
      analyst: process.env.EVIDENCE_ANALYST ?? 'Andres Giovanni Martinez Merchan',
      expectedResult: 'El sistema debe permitir completar el login y mostrar el editor SQL de Consultas Admin.'
    });

    // Guarda aqui cualquier error para incluirlo en el documento final antes de fallar la prueba.
    let executionError: unknown;

    try {
      // Primera parte: cargar el login.
      await test.step('Given el usuario abre la pagina de login', async () => {
        // Abre la pagina de login y valida que el formulario este disponible.
        await openMidasoftLogin(page);

        // Captura evidencia del login cargado.
        await evidence.capture(page, {
          title: 'Pagina de login cargada',
          description: 'Se abre la URL de login de Midasoft y se valida que el formulario este disponible.',
          expected: 'La pantalla debe mostrar los campos necesarios para iniciar sesion.',
          actual: 'La pagina de login cargo correctamente.'
        });
      });

      // Primera parte: ejecutar el login.
      await test.step('When inicia sesion con credenciales validas', async () => {
        // Diligencia usuario y contrasena, presiona Ingresar y espera el resultado.
        await submitMidasoftLogin(page, credentials);

        // Captura evidencia despues del login exitoso.
        await evidence.capture(page, {
          title: 'Login completado',
          description: 'Se diligencian las credenciales y se confirma el ingreso a Midasoft.',
          expected: 'La aplicacion debe salir de la pantalla de login.',
          actual: 'El usuario ingreso correctamente a la aplicacion.'
        });
      });

      // Valida que la primera parte termino correctamente antes de pasar a la segunda.
      await test.step('Then el login queda completado', async () => {
        // Valida que la URL ya no sea la pantalla de login.
        await expect(page).not.toHaveURL(/\/login\//i);
        // Valida que la sesion siga dentro de Midasoft.
        await expect(page).toHaveURL(/\/NGMidasoft\//i);
      });

      // Segunda parte: entrar a consultas admin con la sesion ya iniciada.
      await test.step('And ingresa a consultas admin', async () => {
        // Navega a consultas admin, ingresa clave administrativa y obtiene el iframe del editor SQL.
        const queryFrame = await enterConsultasAdmin(page, adminPassword);
        // Valida que el editor SQL quede visible; aqui termina este flujo base reutilizable.
        await expect(queryFrame.locator(consultasAdminSelectors.queryTextarea)).toBeVisible();

        // Captura evidencia del modulo listo para usar.
        await evidence.capture(page, {
          title: 'Consultas admin disponible',
          description: 'Se abre Consultas Admin, se resuelve la clave administrativa y se valida el editor SQL.',
          expected: 'El modulo debe mostrar el campo para escribir consultas SQL.',
          actual: 'El editor SQL quedo visible y disponible.'
        });
      });
    } catch (error) {
      // Guarda el error para documentarlo en el Word antes de reportar el fallo.
      executionError = error;
      // Relanza el error para que Playwright conserve el resultado real de la prueba.
      throw error;
    } finally {
      // Genera el documento Word en output/evidencias y lo adjunta al reporte HTML.
      await evidence.finalize(page, executionError);
    }
  });
});
