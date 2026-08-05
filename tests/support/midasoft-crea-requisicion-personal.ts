// Importa assertions de Playwright y tipos para trabajar con pagina, iframes y locators.
import { expect, type Dialog, type Frame, type Locator, type Page } from '@playwright/test';
// Importa un resumen visible de pantalla para entregar errores faciles de diagnosticar.
import { visiblePageSummary } from './midasoft-login';

// Define un tipo comun para buscar elementos tanto en la pagina principal como dentro de iframes.
type SearchScope = Page | Frame;

// Define una funcion que recibe una pagina o iframe y devuelve un locator candidato.
type LocatorFactory = (scope: SearchScope) => Locator;

// Define los datos que se van a escribir en el formulario de nueva requisicion.
export type NewRequisicionFormData = {
  // Numero de contrato de trabajo; si no se envia, el helper genera uno aleatorio.
  contratoTrabajo?: string;
  // Cargo que requiere la requisicion.
  cargoQueRequiere: string;
  // Motivo de la requisicion; por defecto se usa Ascenso.
  motivo?: string;
  // Codigo de la persona que se va a seleccionar en el campo Reemplazar a.
  reemplazarACodigo?: string;
  // Numero de vacantes que se va a solicitar.
  nroVacantes?: string;
  // Estado inicial de la requisicion; por defecto se usa Abierta.
  estado?: string;
};

// Define los datos finales que quedaron escritos en el formulario.
export type FilledNewRequisicionFormData = {
  // Numero de contrato usado por el test.
  contratoTrabajo: string;
  // Cargo escrito en el formulario.
  cargoQueRequiere: string;
  // Motivo seleccionado en el formulario.
  motivo: string;
  // Codigo escrito y seleccionado en el campo Reemplazar a.
  reemplazarACodigo: string;
  // Numero de vacantes escrito en el formulario.
  nroVacantes: string;
  // Estado seleccionado en el formulario.
  estado: string;
  // Texto cargado automaticamente en Funciones y observaciones.
  funcionesYObservaciones: string;
  // Valor cargado automaticamente en Salario.
  salario: string;
  // Indica si el apartado Estructura administrativa quedo visible despues de seleccionar el Estado.
  estructuraAdministrativaVisible: boolean;
};

// Define el resultado de intentar guardar la requisicion.
export type AddNewRequisicionResult = {
  // Indica si la requisicion se pudo crear correctamente.
  created: boolean;
  // Indica si el flujo regreso a la bandeja de Requisicion de Personal.
  returnedToInbox: boolean;
  // Mensaje de bloqueo mostrado por Midasoft cuando no permite crear.
  blockingMessage?: string;
};

// Define callbacks opcionales para documentar estados especiales durante el guardado.
export type AddNewRequisicionOptions = {
  // Se ejecuta cuando Midasoft bloquea por plazas disponibles en cero, antes de cerrar la alerta visual.
  onBlocked?: (message: string) => Promise<void>;
};

// Nombre flexible para encontrar el campo "Reemplazar a", incluso si la UI cambia levemente el texto.
const reemplazarALabel = /Reempla?zar\s+a|Remplazar\s+a|Reemplzar\s+a/i;

// Nombre flexible para encontrar el campo automatico de funciones y observaciones.
const funcionesYObservacionesLabel = /Funciones\s+y\s+observaci[oó]n(?:es)?|Funciones|Observaciones/i;

// Nombre flexible para encontrar el campo automatico de salario.
const salarioLabel = /Salario/i;

// Nombre flexible para encontrar el campo Nro.vacantes.
const nroVacantesLabel = /Nro\.?\s*vacantes|No\.?\s*vacantes|Numero\s+de\s+vacantes|Número\s+de\s+vacantes|Vacantes/i;

// Nombre flexible para encontrar el campo Estado.
const estadoLabel = /Estado/i;

// Nombre flexible para encontrar el apartado de estructura administrativa.
const estructuraAdministrativaLabel = /Estructura\s+administrativa/i;

// Textos comunes que aparecen dentro del apartado cuando Midasoft termina de cargar su contenido.
const estructuraAdministrativaContenidoLabel =
  /centro\s+de\s+costo|unidad|dependencia|sede|area|Ã¡rea|departamento|regional|empresa|sucursal|nivel|secci[oÃ³]n/i;

// Nombre flexible para encontrar el boton final que agrega la requisicion.
const agregarRequisicionLabel = /^\s*Agregar\s*$/i;

// Nombre flexible para identificar la bandeja/listado de Requisicion de Personal.
const bandejaRequisicionPersonalLabel =
  /requisi[cç]i[oó]n\s+de\s+personal|requision\s+de\s+personal|bandeja|listado|registros|consultar|buscar/i;

// Nombre flexible para reconocer el menu padre cuando el flujo vuelve a Transacciones.
const transaccionesLabel = /^\s*Transacciones\s*$/i;

// Nombre flexible para abrir de nuevo la opcion Requisicion de personal desde Transacciones.
const requisicionPersonalMenuLabel = /^\s*Requisi[cç]i[oó]n\s+de\s+personal\s*$/i;

// Mensaje que aparece cuando el oficio no tiene plazas disponibles con la estructura seleccionada.
const plazasDisponiblesCeroLabel =
  /El\s+n[uú]mero\s+de\s+Plazas\s+Disponibles\s+para\s+este\s+cargo\s+con\s+la\s+estructura\s+seleccionada\s+es\s+0|debe\s+configurar\s+o\s+aumentar\s+el\s+n[uú]mero\s+de\s+plazas/i;

// Agrupa textos esperados cuando se abre el formulario para crear una requisicion.
const crearRequisicionLabels = {
  // Textos que suelen existir en el formulario de nueva requisicion.
  formularioRequisicion: /oficio|cargo|solicitante|centro\s+de\s+costo|fecha|vacantes|plazas/i
};

// Escapa texto dinamico para usarlo de forma segura dentro de una expresion regular.
function escapeRegExp(value: string): string {
  // Reemplaza caracteres especiales de regex por su version literal.
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Genera un numero de contrato simple para no depender de datos manuales.
function randomContratoTrabajo(): string {
  // Crea un numero de seis digitos que cambia en cada ejecucion del test.
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}

// Devuelve candidatos para el boton superior de crear nueva requisicion.
function newRequisicionButtonLocators(scope: SearchScope): Locator[] {
  // Combina accesibilidad, textos visibles y clases comunes de icono para soportar cambios pequenos de la UI.
  return [
    scope.getByRole('button', { name: /^\s*(\+|add|agregar|adicionar|crear|nuevo|nueva)\s*$/i }),
    scope.getByRole('link', { name: /^\s*(\+|add|agregar|adicionar|crear|nuevo|nueva)\s*$/i }),
    scope.locator('main button, main a').filter({ hasText: /^\s*(\+|add|agregar|adicionar|crear|nuevo|nueva)\s*$/i }),
    scope.locator('button[title*="Nuevo" i], button[title*="Agregar" i], button[title*="Crear" i]'),
    scope.locator('button[aria-label*="Nuevo" i], button[aria-label*="Agregar" i], button[aria-label*="Crear" i]'),
    scope.locator('a[title*="Nuevo" i], a[title*="Agregar" i], a[title*="Crear" i]'),
    scope.locator('button, a').filter({ hasText: /^\s*\+\s*$/ }),
    scope.locator('button:has(i[class*="plus"]), a:has(i[class*="plus"])'),
    scope.locator('button:has(.fa-plus), a:has(.fa-plus)'),
    scope.locator('button, a').filter({ has: scope.locator('mat-icon').filter({ hasText: /^\s*add\s*$/i }) }),
    scope.locator('button, a').filter({ has: scope.locator('.material-icons, .mat-icon').filter({ hasText: /^\s*add\s*$/i }) })
  ];
}

// Busca el boton superior de nueva requisicion en la pagina principal y en iframes.
async function findNewRequisicionButton(page: Page): Promise<Locator> {
  // Guarda el locator encontrado para poder hacer clic despues de confirmar que existe.
  let selectedLocator: Locator | undefined;

  // Reintenta porque el toolbar superior puede cargarse despues del contenedor principal.
  await expect
    .poll(
      async () => {
        // Revisa primero la pagina principal y luego los iframes internos.
        for (const scope of [page, ...page.frames()]) {
          // Prueba los candidatos conocidos para el boton de crear.
          for (const locator of newRequisicionButtonLocators(scope)) {
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
      { timeout: 60_000, message: 'No se encontro el boton + para crear una requisicion de personal.' }
    )
    .toBe(true);

  // Si no se encontro el locator, falla con el texto visible para poder ajustar el selector.
  if (!selectedLocator) {
    // Obtiene un resumen de la pantalla actual.
    const summary = await visiblePageSummary(page);

    // Lanza un error claro para diagnosticar la UI real.
    throw new Error(`No se encontro el boton + de Requisicion de Personal. Texto visible: ${summary}`);
  }

  // Devuelve el boton encontrado.
  return selectedLocator;
}

// Busca el primer locator visible en la pagina principal o en cualquiera de sus iframes.
async function findVisibleLocator(page: Page, locatorFactories: LocatorFactory[], errorMessage: string): Promise<Locator> {
  // Guarda el locator encontrado para devolverlo despues de la espera.
  let selectedLocator: Locator | undefined;

  // Reintenta porque el formulario puede cargarse por partes despues de abrir la ventana.
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

// Escribe texto en un campo visible usando el locator recibido.
async function fillVisibleField(locator: Locator, value: string): Promise<void> {
  // Lleva el campo al viewport si la ventana lo permite.
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  // Valida que el campo este visible antes de escribir.
  await expect(locator).toBeVisible();
  // Limpia y escribe el valor solicitado.
  await locator.fill(value);
}

// Lee el valor visible de un input, textarea, select o componente que use texto renderizado.
async function readVisibleValue(locator: Locator): Promise<string> {
  // Intenta leer el valor como campo de formulario HTML.
  const inputValue = await locator.inputValue().catch(() => '');

  // Si el input tiene valor, lo devuelve limpio.
  if (inputValue.trim()) {
    return inputValue.trim();
  }

  // Lee propiedades y atributos comunes en componentes antiguos o custom con role="textbox".
  const domValue = await locator
    .evaluate((element) => {
      const htmlElement = element as HTMLElement & {
        value?: string;
        innerText?: string;
      };

      return [
        htmlElement.value,
        htmlElement.getAttribute('value'),
        htmlElement.getAttribute('aria-valuetext'),
        htmlElement.getAttribute('aria-label'),
        htmlElement.getAttribute('title'),
        htmlElement.innerText,
        htmlElement.textContent
      ]
        .map((value) => value?.trim() ?? '')
        .find((value) => value.length > 0);
    })
    .catch(() => '');

  // Si algun atributo o propiedad tiene valor, lo devuelve limpio.
  if (domValue?.trim()) {
    return domValue.trim();
  }

  // Lee el texto visible como respaldo final para componentes no nativos.
  const textContent = await locator.textContent().catch(() => '');

  // Devuelve el texto limpio o cadena vacia si no habia contenido.
  return (textContent ?? '').trim();
}

// Busca el campo Nro. vacantes partiendo de la etiqueta exacta de esa columna.
async function findNroVacantesField(page: Page): Promise<Locator> {
  // Primero usa XPath con texto directo para evitar que coincidan contenedores que tambien incluyen Nro. Canceladas.
  const exactField = await findVisibleLocator(
    page,
    [
      (scope) =>
        scope.locator(
          'xpath=//*[normalize-space(text())="Nro. vacantes" or normalize-space(text())="Nro vacantes" or normalize-space(text())="No. vacantes" or normalize-space(text())="No vacantes"]/following-sibling::*[self::input or self::textarea or @role="textbox"][1]'
        ),
      (scope) =>
        scope.locator(
          'xpath=//*[normalize-space(text())="Nro. vacantes" or normalize-space(text())="Nro vacantes" or normalize-space(text())="No. vacantes" or normalize-space(text())="No vacantes"]/following-sibling::*[1]//*[self::input or self::textarea or @role="textbox"][1]'
        )
    ],
    'No se encontro el campo Nro.vacantes.'
  ).catch(() => undefined);

  // Si el selector exacto encontro un control visible, usalo.
  if (exactField) {
    return exactField;
  }

  // Como respaldo, usa geometria pero solo con etiquetas cuyo texto visible sea exactamente Nro. vacantes.
  return findNearestTextboxAfterExactLabel(page, /^Nro\.?\s*vacantes$|^No\.?\s*vacantes$/i, 'No se encontro el campo Nro.vacantes.');
}

// Busca una opcion visible por texto y hace clic cuando aparece.
async function clickVisibleTextOption(page: Page, text: string, timeout = 5_000): Promise<boolean> {
  // Construye una expresion que busque el texto completo sin importar mayusculas.
  const optionName = new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`, 'i');
  // Construye una segunda expresion mas flexible para opciones que agregan codigo o prefijo al texto visible.
  const optionContainsName = new RegExp(escapeRegExp(text), 'i');

  // Calcula hasta cuando se debe intentar encontrar la opcion.
  const deadline = Date.now() + timeout;

  // Reintenta mientras no se supere el tiempo maximo corto.
  while (Date.now() < deadline) {
    // Revisa pagina principal e iframes, porque los desplegables pueden vivir en cualquiera de los dos lugares.
    for (const scope of [page, ...page.frames()]) {
      // Busca primero opciones accesibles propias de selects/autocompletados modernos.
      const roleOption = scope.getByRole('option', { name: optionName }).first();
      // Si la opcion accesible esta visible, la selecciona.
      if (await roleOption.isVisible().catch(() => false)) {
        await roleOption.click();
        return true;
      }

      // Busca despues texto visible exacto como respaldo para componentes antiguos.
      const textOption = scope.getByText(optionName).first();
      // Si el texto esta visible, lo selecciona.
      if (await textOption.isVisible().catch(() => false)) {
        await textOption.click();
        return true;
      }

      // Algunas listas antiguas muestran la opcion con codigo y descripcion, por ejemplo "A-Ascenso".
      const containsOption = scope
        .locator('li, button, a, tr, mat-option, [role="option"], [role="row"], [role="menuitem"], .ng-option, .select2-results__option')
        .filter({ hasText: optionContainsName })
        .first();

      // Si aparece una opcion que contiene el texto solicitado, la selecciona como respaldo.
      if (await containsOption.isVisible().catch(() => false)) {
        await containsOption.click();
        return true;
      }
    }
  }

  // Devuelve false para que el flujo pueda usar un fallback como Enter.
  return false;
}

// Busca una opcion visible que contenga el texto indicado y la selecciona cuando aparece.
async function clickFirstSearchOption(page: Page, text: string, timeout = 5_000): Promise<boolean> {
  // Crea una expresion que encuentre el codigo dentro de la opcion aunque la UI agregue nombres o datos extra.
  const optionName = new RegExp(escapeRegExp(text), 'i');

  // Calcula hasta cuando se debe intentar encontrar la opcion.
  const deadline = Date.now() + timeout;

  // Reintenta por un tiempo corto porque algunas busquedas abren una lista y otras aceptan el codigo directo.
  while (Date.now() < deadline) {
    // Revisa pagina principal e iframes porque el autocomplete puede renderizarse fuera del formulario.
    for (const scope of [page, ...page.frames()]) {
      // Busca opciones comunes de autocompletados, listas y grillas.
      for (const locator of [
        scope.getByRole('option', { name: optionName }),
        scope.getByRole('row', { name: optionName }),
        scope.getByRole('menuitem', { name: optionName }),
        scope
          .locator('li, mat-option, [role="option"], [role="row"], [role="menuitem"], .ng-option, .select2-results__option, tr')
          .filter({ hasText: optionName })
      ]) {
        // Toma la primera opcion visible.
        const option = locator.first();

        // Si aparece, la selecciona y confirma que hubo seleccion.
        if (await option.isVisible().catch(() => false)) {
          await option.click();
          return true;
        }
      }
    }
  }

  // Devuelve false cuando la aplicacion no mostro lista de sugerencias.
  return false;
}

// Llena el campo Contrato de trabajo con el numero generado o enviado.
async function fillContratoTrabajo(page: Page, contratoTrabajo: string): Promise<void> {
  // Busca el campo usando labels accesibles, roles, placeholders y respaldo por texto cercano.
  const contratoField = await findVisibleLocator(
    page,
    [
      (scope) => scope.getByLabel(/Contrato\s+de\s+trabajo/i),
      (scope) => scope.getByRole('textbox', { name: /Contrato\s+de\s+trabajo/i }),
      (scope) => scope.locator('input[placeholder*="Contrato" i], textarea[placeholder*="Contrato" i]'),
      (scope) => scope.locator('input[aria-label*="Contrato" i], textarea[aria-label*="Contrato" i]'),
      (scope) => scope.locator('xpath=//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "contrato de trabajo")]/following::input[1]')
    ],
    'No se encontro el campo Contrato de trabajo.'
  );

  // Escribe el numero de contrato.
  await fillVisibleField(contratoField, contratoTrabajo);
}

// Llena el campo Nro.vacantes con la cantidad indicada por el caso.
async function fillNroVacantes(page: Page, nroVacantes: string): Promise<string> {
  // Busca por etiqueta exacta para no confundirlo con "Nro. Canceladas" ni con contenedores del bloque.
  const nroVacantesField = await findNroVacantesField(page);

  // Escribe el numero de vacantes.
  await fillVisibleField(nroVacantesField, nroVacantes);
  // Confirma el cambio con Tab para que los formularios legacy ejecuten sus eventos de validacion.
  await nroVacantesField.press('Tab').catch(() => {});
  // Valida el valor real del campo antes de permitir que el flujo presione Agregar.
  let visibleValue = '';

  await expect
    .poll(
      async () => {
        const currentValue = await readVisibleValue(nroVacantesField);
        visibleValue = currentValue.trim();
        return visibleValue;
      },
      { timeout: 10_000, message: `El campo Nro.vacantes no quedo con el valor ${nroVacantes}.` }
    )
    .toBe(nroVacantes);

  // Devuelve el valor real que quedo en pantalla.
  return visibleValue;
}

// Valida que el formulario conserve un numero de vacantes mayor a cero antes de guardar.
async function expectNroVacantesMayorACero(page: Page): Promise<void> {
  // Busca el mismo control visible usado para diligenciar el campo.
  const nroVacantesField = await findNroVacantesField(page);

  // Lee el valor real que ve el usuario.
  const value = await readVisibleValue(nroVacantesField);
  // Convierte el valor a numero tolerando separadores o espacios de la UI.
  const numericValue = Number(value.replace(/[^\d.-]/g, ''));

  // Falla antes de Agregar si el campo esta vacio o no es mayor a cero.
  expect(Number.isFinite(numericValue) && numericValue > 0, `Nro.vacantes debe ser mayor a 0 antes de Agregar. Valor actual: "${value}".`).toBe(true);
}

// Diligencia el campo Reemplazar a y selecciona la opcion unica que aparece en la busqueda.
async function fillReemplazarA(page: Page, reemplazarACodigo: string): Promise<void> {
  // Busca el campo usando labels accesibles, roles, placeholders y respaldo por texto cercano.
  const reemplazarAField = await findVisibleLocator(
    page,
    [
      (scope) => scope.getByLabel(reemplazarALabel),
      (scope) => scope.getByRole('textbox', { name: reemplazarALabel }),
      (scope) => scope.getByRole('combobox', { name: reemplazarALabel }),
      (scope) => scope.locator('input[placeholder*="Reemplazar" i], textarea[placeholder*="Reemplazar" i]'),
      (scope) => scope.locator('input[aria-label*="Reemplazar" i], textarea[aria-label*="Reemplazar" i]'),
      (scope) => scope.locator('xpath=//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "reemplazar a")]/following::input[1]')
    ],
    'No se encontro el campo Reemplazar a.'
  );

  // Escribe el codigo indicado por el caso.
  await fillVisibleField(reemplazarAField, reemplazarACodigo);
  // Intenta seleccionar una sugerencia si la busqueda abre una lista visible.
  const optionWasSelected = await clickFirstSearchOption(page, reemplazarACodigo);

  // Si no aparece lista, confirma el valor escrito para que Midasoft dispare la busqueda al perder foco.
  if (!optionWasSelected) {
    await reemplazarAField.press('Enter').catch(() => {});
    await reemplazarAField.press('Tab').catch(() => {});
  }

  // Valida que el codigo quede escrito aunque la UI no haya mostrado una opcion seleccionable.
  await expect
    .poll(
      async () => {
        const currentValue = await readVisibleValue(reemplazarAField);
        return currentValue.includes(reemplazarACodigo);
      },
      { timeout: 10_000, message: `El campo Reemplazar a no conservo el codigo ${reemplazarACodigo}.` }
    )
    .toBe(true);
}

// Lee y valida que un campo automatico tenga valor despues de seleccionar Reemplazar a.
async function readRequiredAutofilledField(page: Page, locatorFactories: LocatorFactory[], fieldName: string): Promise<string> {
  // Guarda el valor encontrado durante la espera.
  let selectedValue = '';

  // Reintenta porque Midasoft puede tardar unos segundos llenando datos automaticos y puede renderizar varios candidatos.
  await expect
    .poll(
      async () => {
        // Recorre pagina e iframes porque los formularios de Midasoft viven dentro de un iframe.
        for (const scope of [page, ...page.frames()]) {
          // Prueba cada estrategia de localizacion recibida.
          for (const factory of locatorFactories) {
            // Construye el locator candidato para este scope.
            const candidates = factory(scope);
            // Limita la revision para no recorrer una pantalla completa innecesariamente.
            const count = Math.min(await candidates.count().catch(() => 0), 15);

            // Revisa todos los candidatos visibles, no solo el primero.
            for (let index = 0; index < count; index += 1) {
              // Toma el candidato actual.
              const candidate = candidates.nth(index);

              // Ignora controles ocultos o temporales.
              if (!(await candidate.isVisible().catch(() => false))) {
                continue;
              }

              // Lee el valor actual del campo.
              const value = await readVisibleValue(candidate);

              // Si ya tiene contenido, lo guarda y termina.
              if (value.trim()) {
                selectedValue = value.trim();
                return true;
              }
            }
          }
        }

        // Devuelve false para seguir esperando.
        return false;
      },
      { timeout: 30_000, message: `El campo ${fieldName} no se cargo automaticamente.` }
    )
    .toBe(true);

  // Si no se encontro valor despues del polling, falla con un mensaje alineado al campo solicitado.
  if (!selectedValue.trim()) {
    throw new Error(`No se encontro el campo ${fieldName}.`);
  }

  // Devuelve el valor cargado automaticamente.
  return selectedValue;
}

// Lee texto visible que aparece despues de una etiqueta y antes de la siguiente etiqueta conocida.
async function readVisibleTextBetweenLabels(
  page: Page,
  labelPattern: RegExp,
  stopPattern: RegExp,
  fieldName: string,
  minimumLength = 1
): Promise<string> {
  // Guarda el texto encontrado para devolverlo despues del polling.
  let selectedValue = '';

  // Reintenta porque el iframe puede actualizar el texto visible despues de completar campos relacionados.
  await expect
    .poll(
      async () => {
        // Recorre pagina e iframes; Midasoft pinta este formulario dentro de un iframe.
        for (const scope of [page, ...page.frames()]) {
          // Lee el texto que realmente ve el usuario.
          const text = await scope.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
          // Normaliza espacios para que el parseo no dependa de saltos de linea o columnas.
          const normalizedText = text.replace(/\s+/g, ' ').trim();
          // Busca la etiqueta del campo dentro del texto visible.
          const labelIndex = normalizedText.search(labelPattern);

          // Si esta parte de la pagina no contiene la etiqueta, sigue con el siguiente scope.
          if (labelIndex === -1) {
            continue;
          }

          // Obtiene el texto exacto de la etiqueta encontrada para calcular desde donde empieza el valor.
          const labelMatch = normalizedText.slice(labelIndex).match(labelPattern);

          // Si no se pudo calcular la etiqueta, sigue buscando.
          if (!labelMatch?.[0]) {
            continue;
          }

          // Toma el texto posterior a la etiqueta.
          const textAfterLabel = normalizedText.slice(labelIndex + labelMatch[0].length).trim();
          // Encuentra la siguiente etiqueta para cortar el valor del campo actual.
          const stopIndex = textAfterLabel.search(stopPattern);
          // Recorta el valor visible entre ambas etiquetas.
          const value = (stopIndex >= 0 ? textAfterLabel.slice(0, stopIndex) : textAfterLabel).trim();

          // Si hay contenido util, lo guarda y termina.
          if (value.length >= minimumLength) {
            selectedValue = value;
            return true;
          }
        }

        // Devuelve false para seguir esperando.
        return false;
      },
      { timeout: 30_000, message: `El campo ${fieldName} no se cargo automaticamente.` }
    )
    .toBe(true);

  // Devuelve el texto visible encontrado.
  return selectedValue;
}

// Encuentra el primer textbox visible ubicado despues de una etiqueta visible.
async function findNearestTextboxAfterLabel(page: Page, labelPattern: RegExp, labelSearchText: string, errorMessage: string): Promise<Locator> {
  // Guarda el control encontrado para devolverlo despues de la espera.
  let selectedControl: Locator | undefined;

  // Reintenta porque Midasoft puede terminar de pintar los controles algunos segundos despues.
  await expect
    .poll(
      async () => {
        // Recorre pagina e iframes porque el formulario vive dentro de un iframe.
        for (const scope of [page, ...page.frames()]) {
          // Escapa el texto de busqueda que se usara dentro del XPath.
          const normalizedSearchText = labelSearchText.toLowerCase();
          // Busca etiquetas visibles y pequenas; evita tomar contenedores grandes que tambien contienen el texto.
          const labels = scope.locator(
            `xpath=//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "${normalizedSearchText}") and not(self::input) and not(self::textarea) and not(@role="textbox")]`
          );
          const labelCount = Math.min(await labels.count().catch(() => 0), 50);
          const labelBoxes: { box: { x: number; y: number; width: number; height: number } }[] = [];

          // Revisa las etiquetas candidatas por texto visible.
          for (let index = 0; index < labelCount; index += 1) {
            const label = labels.nth(index);
            const text = (await label.innerText({ timeout: 250 }).catch(() => '')).replace(/\s+/g, ' ').trim();

            if (!labelPattern.test(text) || text.length > 80) {
              continue;
            }

            const box = await label.boundingBox().catch(() => null);

            if (box && box.width > 0 && box.height > 0) {
              labelBoxes.push({ box });
            }
          }

          if (labelBoxes.length === 0) {
            continue;
          }

          // Busca controles con rol textbox, input, textarea o contenteditable.
          const controls = scope.locator('input, textarea, [role="textbox"], [contenteditable="true"]');
          const controlCount = Math.min(await controls.count().catch(() => 0), 250);

          // Prueba cada etiqueta contra el primer control visible que aparece despues en pantalla.
          for (const labelInfo of labelBoxes) {
            let closestControl: Locator | undefined;
            let closestDistance = Number.POSITIVE_INFINITY;

            for (let index = 0; index < controlCount; index += 1) {
              const control = controls.nth(index);

              if (!(await control.isVisible().catch(() => false))) {
                continue;
              }

              const controlBox = await control.boundingBox().catch(() => null);

              if (!controlBox || controlBox.width <= 0 || controlBox.height <= 0) {
                continue;
              }

              const isBelowOrBesideLabel = controlBox.y >= labelInfo.box.y - 6;
              const distance = Math.abs(controlBox.y - labelInfo.box.y) + Math.max(0, controlBox.x - labelInfo.box.x);

              if (isBelowOrBesideLabel && distance < closestDistance) {
                closestDistance = distance;
                closestControl = control;
              }
            }

            if (!closestControl) {
              continue;
            }

            selectedControl = closestControl;
            return true;
          }
        }

        // Devuelve false para seguir esperando.
        return false;
      },
      { timeout: 30_000, message: errorMessage }
    )
    .toBe(true);

  if (!selectedControl) {
    throw new Error(errorMessage);
  }

  // Devuelve el locator visible encontrado.
  return selectedControl;
}

// Encuentra el textbox asociado a una etiqueta cuyo texto visible coincide exactamente con el patron.
async function findNearestTextboxAfterExactLabel(page: Page, labelPattern: RegExp, errorMessage: string): Promise<Locator> {
  // Guarda el control encontrado para devolverlo despues de la espera.
  let selectedControl: Locator | undefined;

  // Reintenta porque el formulario puede repintarse despues de seleccionar otros campos.
  await expect
    .poll(
      async () => {
        // Recorre pagina e iframes porque el formulario esta dentro de un iframe.
        for (const scope of [page, ...page.frames()]) {
          // Solo toma nodos con texto propio; asi evita contenedores que mezclan "Nro. vacantes" con "Nro. Canceladas".
          const labels = scope.locator(
            'xpath=//*[not(self::input) and not(self::textarea) and not(@role="textbox") and normalize-space(text())!=""]'
          );
          const labelCount = Math.min(await labels.count().catch(() => 0), 250);

          for (let labelIndex = 0; labelIndex < labelCount; labelIndex += 1) {
            const label = labels.nth(labelIndex);
            const labelText = (await label.innerText({ timeout: 250 }).catch(() => '')).replace(/\s+/g, ' ').trim();

            if (!labelPattern.test(labelText)) {
              continue;
            }

            const labelBox = await label.boundingBox().catch(() => null);

            if (!labelBox || labelBox.width <= 0 || labelBox.height <= 0) {
              continue;
            }

            const controls = scope.locator('input, textarea, [role="textbox"], [contenteditable="true"]');
            const controlCount = Math.min(await controls.count().catch(() => 0), 250);
            let closestControl: Locator | undefined;
            let closestDistance = Number.POSITIVE_INFINITY;

            for (let controlIndex = 0; controlIndex < controlCount; controlIndex += 1) {
              const control = controls.nth(controlIndex);

              if (!(await control.isVisible().catch(() => false))) {
                continue;
              }

              const controlBox = await control.boundingBox().catch(() => null);

              if (!controlBox || controlBox.width <= 0 || controlBox.height <= 0) {
                continue;
              }

              const appearsBelowLabel = controlBox.y >= labelBox.y - 4 && controlBox.y <= labelBox.y + 80;
              const overlapsLabelColumn = controlBox.x <= labelBox.x + labelBox.width + 24 && controlBox.x + controlBox.width >= labelBox.x - 24;

              if (!appearsBelowLabel || !overlapsLabelColumn) {
                continue;
              }

              const distance = Math.abs(controlBox.y - labelBox.y) + Math.abs(controlBox.x - labelBox.x);

              if (distance < closestDistance) {
                closestDistance = distance;
                closestControl = control;
              }
            }

            if (closestControl) {
              selectedControl = closestControl;
              return true;
            }
          }
        }

        return false;
      },
      { timeout: 30_000, message: errorMessage }
    )
    .toBe(true);

  if (!selectedControl) {
    throw new Error(errorMessage);
  }

  return selectedControl;
}

// Lee el valor del primer textbox visible ubicado despues de una etiqueta visible.
async function readNearestTextboxValueAfterLabel(
  page: Page,
  labelPattern: RegExp,
  labelSearchText: string,
  fieldName: string,
  minimumLength = 1
): Promise<string> {
  // Guarda el valor encontrado para devolverlo despues de la espera.
  let selectedValue = '';

  // Reintenta porque Midasoft puede terminar de pintar los valores automaticos algunos segundos despues.
  await expect
    .poll(
      async () => {
        const control = await findNearestTextboxAfterLabel(page, labelPattern, labelSearchText, `No se encontro el campo ${fieldName}.`).catch(
          () => undefined
        );

        if (!control) {
          return false;
        }

        const value = await readVisibleValue(control);

        if (value.trim().length >= minimumLength) {
          selectedValue = value.trim();
          return true;
        }

        return false;
      },
      { timeout: 30_000, message: `El campo ${fieldName} no se cargo automaticamente.` }
    )
    .toBe(true);

  // Devuelve el valor visible encontrado.
  return selectedValue;
}

// Valida que Funciones y observaciones se cargue automaticamente.
async function readFuncionesYObservaciones(page: Page): Promise<string> {
  // Lee el textbox asociado por posicion porque esta UI no expone un label accesible real.
  return readNearestTextboxValueAfterLabel(page, /Funciones\s+y\s+Observaci[oó]n(?:es)?/i, 'funciones', 'Funciones y observaciones', 10);
}

// Valida que Salario se cargue automaticamente.
async function readSalario(page: Page): Promise<string> {
  // Lee primero el texto visible porque la pantalla muestra el salario como "Valores entre ...".
  const visibleSalary = await readVisibleTextBetweenLabels(page, /Salario\s*:/i, /Duracion\s+contrato|Nro\.?\s*vacantes/i, 'Salario', 1);

  // Si el texto visible trae numeros, es suficiente para validar que el salario cargo.
  if (/\d/.test(visibleSalary)) {
    return visibleSalary;
  }

  // Lee el campo usando labels, roles y selectores de respaldo.
  return readRequiredAutofilledField(
    page,
    [
      (scope) => scope.locator('xpath=//*[text()[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "salario")]]/parent::*'),
      (scope) => scope.getByLabel(salarioLabel),
      (scope) => scope.getByRole('textbox', { name: salarioLabel }),
      (scope) => scope.getByRole('spinbutton', { name: salarioLabel }),
      (scope) => scope.locator('input[placeholder*="Salario" i], textarea[placeholder*="Salario" i]'),
      (scope) => scope.locator('input[aria-label*="Salario" i], textarea[aria-label*="Salario" i]'),
      (scope) =>
        scope.locator(
          'xpath=//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "salario")]/following::*[@role="textbox" or self::input or self::textarea]'
        )
    ],
    'Salario'
  );
}

// Llena el campo Cargo que requiere con el oficio tomado desde Consultas Admin.
async function fillCargoQueRequiere(page: Page, cargoQueRequiere: string): Promise<void> {
  // Busca el campo usando varias formas porque puede ser textbox, autocomplete o combobox.
  const cargoField = await findVisibleLocator(
    page,
    [
      (scope) => scope.getByLabel(/Cargo\s+que\s+requiere/i),
      (scope) => scope.getByRole('textbox', { name: /Cargo\s+que\s+requiere/i }),
      (scope) => scope.getByRole('combobox', { name: /Cargo\s+que\s+requiere/i }),
      (scope) => scope.locator('input[placeholder*="Cargo" i], textarea[placeholder*="Cargo" i]'),
      (scope) => scope.locator('input[aria-label*="Cargo" i], textarea[aria-label*="Cargo" i]'),
      (scope) => scope.locator('xpath=//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "cargo que requiere")]/following::input[1]')
    ],
    'No se encontro el campo Cargo que requiere.'
  );

  // Escribe el oficio seleccionado.
  await fillVisibleField(cargoField, cargoQueRequiere);

  // Intenta seleccionar el oficio si la UI abre una lista de autocompletado.
  const optionWasSelected = await clickVisibleTextOption(page, cargoQueRequiere);

  // Si no aparecio una opcion visible, presiona Enter para confirmar el valor escrito.
  if (!optionWasSelected) {
    await cargoField.press('Enter').catch(() => {});
  }
}

// Selecciona el motivo indicado en el formulario de requisicion.
async function selectMotivo(page: Page, motivo: string): Promise<void> {
  // Busca el control del motivo usando labels, roles y selectores de respaldo.
  const motivoField = await findVisibleLocator(
    page,
    [
      (scope) => scope.getByLabel(/Motivo/i),
      (scope) => scope.getByRole('combobox', { name: /Motivo/i }),
      (scope) => scope.getByRole('textbox', { name: /Motivo/i }),
      (scope) => scope.locator('xpath=//*[normalize-space()="Motivo"]/following::button[1]'),
      (scope) => scope.locator('select[aria-label*="Motivo" i], input[aria-label*="Motivo" i]'),
      (scope) =>
        scope.locator(
          'xpath=//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "motivo")]/following::*[self::button or self::select or self::input][1]'
        )
    ],
    'No se encontro el campo Motivo.'
  );

  // Lleva el control al viewport si esta fuera de pantalla.
  await motivoField.scrollIntoViewIfNeeded().catch(() => {});

  // Intenta seleccionar Ascenso como opcion nativa de un select HTML.
  const nativeSelectWorked = await motivoField.selectOption({ label: motivo }).then(() => true).catch(() => false);

  // Si el control era un select nativo, termina aqui.
  if (nativeSelectWorked) {
    return;
  }

  // Abre el desplegable o autocomplete.
  await motivoField.click();

  // Selecciona la opcion visible con el texto solicitado.
  const optionWasSelected = await clickVisibleTextOption(page, motivo, 10_000);

  // Si no se encontro la opcion, falla con un mensaje claro.
  if (!optionWasSelected) {
    throw new Error(`No se encontro la opcion "${motivo}" en el campo Motivo.`);
  }
}

// Selecciona el estado indicado en el formulario de requisicion.
async function selectEstado(page: Page, estado: string): Promise<void> {
  // Busca el control de Estado usando labels, roles y selectores de respaldo.
  const estadoField = await findVisibleLocator(
    page,
    [
      (scope) => scope.getByLabel(estadoLabel),
      (scope) => scope.getByRole('combobox', { name: estadoLabel }),
      (scope) => scope.getByRole('textbox', { name: estadoLabel }),
      (scope) => scope.locator('xpath=//*[normalize-space()="Estado"]/following::button[1]'),
      (scope) => scope.locator('select[aria-label*="Estado" i], input[aria-label*="Estado" i]'),
      (scope) =>
        scope.locator(
          'xpath=//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "estado")]/following::*[self::button or self::select or self::input][1]'
        )
    ],
    'No se encontro el campo Estado.'
  );

  // Lleva el control al viewport si esta fuera de pantalla.
  await estadoField.scrollIntoViewIfNeeded().catch(() => {});

  // Intenta seleccionar Abierta como opcion nativa de un select HTML.
  const nativeSelectWorked = await estadoField.selectOption({ label: estado }).then(() => true).catch(() => false);

  // Si el control era un select nativo, termina aqui.
  if (nativeSelectWorked) {
    return;
  }

  // Abre el desplegable o autocomplete.
  await estadoField.click();

  // Selecciona la opcion visible con el texto solicitado.
  const optionWasSelected = await clickVisibleTextOption(page, estado, 10_000);

  // Si no se encontro la opcion, falla con un mensaje claro.
  if (!optionWasSelected) {
    throw new Error(`No se encontro la opcion "${estado}" en el campo Estado.`);
  }
}

// Revisa si el apartado Estructura administrativa ya muestra controles o contenido propio.
async function isEstructuraAdministrativaReadyInScope(scope: SearchScope): Promise<boolean> {
  // Primero exige que el titulo del apartado ya exista en pantalla.
  const sectionTitle = scope.getByText(estructuraAdministrativaLabel).first();

  if (!(await sectionTitle.isVisible().catch(() => false))) {
    return false;
  }

  // Busca controles despues del titulo; cuando el bloque carga, Midasoft agrega campos de estructura antes de Agregar.
  const followingControls = scope.locator(
    'xpath=//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "estructura administrativa") and string-length(normalize-space(.)) < 80]/following::*[self::input or self::textarea or self::select or @role="textbox" or @role="combobox"][position() <= 30]'
  );
  const controlsCount = await followingControls.count().catch(() => 0);

  for (let index = 0; index < Math.min(controlsCount, 10); index += 1) {
    if (await followingControls.nth(index).isVisible().catch(() => false)) {
      return true;
    }
  }

  // Como respaldo, revisa si cerca del titulo ya aparecen etiquetas del bloque aunque los campos sean de solo lectura.
  const text = await scope.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
  const textSections = text.split(estructuraAdministrativaLabel);
  const textAfterSection = textSections[textSections.length - 1] ?? '';

  return estructuraAdministrativaContenidoLabel.test(textAfterSection.slice(0, 1_200));
}

// Valida que el apartado Estructura administrativa cargue antes de permitir guardar.
async function expectEstructuraAdministrativaReady(page: Page): Promise<boolean> {
  // Guarda el titulo visible para llevarlo al viewport al finalizar la espera.
  let selectedSectionTitle: Locator | undefined;

  // Reintenta porque despues de seleccionar Estado el bloque puede tardar en poblarse.
  await expect
    .poll(
      async () => {
        for (const scope of [page, ...page.frames()]) {
          if (await isEstructuraAdministrativaReadyInScope(scope)) {
            selectedSectionTitle = scope.getByText(estructuraAdministrativaLabel).first();
            return true;
          }
        }

        return false;
      },
      {
        timeout: 45_000,
        message: 'El apartado Estructura administrativa no termino de cargar antes de guardar la requisicion.'
      }
    )
    .toBe(true);

  await selectedSectionTitle?.scrollIntoViewIfNeeded().catch(() => {});

  return true;
}

// Busca el boton final Agregar dentro del formulario de creacion de requisicion.
async function findAgregarRequisicionButton(page: Page): Promise<Locator> {
  // Busca la accion Agregar usando roles accesibles, textos visibles y atributos comunes.
  return findVisibleLocator(
    page,
    [
      (scope) => scope.getByRole('button', { name: agregarRequisicionLabel }),
      (scope) => scope.getByRole('link', { name: agregarRequisicionLabel }),
      (scope) => scope.locator('button:has-text("Agregar"), a:has-text("Agregar")'),
      (scope) => scope.locator('input[type="button"][value*="Agregar" i], input[type="submit"][value*="Agregar" i]'),
      (scope) => scope.locator('button[title*="Agregar" i], a[title*="Agregar" i]'),
      (scope) => scope.locator('button[aria-label*="Agregar" i], a[aria-label*="Agregar" i]')
    ],
    'No se encontro la opcion Agregar para finalizar la requisicion.'
  );
}

// Verifica si la pantalla actual muestra la opcion de crear una nueva requisicion.
async function isNewRequisicionOptionVisible(page: Page): Promise<boolean> {
  // Revisa pagina principal e iframes porque el toolbar puede vivir fuera o dentro del contenido legacy.
  for (const scope of [page, ...page.frames()]) {
    // Reutiliza las estrategias del boton + sin esperar 60 segundos dentro del polling.
    for (const locator of newRequisicionButtonLocators(scope)) {
      if (await locator.first().isVisible().catch(() => false)) {
        return true;
      }
    }
  }

  // Devuelve false cuando la opcion de crear no esta disponible.
  return false;
}

// Verifica si el formulario de creacion sigue visible en la pagina o en algun iframe.
async function isNewRequisicionFormVisible(page: Page): Promise<boolean> {
  // Textos propios del formulario; si cualquiera aparece, no se debe considerar creado.
  const formTextPattern =
    /Contrato\s+de\s+trabajo|Persona\s+que\s+solicita|Cargo\s+que\s+requiere|Reemplazar\s+a|Funciones\s+y\s+Observaci[oó]n(?:es)?|Nro\.?\s*vacantes|Salario\s*:|Duracion\s+contrato/i;

  // Revisa pagina principal y todos los iframes.
  for (const scope of [page, ...page.frames()]) {
    // Lee el texto visible del scope.
    const text = await scope.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
    // Cuenta controles de formulario visibles.
    const formControls = await scope
      .locator('input:visible, textarea:visible, select:visible, [role="textbox"]:visible')
      .count()
      .catch(() => 0);
    // Busca acciones finales propias del formulario.
    const formActionVisible = await scope
      .getByRole('button', { name: /^\s*(Agregar|Cancelar)\s*$/i })
      .first()
      .isVisible()
      .catch(() => false);

    // Considera formulario visible si hay textos propios y controles, o si las acciones Agregar/Cancelar siguen presentes junto a varios campos.
    if ((formTextPattern.test(text) && formControls > 0) || (formActionVisible && formControls > 3)) {
      return true;
    }
  }

  // Devuelve false cuando no hay rastro del formulario de creacion.
  return false;
}

// Espera que Midasoft regrese a la bandeja/listado de Requisicion de Personal despues de agregar.
async function waitForRequisicionPersonalInbox(page: Page): Promise<boolean> {
  // Reintenta porque despues de agregar la aplicacion puede guardar, cerrar el formulario y repintar la bandeja.
  await expect
    .poll(
      async () => {
        // Usa la misma condicion global que define si la bandeja esta lista.
        return isRequisicionPersonalInboxVisible(page);
      },
      {
        timeout: 60_000,
        message: 'Despues de agregar, no se regreso a la bandeja de Requisicion de Personal con la opcion de crear disponible.'
      }
    )
    .toBe(true);

  // Devuelve true para que el test pueda validar explicitamente el resultado.
  return true;
}

// Pregunta si la pantalla actual quedo en el menu padre Transacciones.
async function isTransaccionesMenuVisible(page: Page): Promise<boolean> {
  // Si el formulario sigue abierto, no se debe interpretar como menu padre.
  if (await isNewRequisicionFormVisible(page)) {
    return false;
  }

  // Revisa pagina principal e iframes por consistencia con los menus legacy de Midasoft.
  for (const scope of [page, ...page.frames()]) {
    // El menu padre tiene el titulo Transacciones y la opcion Requisicion de personal disponible.
    const headingVisible = await scope.getByRole('heading', { name: transaccionesLabel }).first().isVisible().catch(() => false);
    const optionVisible = await scope
      .getByRole('button', { name: requisicionPersonalMenuLabel })
      .first()
      .isVisible()
      .catch(() => false);

    if (headingVisible && optionVisible) {
      return true;
    }
  }

  // Devuelve false cuando no se ve el menu padre.
  return false;
}

// Abre Requisicion de personal cuando el flujo quedo devuelto al menu Transacciones.
async function openRequisicionPersonalFromTransaccionesMenu(page: Page): Promise<void> {
  // Revisa pagina principal e iframes para localizar la opcion del menu de forma accesible.
  for (const scope of [page, ...page.frames()]) {
    // Prioriza roles de usuario y deja textos visibles como respaldo.
    const candidates = [
      scope.getByRole('button', { name: requisicionPersonalMenuLabel }).first(),
      scope.getByRole('link', { name: requisicionPersonalMenuLabel }).first(),
      scope.locator('button, a').filter({ hasText: requisicionPersonalMenuLabel }).first()
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click({ timeout: 15_000 });
        return;
      }
    }
  }
}

// Deja el flujo en la bandeja de Requisicion de personal aunque Midasoft haya vuelto al menu Transacciones.
async function ensureRequisicionPersonalInbox(page: Page): Promise<boolean> {
  // Si la bandeja ya esta lista, no navega de nuevo.
  if (await isRequisicionPersonalInboxVisible(page)) {
    return true;
  }

  // Cuando Cancelar o Volver deja el modulo en Transacciones, hay que entrar otra vez a Requisicion de personal.
  if (await isTransaccionesMenuVisible(page)) {
    await openRequisicionPersonalFromTransaccionesMenu(page);
  }

  // Espera la bandeja final con la opcion de crear disponible.
  return waitForRequisicionPersonalInbox(page);
}

// Revisa si la pagina o algun iframe muestra el mensaje de plazas disponibles en cero.
async function findPlazasDisponiblesCeroMessage(page: Page, dialogMessages: string[] = []): Promise<string | undefined> {
  // Revisa primero mensajes capturados desde alertas nativas del navegador.
  for (const message of dialogMessages) {
    // Si el texto coincide con el bloqueo esperado, lo devuelve.
    if (plazasDisponiblesCeroLabel.test(message)) {
      return message;
    }
  }

  // Revisa la pagina principal y todos los iframes activos.
  for (const scope of [page, ...page.frames()]) {
    // Lee el texto visible del scope actual.
    const text = await scope.locator('body').innerText({ timeout: 1_000 }).catch(() => '');

    // Si el texto contiene el bloqueo esperado, devuelve el mensaje visible.
    if (plazasDisponiblesCeroLabel.test(text)) {
      return text.replace(/\s+/g, ' ').trim();
    }
  }

  // Devuelve undefined cuando no existe el bloqueo.
  return undefined;
}

// Cierra la alerta visual cuando Midasoft muestra el bloqueo dentro de la pagina.
async function closePlazasDisponiblesCeroMessage(page: Page): Promise<void> {
  // Define botones comunes para cerrar modales o alertas.
  const closeButtons: LocatorFactory[] = [
    (scope) => scope.getByRole('button', { name: /Aceptar|OK|Cerrar|Entendido/i }),
    (scope) => scope.getByRole('link', { name: /Aceptar|OK|Cerrar|Entendido/i }),
    (scope) => scope.locator('button:has-text("Aceptar"), button:has-text("OK"), button:has-text("Cerrar")'),
    (scope) => scope.locator('a:has-text("Aceptar"), a:has-text("OK"), a:has-text("Cerrar")')
  ];

  // Revisa la pagina principal y todos los iframes activos.
  for (const scope of [page, ...page.frames()]) {
    // Prueba cada posible boton de cierre sin esperar demasiado.
    for (const factory of closeButtons) {
      // Toma el primer boton candidato.
      const button = factory(scope).first();

      // Si esta visible, lo selecciona para cerrar la alerta.
      if (await button.isVisible().catch(() => false)) {
        await button.click().catch(() => {});
        return;
      }
    }
  }

  // Si no encuentra boton visible, usa Escape como respaldo para modales.
  await page.keyboard.press('Escape').catch(() => {});
}

// Busca el boton Cancelar del formulario de nueva requisicion.
async function findCancelarRequisicionButton(page: Page): Promise<Locator> {
  // Busca la accion Cancelar usando textos y roles visibles.
  return findVisibleLocator(
    page,
    [
      (scope) => scope.getByRole('button', { name: /^\s*Cancelar\s*$/i }),
      (scope) => scope.getByRole('link', { name: /^\s*Cancelar\s*$/i }),
      (scope) => scope.locator('button:has-text("Cancelar"), a:has-text("Cancelar")'),
      (scope) => scope.locator('input[type="button"][value*="Cancelar" i], input[type="submit"][value*="Cancelar" i]')
    ],
    'No se encontro el boton Cancelar del formulario de requisicion.'
  );
}

// Intenta usar la flecha superior de volver cuando el formulario queda en estado inconsistente.
async function clickBackFromRequisicionForm(page: Page): Promise<void> {
  // Revisa pagina principal e iframes por si el boton vive fuera o dentro del contenido legacy.
  for (const scope of [page, ...page.frames()]) {
    // Busca botones con icono o texto de volver.
    const candidates = [
      scope.getByRole('button', { name: /volver|atras|atrás|regresar/i }).first(),
      scope.locator('button').filter({ hasText: /arrow_back|volver|atras|atrás|regresar/i }).first(),
      scope.locator('button:has(mat-icon:has-text("arrow_back")), button:has(.material-icons:has-text("arrow_back"))').first()
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click({ timeout: 10_000 }).catch(() => {});
        return;
      }
    }
  }
}

// Sale del formulario actual y espera a que la bandeja quede lista para iniciar otro intento.
export async function returnToRequisicionPersonalInboxFromForm(page: Page): Promise<void> {
  // Si ya esta en bandeja, no hace nada.
  if (await isRequisicionPersonalInboxVisible(page)) {
    return;
  }

  // Acepta posibles confirmaciones nativas al cancelar un formulario con cambios.
  const dialogHandler = async (dialog: Dialog) => {
    await dialog.accept().catch(() => {});
  };

  page.on('dialog', dialogHandler);

  try {
    // Primero usa Cancelar, que es la accion natural de salida del formulario.
    const cancelButton = await findCancelarRequisicionButton(page).catch(() => undefined);

    if (cancelButton) {
      await cancelButton.scrollIntoViewIfNeeded().catch(() => {});
      await cancelButton.click({ timeout: 10_000 }).catch(() => {});
    }

    // Si Cancelar dejo el flujo en el menu padre Transacciones, reabre Requisicion de personal.
    if (!(await isRequisicionPersonalInboxVisible(page)) && (await isTransaccionesMenuVisible(page))) {
      await openRequisicionPersonalFromTransaccionesMenu(page);
    }

    // Si no se regreso a bandeja, usa la flecha superior como respaldo.
    if (!(await isRequisicionPersonalInboxVisible(page))) {
      await clickBackFromRequisicionForm(page);
    }

    // La flecha superior tambien puede devolver al menu Transacciones; desde alli hay que entrar de nuevo al listado.
    if (!(await isRequisicionPersonalInboxVisible(page)) && (await isTransaccionesMenuVisible(page))) {
      await openRequisicionPersonalFromTransaccionesMenu(page);
    }

    // Espera a que la bandeja quede disponible antes del siguiente intento.
    await ensureRequisicionPersonalInbox(page);
  } finally {
    page.off('dialog', dialogHandler);
  }
}

// Pregunta si la bandeja de Requisicion de Personal ya esta visible.
async function isRequisicionPersonalInboxVisible(page: Page): Promise<boolean> {
  // Si cualquier iframe conserva el formulario, todavia no se puede considerar creada.
  if (await isNewRequisicionFormVisible(page)) {
    return false;
  }

  // La opcion de crear debe estar disponible cuando la bandeja queda lista.
  const createOptionVisible = await isNewRequisicionOptionVisible(page);

  if (!createOptionVisible) {
    return false;
  }

  // Revisa la pagina principal y todos los iframes activos.
  for (const scope of [page, ...page.frames()]) {
    // Lee el texto visible del scope actual.
    const text = await scope.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
    // Cuenta tablas o grillas visibles que normalmente representan la bandeja.
    const gridCount = await scope.locator('table:visible, [role="grid"]:visible, [role="table"]:visible').count().catch(() => 0);
    // Pregunta si hay texto compatible con la bandeja o listado.
    const inboxTextVisible = bandejaRequisicionPersonalLabel.test(text);

    // Considera exitoso el regreso solo cuando hay bandeja y opcion de crear.
    if (inboxTextVisible) {
      return true;
    }

    // Como respaldo, acepta una grilla visible solo si tambien esta disponible la opcion de crear.
    if (gridCount > 0 && /requisi[cç]i[oó]n|requision/i.test(text)) {
      return true;
    }
  }

  // Devuelve false cuando la bandeja aun no se ve.
  return false;
}

// Espera el resultado despues de hacer clic en Agregar: creado o bloqueado por plazas en cero.
async function waitForAgregarResult(
  page: Page,
  dialogMessages: string[],
  options: AddNewRequisicionOptions = {}
): Promise<AddNewRequisicionResult> {
  // Guarda el mensaje de bloqueo si Midasoft lo muestra.
  let blockingMessage = '';
  // Guarda el resultado observado durante el polling.
  let outcome: 'created' | 'blocked' | 'form-open' | 'pending' = 'pending';
  // Define desde cuando se espera el resultado para clasificar un formulario que nunca cierra.
  const startedAt = Date.now();

  // Reintenta hasta que aparezca la bandeja o el mensaje de plazas en cero.
  await expect
    .poll(
      async () => {
        // Busca primero el mensaje de bloqueo.
        const message = await findPlazasDisponiblesCeroMessage(page, dialogMessages);

        // Si existe bloqueo, marca el intento como no creado.
        if (message) {
          blockingMessage = message;
          outcome = 'blocked';
          return outcome;
        }

        // Si no hay bloqueo, valida si ya regreso a la bandeja.
        if (await isRequisicionPersonalInboxVisible(page)) {
          outcome = 'created';
          return outcome;
        }

        // Si despues de esperar un tiempo amplio el formulario sigue abierto, no se creo la requisicion.
        if (Date.now() - startedAt > 75_000 && (await isNewRequisicionFormVisible(page))) {
          blockingMessage =
            'Despues de seleccionar Agregar, Midasoft dejo el formulario abierto y no mostro la bandeja de requisiciones ni una alerta de plazas en cero.';
          outcome = 'form-open';
          return outcome;
        }

        // Mientras no haya resultado, sigue esperando.
        return 'pending';
      },
      { timeout: 90_000, message: 'No se pudo confirmar si la requisicion fue creada o bloqueada por plazas en cero.' }
    )
    .not.toBe('pending');

  // Si Midasoft bloqueo por plazas en cero, cierra la alerta y devuelve el resultado controlado.
  if (outcome === 'blocked') {
    // Permite capturar evidencia antes de cerrar el mensaje visual, cuando aplica.
    await options.onBlocked?.(blockingMessage);
    // Cierra la alerta para que el siguiente intento pueda continuar.
    await closePlazasDisponiblesCeroMessage(page);

    return {
      created: false,
      returnedToInbox: false,
      blockingMessage
    };
  }

  // Si el formulario siguio abierto, devuelve intento no creado para que el caso no quede en pending.
  if (outcome === 'form-open') {
    return {
      created: false,
      returnedToInbox: false,
      blockingMessage
    };
  }

  // Si no hubo bloqueo, devuelve creacion exitosa.
  return {
    created: true,
    returnedToInbox: true
  };
}

// Espera a que se muestre el formulario despues de seleccionar el icono +.
async function waitForNewRequisicionForm(page: Page): Promise<void> {
  // Espera hasta que algun iframe o la pagina principal muestre campos propios del formulario.
  await expect
    .poll(
      async () => {
        // Recorre la pagina principal y todos sus iframes.
        for (const scope of [page, ...page.frames()]) {
          // Lee el texto visible del body de ese scope.
          const text = await scope.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
          // Cuenta controles de formulario visibles dentro del scope.
          const formControls = await scope.locator('input:visible, textarea:visible, select:visible').count().catch(() => 0);

          // El formulario se considera abierto cuando hay campos y texto relacionado con requisicion.
          if (formControls > 0 && crearRequisicionLabels.formularioRequisicion.test(text)) {
            return true;
          }
        }

        // Si todavia no hay formulario, sigue esperando.
        return false;
      },
      { timeout: 60_000, message: 'No se mostro el formulario de nueva requisicion de personal.' }
    )
    .toBe(true);
}

// Selecciona el icono + de Requisicion de Personal y espera el formulario de creacion.
export async function openNewRequisicionForm(page: Page): Promise<void> {
  // Busca el boton + superior de la pantalla.
  const newButton = await findNewRequisicionButton(page);
  // Hace clic para abrir el formulario.
  await newButton.click({ timeout: 15_000 });
  // Espera a que el formulario de creacion quede visible.
  await waitForNewRequisicionForm(page);
}

// Llena los campos iniciales del formulario de creacion de requisicion.
export async function fillNewRequisicionForm(page: Page, formData: NewRequisicionFormData): Promise<FilledNewRequisicionFormData> {
  // Usa el contrato enviado o genera uno aleatorio para esta ejecucion.
  const contratoTrabajo = formData.contratoTrabajo ?? randomContratoTrabajo();
  // Usa Ascenso como motivo por defecto porque es la opcion solicitada para este caso.
  const motivo = formData.motivo ?? 'Ascenso';
  // Usa el codigo solicitado para seleccionar la persona a reemplazar.
  const reemplazarACodigo = formData.reemplazarACodigo ?? '00202621';
  // Usa una vacante por defecto porque es el valor solicitado para este caso.
  const nroVacantes = formData.nroVacantes ?? '1';
  // Usa Abierta como estado por defecto porque es la opcion solicitada para este caso.
  const estado = formData.estado ?? 'Abierta';

  // Llena el campo Contrato de trabajo.
  await fillContratoTrabajo(page, contratoTrabajo);
  // Llena el campo Cargo que requiere con el cargo enviado por el caso.
  await fillCargoQueRequiere(page, formData.cargoQueRequiere);
  // Selecciona el motivo de la requisicion.
  await selectMotivo(page, motivo);
  // Llena Reemplazar a con el codigo solicitado y selecciona la opcion sugerida.
  await fillReemplazarA(page, reemplazarACodigo);
  // Valida que Funciones y observaciones se haya cargado automaticamente.
  const funcionesYObservaciones = await readFuncionesYObservaciones(page);
  // Valida que Salario se haya cargado automaticamente.
  const salario = await readSalario(page);
  // Selecciona el estado solicitado.
  await selectEstado(page, estado);
  // Llena y valida el numero de vacantes al final para evitar que otros cambios repinten el campo.
  const nroVacantesVisible = await fillNroVacantes(page, nroVacantes);
  // Valida que Estructura administrativa termine de cargar antes de continuar.
  const estructuraAdministrativaVisible = await expectEstructuraAdministrativaReady(page);

  // Devuelve los datos usados para que el test pueda validarlos o reportarlos despues.
  return {
    contratoTrabajo,
    cargoQueRequiere: formData.cargoQueRequiere,
    motivo,
    reemplazarACodigo,
    nroVacantes: nroVacantesVisible,
    estado,
    funcionesYObservaciones,
    salario,
    estructuraAdministrativaVisible
  };
}

// Selecciona Agregar y valida si Midasoft crea la requisicion o muestra bloqueo por plazas en cero.
export async function addNewRequisicionAndReturnToInbox(
  page: Page,
  options: AddNewRequisicionOptions = {}
): Promise<AddNewRequisicionResult> {
  // Guarda aqui los mensajes de alertas nativas del navegador, si Midasoft usa alert().
  const dialogMessages: string[] = [];
  // Captura una posible alerta nativa y la acepta para no bloquear Playwright.
  const dialogHandler = async (dialog: Dialog) => {
    // Guarda el mensaje para que el flujo pueda decidir si reintenta con otro oficio.
    dialogMessages.push(dialog.message());
    // Acepta la alerta para continuar.
    await dialog.accept().catch(() => {});
  };
  // Registra el listener solo durante este intento de guardar.
  page.on('dialog', dialogHandler);

  try {
    // Valida que la cantidad de vacantes siga escrita antes de intentar guardar.
    await expectNroVacantesMayorACero(page);
    // Confirma que Estructura administrativa no este todavia cargando antes de presionar Agregar.
    await expectEstructuraAdministrativaReady(page);
    // Busca la opcion Agregar del formulario.
    const agregarButton = await findAgregarRequisicionButton(page);
    // Lleva el boton al viewport si la pantalla lo requiere.
    await agregarButton.scrollIntoViewIfNeeded().catch(() => {});
    // Hace clic en Agregar para guardar la requisicion.
    await agregarButton.click({ timeout: 15_000 });
    // Espera que Midasoft confirme si creo la requisicion o si la bloqueo por plazas en cero.
    return await waitForAgregarResult(page, dialogMessages, options);
  } finally {
    // Retira el listener para que los reintentos con otros oficios no acumulen handlers.
    page.off('dialog', dialogHandler);
  }
}
