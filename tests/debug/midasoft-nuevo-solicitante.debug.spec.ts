// Importa las herramientas principales de Playwright Test.
import { expect, test } from '@playwright/test';
// Importa credenciales desde variables de entorno.
import { getMidasoftCredentials } from '../support/midasoft-env';
// Importa las piezas reutilizables del login para que el helper no dependa del ingreso.
import { openMidasoftLogin, submitMidasoftLogin } from '../support/midasoft-login';
// Importa el flujo anterior que deja abierta Gestion de Seleccion.
import { MidasoftRequisicionPersonalFlow } from '../support/midasoft-requisicion-personal';
// Importa el helper base de Nuevo Solicitante.
import { MidasoftNuevoSolicitanteFlow } from '../support/midasoft-nuevo-solicitante';

// Runner de depuracion para ejecutar el helper desde VS Code sin convertirlo en caso oficial.
test.describe('Debug Midasoft nuevo solicitante', () => {
  // Omite Firefox y WebKit porque este flujo usa una cuenta real y se valida solo en Chromium.
  test.skip(({ browserName }) => browserName !== 'chromium', 'Este flujo usa una cuenta real y se valida solo en Chromium.');

  // Ejecuta el helper completo para revisar el flujo paso a paso desde VS Code.
  test('ejecuta helper de registro de solicitante nuevo', async ({ page }) => {
    // Aumenta el tiempo maximo porque el flujo usa login y navegacion real en Midasoft.
    test.setTimeout(300_000);

    // Crea el flujo reutilizable sobre la pagina actual.
    const flow = new MidasoftNuevoSolicitanteFlow(page);

    // Ingresa a Midasoft fuera del helper base.
    await openMidasoftLogin(page);
    await submitMidasoftLogin(page, getMidasoftCredentials());

    // Usa el flujo anterior para dejar abierta Gestion de Seleccion.
    await new MidasoftRequisicionPersonalFlow(page).openGestionSeleccion();

    // Abre Registro de Solicitante Nuevo desde Gestion de Seleccion ya abierta.
    await flow.openRegistroSolicitanteNuevoFromGestionSeleccionOpen();

    // Abre el formulario, genera datos ficticios, los diligencia y selecciona Aceptar.
    const result = await flow.createNuevoSolicitante();

    // Valida que el sistema confirme la creacion con el envio del correo.
    expect(result.creation.created).toBe(true);
    expect(result.creation.emailMessage).toMatch(/correo|email/i);
  });
});
