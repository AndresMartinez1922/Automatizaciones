// Importa las herramientas principales de Playwright Test.
import { expect, test } from '@playwright/test';
// Importa credenciales y clave admin desde variables de entorno.
import { getMidasoftAdminPassword, getMidasoftCredentials } from './support/midasoft-env';
// Importa la parte reutilizable que completa el login.
import { loginToMidasoft } from './support/midasoft-login';
// Importa la parte reutilizable que abre consultas admin y sus selectores centralizados.
import { consultasAdminSelectors, enterConsultasAdmin } from './support/midasoft-consultas-admin';

// Agrupa las pruebas de acceso al modulo de consultas admin.
test.describe('Midasoft consultas admin acceso', () => {
  // Omite Firefox y WebKit porque este flujo usa una cuenta real y se estabilizo para Chromium.
  test.skip(({ browserName }) => browserName !== 'chromium', 'Este flujo usa una cuenta real y se valida solo en Chromium.');

  // Valida la segunda parte reutilizable: entrar a consultas admin despues del login.
  test('usuario autenticado puede ingresar a consultas admin', async ({ page }) => {
    // Aumenta el tiempo maximo de esta prueba porque usa una pagina real.
    test.setTimeout(150_000);

    // Obtiene usuario y contrasena desde variables de entorno.
    const credentials = getMidasoftCredentials();
    // Obtiene la clave administrativa desde variables de entorno.
    const adminPassword = getMidasoftAdminPassword();

    // Crea un paso BDD para dejar una sesion valida.
    await test.step('Given el usuario ya inicio sesion', async () => {
      // Reutiliza el flujo completo de login sin duplicar pasos.
      await loginToMidasoft(page, credentials);
    });

    // Crea un paso BDD para entrar al modulo administrativo.
    await test.step('When abre consultas admin y digita la clave administrativa', async () => {
      // Abre consultas admin, ingresa la clave y retorna el iframe del editor SQL.
      const queryFrame = await enterConsultasAdmin(page, adminPassword);
      // Valida que el editor SQL haya quedado visible para continuar con pruebas futuras.
      await expect(queryFrame.locator(consultasAdminSelectors.queryTextarea)).toBeVisible();
    });
  });
});
