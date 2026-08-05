// Importa assertions de Playwright y tipos para trabajar con pagina, iframes, dialogos y locators.
import { expect, type Dialog, type Frame, type Locator, type Page } from '@playwright/test';
// Importa el resumen visible de pantalla para entregar errores faciles de diagnosticar.
import { visiblePageSummary } from './midasoft-login';
// Importa el flujo base de navegacion por Gestion de Seleccion.
import { MidasoftRequisicionPersonalFlow } from './midasoft-requisicion-personal';

// Define un tipo comun para buscar elementos tanto en la pagina principal como dentro de iframes.
type SearchScope = Page | Frame;

// Define una funcion que recibe una pagina o iframe y devuelve un locator candidato.
type LocatorFactory = (scope: SearchScope) => Locator;

// Define los datos que se van a escribir en el formulario de nuevo solicitante.
export type NuevoSolicitanteFormData = {
  // Nombres del solicitante; si no se envia, el helper genera un dato ficticio.
  nombres?: string;
  // Apellidos del solicitante; si no se envia, el helper genera un dato ficticio.
  apellidos?: string;
  // Correo electronico del solicitante; si no se envia, el helper genera un dato ficticio.
  correoElectronico?: string;
  // Identificacion del solicitante; si no se envia, el helper genera un dato ficticio.
  identificacion?: string;
};

// Define los datos finales que quedaron escritos en el formulario.
export type FilledNuevoSolicitanteFormData = Required<NuevoSolicitanteFormData>;

// Define el resultado despues de aceptar la creacion del solicitante.
export type NuevoSolicitanteCreationResult = {
  // Indica si Midasoft confirmo la creacion mediante el mensaje de correo.
  created: boolean;
  // Mensaje visible o nativo que confirma el envio del correo.
  emailMessage: string;
};

// Define el resultado completo del flujo de apertura, diligenciamiento y confirmacion.
export type CreatedNuevoSolicitanteResult = {
  // Datos ficticios o enviados que quedaron escritos en el formulario.
  formData: FilledNuevoSolicitanteFormData;
  // Resultado observado despues de seleccionar Aceptar.
  creation: NuevoSolicitanteCreationResult;
};

// Nombre de la opcion que abre la pantalla de creacion del nuevo solicitante.
export const registroSolicitanteNuevoLabel = /registro\s+de\s+solicitantes?\s+nuevo/i;

// Nombre flexible para encontrar el campo Nombres.
const nombresLabel = /Nombres?/i;

// Nombre flexible para encontrar el campo Apellidos.
const apellidosLabel = /Apellidos?/i;

// Nombre flexible para encontrar el campo Correo electronico.
const correoElectronicoLabel = /Correo\s+electr[oó]nico|E-?mail|Email/i;

// Nombre flexible para encontrar el campo Identificacion.
const identificacionLabel = /Identificaci[oó]n|Documento|Numero\s+de\s+documento|Número\s+de\s+documento/i;

// Nombre flexible para encontrar el boton Aceptar del formulario.
const aceptarLabel = /^\s*Aceptar\s*$/i;

// Mensaje de exito esperado cuando Midasoft crea el solicitante y envia el correo.
const correoEnviadoLabel =
  /(?:¡?\s*e-?mail\s+e?nviado\s+correctamente!?|(?:correo|e-?mail|notificaci[oó]n)[\s\S]{0,120}(?:e?nviad[oa]|fue\s+e?nviad[oa]|correctamente|exitosamente)|(?:se\s+(?:ha\s+)?e?nviad[oa]|se\s+envi[oó])[\s\S]{0,120}(?:correo|e-?mail|notificaci[oó]n)|solicitante[\s\S]{0,120}(?:cread[oa]|registrad[oa]|guardad[oa]))/i;

// Devuelve un sufijo corto para datos ficticios unicos por ejecucion.
function uniqueSuffix(): string {
  // Combina tiempo y aleatorio para reducir colisiones entre ejecuciones cercanas.
  return `${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
}

// Genera datos ficticios para el formulario de nuevo solicitante.
export function generateNuevoSolicitanteData(): FilledNuevoSolicitanteFormData {
  // Usa el sufijo como parte del correo e identificacion para mantener datos unicos.
  const suffix = uniqueSuffix();

  return {
    nombres: 'Carlos Andres',
    apellidos: 'Prueba Automatizada',
    correoElectronico: `solicitante${suffix}@na.com`,
    identificacion: `10${suffix}`
  };
}

// Devuelve candidatos para el boton superior de crear nuevo solicitante.
function newSolicitanteButtonLocators(scope: SearchScope): Locator[] {
  // Combina accesibilidad, textos visibles y clases comunes de icono para soportar cambios pequenos de la UI.
  return [
    scope.getByRole('button', { name: /^\s*(\+|add|agregar|adicionar|crear|nuevo|nueva)\s*$/i }),
    scope.getByRole('link', { name: /^\s*(\+|add|agregar|adicionar|crear|nuevo|nueva)\s*$/i }),
    scope.locator('button, a').filter({ hasText: /^\s*(\+|add|agregar|adicionar|crear|nuevo|nueva)\s*$/i }),
    scope.locator('button[title*="Nuevo" i], button[title*="Agregar" i], button[title*="Crear" i]'),
    scope.locator('button[aria-label*="Nuevo" i], button[aria-label*="Agregar" i], button[aria-label*="Crear" i]'),
    scope.locator('a[title*="Nuevo" i], a[title*="Agregar" i], a[title*="Crear" i]'),
    scope.locator('button:has(i[class*="plus"]), a:has(i[class*="plus"])'),
    scope.locator('button:has(.fa-plus), a:has(.fa-plus)'),
    scope.locator('button, a').filter({ has: scope.locator('mat-icon').filter({ hasText: /^\s*add\s*$/i }) }),
    scope.locator('button, a').filter({ has: scope.locator('.material-icons, .mat-icon').filter({ hasText: /^\s*add\s*$/i }) })
  ];
}

// Busca el primer locator visible en la pagina principal o en cualquiera de sus iframes.
async function findVisibleLocator(page: Page, locatorFactories: LocatorFactory[], errorMessage: string): Promise<Locator> {
  // Guarda el locator encontrado para devolverlo despues de la espera.
  let selectedLocator: Locator | undefined;

  // Reintenta porque las pantallas legacy de Midasoft pueden cargar por partes dentro de iframes.
  await expect
    .poll(
      async () => {
        // Recorre primero la pagina principal y despues todos los iframes activos.
        for (const scope of [page, ...page.frames()]) {
          // Prueba cada estrategia de localizacion recibida.
          for (const factory of locatorFactories) {
            // Construye el locator candidato para este scope.
            const candidate = factory(scope).first();

            // Valida si el candidato esta visible sin romper el poll si todavia no existe.
            if (await candidate.isVisible().catch(() => false)) {
              // Guarda el candidato visible.
              selectedLocator = candidate;
              // Devuelve true para detener la espera.
              return true;
            }
          }
        }

        // Devuelve false para seguir esperando hasta agotar el timeout.
        return false;
      },
      { timeout: 60_000, message: errorMessage }
    )
    .toBe(true);

  // Si Playwright no dejo un locator guardado, falla con contexto de pantalla.
  if (!selectedLocator) {
    // Obtiene un resumen visible para ajustar el selector con informacion real.
    const summary = await visiblePageSummary(page);

    // Lanza un error facil de entender.
    throw new Error(`${errorMessage} Texto visible: ${summary}`);
  }

  // Devuelve el locator visible listo para interactuar.
  return selectedLocator;
}

// Busca el boton superior de nuevo solicitante en la pagina principal y en iframes.
async function findNewSolicitanteButton(page: Page): Promise<Locator> {
  // Guarda el locator encontrado para poder hacer clic despues de confirmar que existe.
  let selectedLocator: Locator | undefined;

  // Reintenta porque el toolbar superior puede cargarse despues del contenedor principal.
  await expect
    .poll(
      async () => {
        // Revisa primero la pagina principal y luego los iframes internos.
        for (const scope of [page, ...page.frames()]) {
          // Prueba los candidatos conocidos para el boton de crear.
          for (const locator of newSolicitanteButtonLocators(scope)) {
            // Toma la primera coincidencia visible.
            const firstMatch = locator.first();

            // Comprueba visibilidad sin romper el poll si el elemento aun no existe.
            if (await firstMatch.isVisible().catch(() => false)) {
              // Guarda el locator listo para usar.
              selectedLocator = firstMatch;
              // Devuelve true para detener la espera.
              return true;
            }
          }
        }

        // Devuelve false para seguir esperando.
        return false;
      },
      { timeout: 60_000, message: 'No se encontro el icono + para crear un nuevo solicitante.' }
    )
    .toBe(true);

  // Si no se encontro el locator, falla con el texto visible para poder ajustar el selector.
  if (!selectedLocator) {
    // Obtiene un resumen de la pantalla actual.
    const summary = await visiblePageSummary(page);

    // Lanza un error claro para diagnosticar la UI real.
    throw new Error(`No se encontro el icono + para crear un nuevo solicitante. Texto visible: ${summary}`);
  }

  // Devuelve el boton encontrado.
  return selectedLocator;
}

// Escribe texto en un campo visible usando el locator recibido.
async function fillVisibleField(locator: Locator, value: string): Promise<void> {
  // Lleva el campo al viewport si la ventana lo permite.
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  // Valida que el campo este visible antes de escribir.
  await expect(locator).toBeVisible();
  // Limpia y escribe el valor solicitado.
  await locator.fill(value);
  // Saca el foco para que Midasoft dispare validaciones de campo cuando aplique.
  await locator.press('Tab').catch(() => {});
}

// Lee el valor visible de un input, textarea, select o componente que use texto renderizado.
async function readVisibleValue(locator: Locator): Promise<string> {
  // Intenta leer el valor como campo de formulario HTML.
  const inputValue = await locator.inputValue().catch(() => '');

  // Si el input tiene valor, lo devuelve limpio.
  if (inputValue.trim()) {
    return inputValue.trim();
  }

  // Lee propiedades o texto visible como respaldo para componentes no nativos.
  const value = await locator
    .evaluate((element) => {
      const htmlElement = element as HTMLElement & { value?: string; innerText?: string };

      return htmlElement.value ?? htmlElement.getAttribute('value') ?? htmlElement.innerText ?? element.textContent ?? '';
    })
    .catch(() => '');

  // Devuelve el texto limpio o cadena vacia si no habia contenido.
  return value.trim();
}

// Busca un campo del formulario usando labels accesibles y respaldos por texto cercano.
async function findFormField(page: Page, label: RegExp, fieldName: string): Promise<Locator> {
  // Busca el campo por nombre accesible, atributos comunes y texto cercano.
  return findVisibleLocator(
    page,
    [
      (scope) => scope.getByLabel(label),
      (scope) => scope.getByRole('textbox', { name: label }),
      (scope) => scope.getByRole('combobox', { name: label }),
      (scope) => scope.locator('input, textarea').filter({ hasText: label }),
      (scope) => scope.locator('input[placeholder], textarea[placeholder]').filter({ hasText: label }),
      (scope) => scope.locator(`xpath=//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚ", "abcdefghijklmnopqrstuvwxyzáéíóú"), "${fieldName.toLowerCase()}")]/following::*[self::input or self::textarea or @role="textbox"][1]`)
    ],
    `No se encontro el campo ${fieldName}.`
  );
}

// Devuelve candidatos rapidos para saber si un campo del formulario sigue visible.
function formFieldLocators(scope: SearchScope, label: RegExp, fieldName: string): Locator[] {
  // Usa estrategias que apuntan a controles, no a textos de columnas o tablas.
  return [
    scope.getByLabel(label),
    scope.getByRole('textbox', { name: label }),
    scope.getByRole('combobox', { name: label }),
    scope.locator(`xpath=//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚ", "abcdefghijklmnopqrstuvwxyzáéíóú"), "${fieldName.toLowerCase()}")]/following::*[self::input or self::textarea or @role="textbox"][1]`)
  ];
}

// Revisa sin esperas largas si un campo especifico del formulario esta visible.
async function isFormFieldVisible(page: Page, label: RegExp, fieldName: string): Promise<boolean> {
  // Revisa pagina principal e iframes porque el formulario puede vivir en cualquiera de ellos.
  for (const scope of [page, ...page.frames()]) {
    // Prueba solo locators de controles para evitar falsos positivos con headers de tabla.
    for (const locator of formFieldLocators(scope, label, fieldName)) {
      // Si algun candidato esta visible, el campo existe en pantalla.
      if (await locator.first().isVisible().catch(() => false)) {
        return true;
      }
    }
  }

  // Devuelve false cuando no hay control visible para ese campo.
  return false;
}

// Busca el boton Aceptar del formulario de nuevo solicitante.
async function findAceptarNuevoSolicitanteButton(page: Page): Promise<Locator> {
  // Busca la accion Aceptar por rol accesible, texto visible y atributos comunes.
  return findVisibleLocator(
    page,
    [
      (scope) => scope.getByRole('button', { name: aceptarLabel }),
      (scope) => scope.getByRole('link', { name: aceptarLabel }),
      (scope) => scope.locator('button:has-text("Aceptar"), a:has-text("Aceptar")'),
      (scope) => scope.locator('input[type="button"][value*="Aceptar" i], input[type="submit"][value*="Aceptar" i]'),
      (scope) => scope.locator('button[title*="Aceptar" i], a[title*="Aceptar" i]'),
      (scope) => scope.locator('button[aria-label*="Aceptar" i], a[aria-label*="Aceptar" i]')
    ],
    'No se encontro la opcion Aceptar para crear el nuevo solicitante.'
  );
}

// Clase reutilizable para continuar desde Gestion de Seleccion hasta Registro de Solicitante Nuevo.
export class MidasoftNuevoSolicitanteFlow {
  // Reutiliza el flujo de navegacion existente para no duplicar busquedas del menu.
  private readonly seleccionFlow: MidasoftRequisicionPersonalFlow;

  // Recibe la pagina de Playwright sobre la que se ejecutara el flujo.
  constructor(private readonly page: Page) {
    // Inicializa el flujo base de Gestion de Seleccion.
    this.seleccionFlow = new MidasoftRequisicionPersonalFlow(page);
  }

  // Abre la opcion Registro de Solicitante Nuevo desde Gestion de Seleccion.
  async openRegistroSolicitanteNuevo(): Promise<void> {
    // Selecciona la opcion solicitada dentro del modulo.
    await this.seleccionFlow.clickVisibleElement(registroSolicitanteNuevoLabel);
    // Espera que la pantalla objetivo quede disponible.
    await this.waitForRegistroSolicitanteNuevoPage();
  }

  // Selecciona el icono + dentro de Registro de Solicitante Nuevo.
  async openNewSolicitanteForm(): Promise<void> {
    // Busca el icono + de la pantalla actual.
    const newButton = await findNewSolicitanteButton(this.page);
    // Hace clic para abrir el formulario de creacion.
    await newButton.click({ timeout: 15_000 });
    // Espera que el formulario muestre sus campos principales.
    await this.waitForNewSolicitanteForm();
  }

  // Diligencia el formulario con datos ficticios o con los datos enviados por el caso.
  async fillNewSolicitanteForm(formData: NuevoSolicitanteFormData = {}): Promise<FilledNuevoSolicitanteFormData> {
    // Genera datos por defecto y permite sobreescribirlos desde el caso.
    const generatedData = generateNuevoSolicitanteData();
    const data: FilledNuevoSolicitanteFormData = {
      nombres: formData.nombres ?? generatedData.nombres,
      apellidos: formData.apellidos ?? generatedData.apellidos,
      correoElectronico: formData.correoElectronico ?? generatedData.correoElectronico,
      identificacion: formData.identificacion ?? generatedData.identificacion
    };

    // Busca y diligencia cada campo solicitado.
    const nombresField = await findFormField(this.page, nombresLabel, 'nombres');
    await fillVisibleField(nombresField, data.nombres);

    const apellidosField = await findFormField(this.page, apellidosLabel, 'apellidos');
    await fillVisibleField(apellidosField, data.apellidos);

    const correoField = await findFormField(this.page, correoElectronicoLabel, 'correo');
    await fillVisibleField(correoField, data.correoElectronico);

    const identificacionField = await findFormField(this.page, identificacionLabel, 'identificacion');
    await fillVisibleField(identificacionField, data.identificacion);

    // Valida que cada valor haya quedado escrito en el control correcto.
    await expect
      .poll(async () => readVisibleValue(nombresField), { timeout: 10_000, message: 'El campo Nombres no conservo el valor escrito.' })
      .toBe(data.nombres);
    await expect
      .poll(async () => readVisibleValue(apellidosField), { timeout: 10_000, message: 'El campo Apellidos no conservo el valor escrito.' })
      .toBe(data.apellidos);
    await expect
      .poll(async () => readVisibleValue(correoField), { timeout: 10_000, message: 'El campo Correo electronico no conservo el valor escrito.' })
      .toBe(data.correoElectronico);
    await expect
      .poll(async () => readVisibleValue(identificacionField), {
        timeout: 10_000,
        message: 'El campo Identificacion no conservo el valor escrito.'
      })
      .toBe(data.identificacion);

    // Devuelve los datos usados para que el caso pueda evidenciarlos o validarlos.
    return data;
  }

  // Abre el formulario con el icono + y lo diligencia con datos ficticios.
  async openAndFillNewSolicitanteForm(formData: NuevoSolicitanteFormData = {}): Promise<FilledNuevoSolicitanteFormData> {
    // Abre el formulario de nuevo solicitante.
    await this.openNewSolicitanteForm();
    // Diligencia los campos principales del formulario.
    return this.fillNewSolicitanteForm(formData);
  }

  // Selecciona Aceptar y valida que Midasoft confirme el envio del correo.
  async acceptNewSolicitanteForm(): Promise<NuevoSolicitanteCreationResult> {
    // Guarda mensajes de alertas nativas del navegador antes de aceptarlas.
    const dialogMessages: string[] = [];
    // Captura alertas nativas para que el clic no quede bloqueado por el dialogo.
    const dialogHandler = async (dialog: Dialog) => {
      // Guarda el mensaje mostrado por Midasoft.
      dialogMessages.push(dialog.message());
      // Acepta el dialogo para permitir que el flujo continue.
      await dialog.accept().catch(() => {});
    };

    // Registra el listener antes del clic que puede disparar la alerta.
    this.page.on('dialog', dialogHandler);

    try {
      // Busca el boton Aceptar del formulario.
      const acceptButton = await findAceptarNuevoSolicitanteButton(this.page);
      // Lleva el boton al viewport si aplica.
      await acceptButton.scrollIntoViewIfNeeded().catch(() => {});
      // Valida que la accion este disponible antes de hacer clic.
      await expect(acceptButton).toBeEnabled();
      // Prepara la espera antes del clic porque el toast de confirmacion aparece y desaparece muy rapido.
      const emailMessagePromise = this.waitForCorreoEnviadoMessage(dialogMessages);
      // Selecciona Aceptar para crear el solicitante.
      await acceptButton.click({ timeout: 15_000 });

      // Espera la alerta nativa o visual que confirma el envio del correo.
      const emailMessage = await emailMessagePromise;
      // Valida que despues de aceptar se vuelva al listado de solicitantes.
      await this.waitForSolicitantesListVisible();

      return {
        created: true,
        emailMessage
      };
    } finally {
      // Retira el listener para no capturar dialogos de pasos posteriores.
      this.page.off('dialog', dialogHandler);
    }
  }

  // Abre, diligencia y acepta el formulario de nuevo solicitante.
  async createNuevoSolicitante(formData: NuevoSolicitanteFormData = {}): Promise<CreatedNuevoSolicitanteResult> {
    // Abre el formulario y escribe los datos principales.
    const filledFormData = await this.openAndFillNewSolicitanteForm(formData);
    // Selecciona Aceptar y valida el mensaje de correo enviado.
    const creation = await this.acceptNewSolicitanteForm();

    return {
      formData: filledFormData,
      creation
    };
  }

  // Ejecuta la navegacion cuando Gestion de Seleccion ya esta abierta por otro flujo.
  async openRegistroSolicitanteNuevoFromGestionSeleccionOpen(): Promise<void> {
    // Confirma que el flujo anterior dejo visible Gestion de Seleccion.
    await this.expectGestionSeleccionOpen();
    // Abre la pantalla objetivo.
    await this.openRegistroSolicitanteNuevo();
  }

  // Valida que el helper se este ejecutando desde Gestion de Seleccion ya abierta.
  async expectGestionSeleccionOpen(): Promise<void> {
    // Usa el encabezado visible como contrato de entrada del helper.
    await expect(this.page.getByRole('heading', { name: /gesti[oó]n\s+de\s+selecci[oó]n/i })).toBeVisible({
      timeout: 30_000
    });
  }

  // Espera que el formulario de nuevo solicitante muestre los campos principales.
  async waitForNewSolicitanteForm(): Promise<void> {
    // Reintenta porque el formulario puede abrirse dentro de un iframe o modal legacy.
    await expect
      .poll(
        async () => {
          // Revisa la pagina principal y los iframes activos.
          for (const scope of [this.page, ...this.page.frames()]) {
            // Lee el texto visible del scope actual.
            const text = await scope.locator('body').innerText({ timeout: 1_000 }).catch(() => '');

            // Confirma que los campos esperados esten presentes en la pantalla.
            if (
              nombresLabel.test(text) &&
              apellidosLabel.test(text) &&
              correoElectronicoLabel.test(text) &&
              identificacionLabel.test(text)
            ) {
              return true;
            }
          }

          // Devuelve false para seguir esperando.
          return false;
        },
        { timeout: 60_000, message: 'No se mostro el formulario de nuevo solicitante.' }
      )
      .toBe(true);
  }

  // Espera que el listado de solicitantes quede visible despues de cerrar el formulario.
  async waitForSolicitantesListVisible(): Promise<void> {
    // Reintenta hasta que la pantalla principal muestre la grilla/listado de solicitantes.
    await expect
      .poll(
        async () => {
          // Revisa la pagina principal y los iframes activos.
          for (const scope of [this.page, ...this.page.frames()]) {
            // Lee el texto visible del scope actual.
            const text = await scope.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
            // Busca una tabla o grilla visible propia del listado.
            const gridVisible = await scope
              .locator('table:visible, [role="table"]:visible, [role="grid"]:visible')
              .first()
              .isVisible()
              .catch(() => false);
            // Busca el buscador de la grilla como segunda senal de que se regreso al listado.
            const searchVisible = await scope.getByRole('textbox', { name: /buscar/i }).first().isVisible().catch(() => false);

            // Considera lista la pantalla cuando muestra Solicitantes y al menos una senal de grilla.
            if (/Solicitantes/i.test(text) && (gridVisible || searchVisible)) {
              return true;
            }
          }

          // Devuelve false para seguir esperando.
          return false;
        },
        { timeout: 60_000, message: 'No se mostro el listado de solicitantes despues de seleccionar Aceptar.' }
      )
      .toBe(true);
  }

  // Espera que el formulario de nuevo solicitante desaparezca despues de aceptar.
  async waitForNewSolicitanteFormHidden(): Promise<void> {
    // Reintenta hasta que los controles principales ya no esten visibles como formulario.
    await expect
      .poll(
        async () => {
          // Pregunta por controles reales, no por texto visible, para no confundir columnas de la grilla.
          const fieldsVisible = await Promise.all([
            isFormFieldVisible(this.page, nombresLabel, 'nombres'),
            isFormFieldVisible(this.page, apellidosLabel, 'apellidos'),
            isFormFieldVisible(this.page, correoElectronicoLabel, 'correo'),
            isFormFieldVisible(this.page, identificacionLabel, 'identificacion')
          ]);

          // Si ninguno de los controles principales sigue visible, el formulario ya desaparecio.
          return fieldsVisible.every((visible) => !visible);
        },
        { timeout: 60_000, message: 'El formulario de nuevo solicitante no desaparecio despues de seleccionar Aceptar.' }
      )
      .toBe(true);
  }

  // Espera la alerta nativa o visual que confirma que se envio un correo.
  async waitForCorreoEnviadoMessage(dialogMessages: string[] = []): Promise<string> {
    // Guarda el mensaje encontrado durante la espera.
    let selectedMessage = '';
    // Guarda el ultimo texto visible para entregar contexto si la alerta no coincide.
    let lastVisibleText = '';

    // Reintenta porque la alerta puede aparecer como dialogo nativo o como mensaje visual dentro de la pagina.
    await expect
      .poll(
        async () => {
          // Revisa primero los dialogos nativos capturados.
          for (const message of dialogMessages) {
            // Si el mensaje coincide con correo enviado, lo guarda.
            const dialogMatch = message.match(correoEnviadoLabel);

            if (dialogMatch) {
              selectedMessage = dialogMatch[0].replace(/\s+/g, ' ').trim();
              return true;
            }
          }

          // Las alertas inferiores de Angular Material suelen renderizarse como snackbar/toast.
          const toast = this.page
            .locator(
              '.mat-mdc-snack-bar-container, .mat-snack-bar-container, simple-snack-bar, [role="status"], [role="alert"]'
            )
            .filter({ hasText: correoEnviadoLabel })
            .first();

          if (await toast.isVisible().catch(() => false)) {
            selectedMessage = (await toast.textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() || 'Email enviado correctamente';
            return true;
          }

          // Revisa la pagina principal y los iframes activos.
          for (const scope of [this.page, ...this.page.frames()]) {
            // Lee el texto visible del scope actual.
            const text = await scope.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
            // Guarda una version corta del texto para diagnosticar mensajes reales de Midasoft.
            if (text.trim()) {
              lastVisibleText = text.replace(/\s+/g, ' ').trim().slice(0, 700);
            }

            // Si la pagina muestra el mensaje de correo enviado, lo guarda limpio.
            const textMatch = text.match(correoEnviadoLabel);

            if (textMatch) {
              selectedMessage = textMatch[0].replace(/\s+/g, ' ').trim();
              return true;
            }
          }

          // Devuelve false para seguir esperando.
          return false;
        },
        {
          intervals: [50, 100, 100, 250, 500],
          timeout: 60_000,
          message: 'No se encontro la alerta que confirma el envio del correo al solicitante.'
        }
      )
      .toBe(true)
      .catch((error) => {
        throw new Error(`${error instanceof Error ? error.message : String(error)} ${this.correoEnviadoDiagnostic(dialogMessages, lastVisibleText)}`);
      });

    // Devuelve el mensaje capturado para que el caso pueda documentarlo.
    return selectedMessage;
  }

  // Construye un resumen de los mensajes vistos cuando no se reconoce la confirmacion.
  private correoEnviadoDiagnostic(dialogMessages: string[], lastVisibleText: string): string {
    // Une mensajes nativos y texto visible para que el ajuste del selector sea directo.
    return [`Dialogos: ${dialogMessages.join(' | ') || 'ninguno'}`, `Texto visible: ${lastVisibleText || 'sin texto disponible'}`].join(
      '. '
    );
  }

  // Espera a que la pantalla Registro de Solicitante Nuevo quede visible despues de seleccionarla.
  async waitForRegistroSolicitanteNuevoPage(): Promise<void> {
    // Reintenta porque Midasoft puede cargar la pantalla objetivo dentro de iframes.
    await expect
      .poll(
        async () => {
          // Revisa la pagina principal y los iframes activos.
          for (const scope of [this.page, ...this.page.frames()]) {
            // Lee el texto visible del scope actual sin romper la espera si todavia esta cargando.
            const text = await scope.locator('body').innerText({ timeout: 1_000 }).catch(() => '');

            // La pantalla se considera lista cuando muestra el nombre de la opcion seleccionada.
            if (registroSolicitanteNuevoLabel.test(text)) {
              return true;
            }
          }

          // Devuelve false para seguir esperando.
          return false;
        },
        { timeout: 60_000, message: 'No se mostro la pantalla Registro de Solicitante Nuevo.' }
      )
      .toBe(true);
  }
}

// Funcion corta para los casos que solo necesitan continuar desde Gestion de Seleccion ya abierta.
export async function openRegistroSolicitanteNuevoFromGestionSeleccionOpen(page: Page): Promise<MidasoftNuevoSolicitanteFlow> {
  // Crea la clase de navegacion para este page.
  const flow = new MidasoftNuevoSolicitanteFlow(page);
  // Ejecuta la navegacion desde Gestion de Seleccion ya abierta.
  await flow.openRegistroSolicitanteNuevoFromGestionSeleccionOpen();
  // Devuelve la instancia por si el test necesita seguir interactuando con la pantalla.
  return flow;
}
