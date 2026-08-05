// Importa assertions de Playwright y los tipos Locator/Page para trabajar con la pagina del navegador.
import { expect, type Locator, type Page } from '@playwright/test';
// Importa la configuracion y el tipo de credenciales del proyecto Midasoft.
import { midasoftConfig, type MidasoftCredentials } from './midasoft-env';

// Declara una funcion que resume el texto visible de la pagina para ayudar a diagnosticar errores.
export async function visiblePageSummary(page: Page): Promise<string> {
  // Lee el texto completo del body; si no se puede leer rapido, devuelve un mensaje corto.
  const text = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => 'No se pudo leer el texto visible.');

  // Reemplaza saltos y espacios repetidos por un solo espacio para que el error sea facil de leer.
  return text.replace(/\s+/g, ' ').trim().slice(0, 500);
}

// Devuelve el campo de usuario usando varios selectores posibles del login.
function usernameInput(page: Page): Locator {
  // Combina selectores accesibles y selectores HTML para soportar cambios pequenos de la pantalla.
  return page
    .getByLabel(/usuario/i)
    .or(page.getByPlaceholder(/usuario/i))
    .or(page.locator('input[name*="user" i], input[id*="user" i], input[type="text"], input:not([type])'))
    .first();
}

// Devuelve el campo de contrasena usando varios selectores posibles del login.
function passwordInput(page: Page): Locator {
  // Prioriza label/placeholder y cae al input password cuando la app no publica labels accesibles.
  return page
    .getByLabel(/contrase[ñn]a/i)
    .or(page.getByPlaceholder(/contrase[ñn]a/i))
    .or(page.locator('input[type="password"], input[name*="pass" i], input[id*="pass" i]'))
    .first();
}

// Declara los estados posibles despues de presionar el boton de login.
type LoginAttemptState = 'logged-in' | 'loading' | 'login-form';

// Indica si la pagina ya salio de la ruta de login y esta dentro de Midasoft.
async function isLoggedInPage(page: Page): Promise<boolean> {
  // Cuando Midasoft acepta o conserva la sesion, la URL deja de apuntar a /login/.
  return !page.url().includes('/login/');
}

// Indica si el formulario de login esta realmente listo para escribir credenciales.
async function isLoginFormReady(page: Page): Promise<boolean> {
  // Ambos campos deben estar visibles; asi evitamos escribir mientras la pantalla aun repinta.
  const usernameVisible = await usernameInput(page).isVisible().catch(() => false);
  const passwordVisible = await passwordInput(page).isVisible().catch(() => false);

  return usernameVisible && passwordVisible;
}

// Declara una funcion que identifica en que estado quedo el login.
async function loginAttemptState(page: Page): Promise<LoginAttemptState> {
  // Si la URL ya no contiene `/login/`, asumimos que la sesion avanzo.
  if (await isLoggedInPage(page)) {
    // Devuelve el estado exitoso.
    return 'logged-in';
  }

  // Revisa si la pagina todavia muestra un progressbar/spinner de carga.
  const isLoading = await page.getByRole('progressbar').isVisible().catch(() => false);

  // Si el progressbar esta visible, la aplicacion todavia esta procesando el intento de login.
  if (isLoading) {
    // Devuelve estado de carga para que Playwright siga esperando.
    return 'loading';
  }

  // Revisa si el campo Usuario volvio a quedar visible en la pantalla de login.
  const loginFormVisible = await isLoginFormReady(page);

  // Si el formulario esta visible y no hay carga, el login no avanzo.
  if (loginFormVisible) {
    // Devuelve estado de formulario para crear un error claro.
    return 'login-form';
  }

  // Si no hay cambio de URL, no hay formulario y no hay carga visible, damos unos reintentos mas.
  return 'loading';
}

// Declara una funcion que espera a que el intento de login termine en exito o fallo claro.
export async function waitForLoginResult(page: Page): Promise<void> {
  // Espera hasta 90 segundos porque la pagina real puede tardar o quedarse mostrando un progressbar.
  await expect
    // Usa poll para consultar repetidamente el estado del login.
    .poll(
      // En cada intento, lee el estado actual de la pagina.
      async () => loginAttemptState(page),
      // Define tiempo maximo y mensaje de ayuda si nunca sale del estado de carga.
      { timeout: 90_000, message: 'El login no termino de procesar; la pagina siguio cargando.' }
    )
    // La espera termina cuando el estado deja de ser `loading`.
    .not.toBe('loading');

  // Lee el estado final despues de la espera.
  const state = await loginAttemptState(page);

  // Si el formulario de login sigue visible, el usuario o la contrasena probablemente no fueron aceptados.
  if (state === 'login-form') {
    // Resume el texto visible para que el error ayude a depurar credenciales o mensajes de validacion.
    const summary = await visiblePageSummary(page);

    // Si Midasoft muestra su mensaje de credenciales invalidas, falla con una causa especifica.
    if (/usuario\s+y\/o\s+contrase[ñn]a\s+incorrecta/i.test(summary)) {
      // Lanza un error claro para diferenciar credenciales rechazadas de problemas de automatizacion.
      throw new Error('Midasoft rechazo el usuario o la contrasena. Revisa MIDASOFT_USERNAME y MIDASOFT_PASSWORD.');
    }

    // Lanza un error claro con URL y texto visible.
    throw new Error(`El login no avanzo. URL actual: ${page.url()}. Texto visible: ${summary}`);
  }
}

// Abre la pagina de login y valida que el formulario principal este disponible.
export async function openMidasoftLogin(page: Page, loginUrl = midasoftConfig.loginUrl): Promise<void> {
  // Navega a la pagina de login y espera a que la pagina termine su carga inicial.
  await page.goto(loginUrl, { waitUntil: 'load' });

  // Valida que el titulo de la pagina contenga la palabra Midasoft.
  await expect(page).toHaveTitle(/Midasoft/i);
  // Espera hasta que el formulario este listo o hasta que Midasoft conserve una sesion ya autenticada.
  const initialState = await expect
    .poll(
      async () => {
        if (await isLoggedInPage(page)) {
          return 'logged-in';
        }

        if (await isLoginFormReady(page)) {
          return 'login-form';
        }

        return 'loading';
      },
      { timeout: 60_000, message: 'No se encontro el formulario de login ni una sesion activa de Midasoft.' }
    )
    .not.toBe('loading')
    .then(() => loginAttemptState(page))
    .catch(async (error) => {
      const summary = await visiblePageSummary(page);

      throw new Error(`${error instanceof Error ? error.message : String(error)} URL actual: ${page.url()}. Texto visible: ${summary}`);
    });

  // Si la sesion ya estaba abierta, no hay campos que validar ni credenciales que escribir.
  if (initialState === 'logged-in') {
    return;
  }

  // Valida que el formulario este escribible antes de devolver el control al caso.
  await expect(usernameInput(page)).toBeVisible({ timeout: 5_000 });
  await expect(passwordInput(page)).toBeVisible({ timeout: 5_000 });
}

// Diligencia el formulario de login y espera el resultado del ingreso.
export async function submitMidasoftLogin(page: Page, credentials: MidasoftCredentials): Promise<void> {
  // Si openMidasoftLogin detecto una sesion existente, no vuelve a intentar autenticar.
  if (await isLoggedInPage(page)) {
    return;
  }

  // Escribe el usuario en el campo encontrado por el helper reutilizable.
  await usernameInput(page).fill(credentials.username);
  // Escribe la contrasena en el campo encontrado por el helper reutilizable.
  await passwordInput(page).fill(credentials.password);
  // Valida que el boton de ingreso se habilite despues de llenar usuario y contrasena.
  await expect(page.getByRole('button', { name: /ingresar/i })).toBeEnabled();
  // Hace clic en el boton cuyo texto accesible contiene "ingresar".
  await page.getByRole('button', { name: /ingresar/i }).click();
  // Espera a que el intento de login termine sin depender solamente de un cambio de URL.
  await waitForLoginResult(page);
}

// Ejecuta el flujo completo de login reutilizando los dos pasos anteriores.
export async function loginToMidasoft(page: Page, credentials: MidasoftCredentials): Promise<void> {
  // Abre y valida la pantalla inicial de login.
  await openMidasoftLogin(page);
  // Envia credenciales y espera que el login sea aceptado.
  await submitMidasoftLogin(page, credentials);
}
