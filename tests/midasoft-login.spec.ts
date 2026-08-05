// Importa las herramientas principales de Playwright Test.
import { expect, test } from '@playwright/test';
// Importa la lectura centralizada de credenciales.
import { getMidasoftCredentials } from './support/midasoft-env';
// Importa las partes reutilizables del login.
import { openMidasoftLogin, submitMidasoftLogin } from './support/midasoft-login';

// Agrupa las pruebas que validan solamente el ingreso al sistema.
test.describe('Midasoft login', () => {
  // Omite Firefox y WebKit porque este flujo usa una cuenta real y se estabilizo para Chromium.
  test.skip(({ browserName }) => browserName !== 'chromium', 'Este flujo usa una cuenta real y se valida solo en Chromium.');

  // Valida la primera parte reutilizable: cargar login e iniciar sesion.
  test('usuario puede iniciar sesion en Midasoft', async ({ page }) => {
    // Aumenta el tiempo maximo de esta prueba porque usa una pagina real.
    test.setTimeout(120_000);

    // Obtiene usuario y contrasena desde variables de entorno.
    const credentials = getMidasoftCredentials();

    // Crea un paso BDD para cargar la pantalla de login.
    await test.step('Given el usuario abre la pagina de login', async () => {
      // Abre la pagina de login y valida que el formulario este visible.
      await openMidasoftLogin(page);
    });

    // Crea un paso BDD para ejecutar el ingreso.
    await test.step('When inicia sesion con credenciales validas', async () => {
      // Diligencia credenciales y espera que Midasoft acepte el ingreso.
      await submitMidasoftLogin(page, credentials);
    });

    // Crea un paso BDD para validar el resultado observable.
    await test.step('Then el sistema permite salir del login', async () => {
      // Valida que la URL ya no corresponda a la pantalla de login.
      await expect(page).not.toHaveURL(/\/login\//i);
      // Valida que la sesion siga dentro de la aplicacion Midasoft.
      await expect(page).toHaveURL(/\/NGMidasoft\//i);
    });
  });
});
