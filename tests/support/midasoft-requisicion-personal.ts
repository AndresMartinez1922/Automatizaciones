// Importa assertions de Playwright y tipos para trabajar con pagina, iframes y locators.
import { expect, type Frame, type Locator, type Page } from '@playwright/test';
// Importa la lectura centralizada de credenciales.
import { getMidasoftCredentials, type MidasoftCredentials } from './midasoft-env';
// Importa las partes reutilizables del login.
import { openMidasoftLogin, submitMidasoftLogin, visiblePageSummary } from './midasoft-login';

// Define un tipo comun para buscar elementos tanto en la pagina principal como dentro de iframes.
type SearchScope = Page | Frame;

// Agrupa los textos visibles que usa el menu para llegar a Requisicion de Personal.
export const requisicionPersonalLabels = {
  // Nombre del modulo principal en el menu lateral.
  gestionSeleccion: /gesti[oó]n\s+de\s+selecci[oó]n/i,
  // Nombre de la seccion dentro de Gestion de Seleccion.
  transacciones: /transacciones/i,
  // Nombre de la opcion final que abre la pantalla objetivo.
  requisicionPersonal: /requisi[cç]i[oó]n\s+de\s+personal|requision\s+de\s+personal|requision\s+personal/i
};

// Devuelve candidatos de locator para un texto visible, priorizando controles interactivos.
function locatorsByText(scope: SearchScope, label: RegExp): Locator[] {
  // Playwright reintenta automaticamente estos locators cuando se usan con assertions o acciones.
  return [
    scope.getByRole('button', { name: label }),
    scope.getByRole('link', { name: label }),
    scope.getByRole('menuitem', { name: label }),
    scope.getByText(label)
  ];
}

// Clase reutilizable para navegar desde el login hasta Requisicion de Personal.
export class MidasoftRequisicionPersonalFlow {
  // Recibe la pagina de Playwright sobre la que se ejecutara el flujo.
  constructor(private readonly page: Page) {}

  // Busca un elemento visible en la pagina principal y en todos los iframes disponibles.
  async findVisibleElement(label: RegExp): Promise<Locator> {
    // Guarda aqui el locator encontrado para usarlo despues de que expect.poll confirme su existencia.
    let selectedLocator: Locator | undefined;

    // Usa poll para esperar a que el menu exista, aunque la pagina real cargue lento.
    await expect
      .poll(
        async () => {
          // Revisa primero la pagina principal y luego cada iframe.
          for (const scope of [this.page, ...this.page.frames()]) {
            // Prueba varias formas accesibles de encontrar el mismo texto.
            for (const locator of locatorsByText(scope, label)) {
              // Toma el primer match para evitar errores cuando existen varias coincidencias.
              const firstMatch = locator.first();
              // Comprueba si el elemento esta visible sin romper la espera si todavia no existe.
              if (await firstMatch.isVisible().catch(() => false)) {
                // Guarda el locator exacto que Playwright podra clicar.
                selectedLocator = firstMatch;
                // Devuelve true para detener el poll.
                return true;
              }
            }
          }

          // Devuelve false para que Playwright siga esperando.
          return false;
        },
        // Da hasta un minuto porque el menu de Midasoft puede tardar en pintar despues del login.
        { timeout: 60_000 }
      )
      // La busqueda debe terminar encontrando el elemento.
      .toBe(true);

    // Si por alguna razon no quedo guardado el locator, falla con un mensaje claro.
    if (!selectedLocator) {
      // Resume el texto visible para que podamos ajustar el selector con base en lo que mostro la pantalla.
      const summary = await visiblePageSummary(this.page);

      // Lanza el error con contexto util para diagnosticar.
      throw new Error(`No se encontro el elemento ${label}. Texto visible: ${summary}`);
    }

    // Devuelve el locator visible encontrado.
    return selectedLocator;
  }

  // Hace clic en un elemento visible identificado por su texto.
  async clickVisibleElement(label: RegExp): Promise<void> {
    // Reintenta el clic porque los menus de Midasoft pueden repintarse mientras Playwright interactua.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        // Busca el elemento en pagina o iframes.
        const locator = await this.findVisibleElement(label);
        // Hace clic en el elemento encontrado.
        await locator.click({ timeout: 15_000 });
        // Sale de la funcion cuando el clic fue exitoso.
        return;
      } catch (error) {
        // En el ultimo intento relanza el error para que Playwright muestre la causa real.
        if (attempt === 3) {
          throw error;
        }

        // Da un respiro corto a Angular para terminar de repintar el menu antes de reintentar.
        await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);
      }
    }
  }

  // Ejecuta el login reutilizando el soporte existente.
  async login(credentials: MidasoftCredentials = getMidasoftCredentials()): Promise<void> {
    // Abre y valida la pantalla inicial de login.
    await openMidasoftLogin(this.page);
    // Diligencia credenciales y espera que Midasoft permita entrar.
    await submitMidasoftLogin(this.page, credentials);
  }

  // Expande el menu lateral para que los modulos muestren texto y sean mas faciles de ubicar.
  async expandSideMenu(): Promise<void> {
    // Localiza el primer boton del menu lateral, que en Midasoft corresponde al icono de hamburguesa.
    const menuButton = this.page.locator('nav button').first();
    // Valida que el boton exista antes de interactuar.
    await expect(menuButton).toBeVisible({ timeout: 15_000 });
    // Abre el menu lateral.
    await menuButton.click();
  }

  // Cierra el menu lateral cuando queda expandido sobre el contenido principal.
  async closeSideMenu(): Promise<void> {
    // El backdrop abierto intercepta los clics hacia las opciones del contenido principal.
    const backdrop = this.page.locator('.mat-drawer-backdrop.mat-drawer-shown');

    if (!(await backdrop.isVisible().catch(() => false))) {
      return;
    }

    // En Midasoft el primer boton del nav cambia a la flecha de cierre cuando el menu esta abierto.
    const closeButton = this.page.locator('nav button').first();

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await expect(closeButton).toBeVisible({ timeout: 15_000 });
      await closeButton.click({ timeout: 15_000 }).catch(() => {});

      if (await backdrop.waitFor({ state: 'hidden', timeout: 5_000 }).then(() => true).catch(() => false)) {
        return;
      }
    }

    // Escape cubre estados en los que Angular conserva el sidenav abierto despues de navegar.
    await this.page.keyboard.press('Escape').catch(() => {});
    await expect(backdrop).toBeHidden({ timeout: 10_000 });
  }

  // Abre el modulo Gestion de Seleccion desde el menu lateral.
  async openGestionSeleccion(): Promise<void> {
    // Despliega el menu para que el texto del modulo sea visible.
    await this.expandSideMenu();
    // Busca y selecciona el acceso Gestion de Seleccion dentro del menu lateral.
    const gestionSeleccionModule = this.page.locator('nav').getByText(requisicionPersonalLabels.gestionSeleccion).first();

    await expect(gestionSeleccionModule).toBeVisible({ timeout: 60_000 });
    await gestionSeleccionModule.click({ timeout: 15_000 });
    // Valida que el titulo del modulo quede visible.
    await expect(this.page.getByRole('heading', { name: requisicionPersonalLabels.gestionSeleccion })).toBeVisible({
      timeout: 60_000
    });
    // Cierra el menu lateral para que no intercepte los clics sobre las opciones internas.
    await this.closeSideMenu();
  }

  // Valida que la seccion Transacciones este visible dentro de Gestion de Seleccion.
  async expectTransaccionesVisible(): Promise<void> {
    // Busca el encabezado/seccion Transacciones en la bandeja general.
    await this.findVisibleElement(requisicionPersonalLabels.transacciones);
  }

  // Abre Requisicion de Personal desde la seccion Transacciones.
  async openRequisicionPersonal(): Promise<void> {
    // Asegura que el menu lateral no cubra la opcion del contenido principal.
    await this.closeSideMenu();
    // Selecciona la opcion final del flujo.
    await this.clickVisibleElement(requisicionPersonalLabels.requisicionPersonal);
    // Espera que la pantalla final termine de cargar.
    await this.waitForRequisicionPersonalPage();
  }

  // Ejecuta el flujo completo desde login hasta Requisicion de Personal.
  async loginAndOpenRequisicionPersonal(credentials: MidasoftCredentials = getMidasoftCredentials()): Promise<void> {
    // Ingresa a Midasoft.
    await this.login(credentials);
    // Entra al modulo Gestion de Seleccion.
    await this.openGestionSeleccion();
    // Confirma que existe la seccion Transacciones.
    await this.expectTransaccionesVisible();
    // Abre la pantalla objetivo.
    await this.openRequisicionPersonal();
  }

  // Ejecuta solo la navegacion de menu cuando la sesion ya esta iniciada.
  async openRequisicionPersonalFromCurrentSession(): Promise<void> {
    // Entra al modulo Gestion de Seleccion.
    await this.openGestionSeleccion();
    // Confirma que existe la seccion Transacciones.
    await this.expectTransaccionesVisible();
    // Abre la pantalla objetivo.
    await this.openRequisicionPersonal();
  }

  // Espera a que la pantalla final cargue su contenedor principal despues de seleccionar una opcion.
  async waitForRequisicionPersonalPage(): Promise<void> {
    // Valida que el titulo visible de la pantalla objetivo aparezca.
    await expect(this.page.getByRole('heading', { name: requisicionPersonalLabels.requisicionPersonal })).toBeVisible({
      timeout: 60_000
    });
    // Espera el iframe principal donde Midasoft suele pintar los formularios internos.
    await expect(this.page.locator('main iframe').first()).toBeVisible({ timeout: 60_000 });
    // Espera a que algun iframe interno tenga texto propio del formulario y no solo el contenedor en blanco.
    await expect
      .poll(
        async () => {
          // Recorre solo iframes, excluyendo el frame principal de la pagina.
          for (const frame of this.page.frames().filter((frameItem) => frameItem !== this.page.mainFrame())) {
            // Lee el texto del iframe; si todavia esta cargando, permite reintentar.
            const text = await frame.locator('body').innerText({ timeout: 1_000 }).catch(() => '');

            // Revisa palabras esperadas en una pantalla de requisicion de personal.
            if (/requisi[cç]i[oó]n|cargo|solicitante|centro\s+de\s+costo|fecha/i.test(text)) {
              return true;
            }
          }

          // Si ningun iframe tiene contenido util, sigue esperando.
          return false;
        },
        { timeout: 90_000 }
      )
      .toBe(true);
  }

}

// Funcion corta para los casos que solo necesitan llegar a Requisicion de Personal.
export async function loginAndOpenRequisicionPersonal(
  page: Page,
  credentials: MidasoftCredentials = getMidasoftCredentials()
): Promise<MidasoftRequisicionPersonalFlow> {
  // Crea la clase de navegacion para este page.
  const flow = new MidasoftRequisicionPersonalFlow(page);
  // Ejecuta el flujo completo.
  await flow.loginAndOpenRequisicionPersonal(credentials);
  // Devuelve la instancia por si el test necesita seguir interactuando con la pantalla.
  return flow;
}
