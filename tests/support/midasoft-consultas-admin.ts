// Importa assertions de Playwright y los tipos necesarios para paginas e iframes.
import { expect, type Frame, type Page } from '@playwright/test';
// Importa la configuracion centralizada de Midasoft.
import { midasoftConfig } from './midasoft-env';
// Importa el helper que localiza iframes por un selector interno.
import { findFrameWithSelector } from './midasoft-frames';

// Centraliza los selectores del modulo de consultas admin.
export const consultasAdminSelectors = {
  // Campo donde se escribe la clave administrativa.
  adminPasswordInput: '#ctl00_ContentPlaceHolder1_txtPass',
  // Boton que confirma la clave administrativa.
  adminSubmitButton: '#ctl00_ContentPlaceHolder1_bt_lg',
  // Radio que habilita la ejecucion de query personalizada.
  queryTypeRadio: '#ctl00_ContentPlaceHolder1_rd_tipoquery_0',
  // Textarea donde se escribe la sentencia SQL.
  queryTextarea: '#ctl00_ContentPlaceHolder1_Query',
  // Boton que ejecuta la consulta.
  executeQueryButton: '#ctl00_ContentPlaceHolder1_Bt_ejecutar',
  // Tabla donde se muestran los resultados.
  resultsTable: '#ctl00_ContentPlaceHolder1_Resultados'
};

// Navega directamente al modulo de consultas admin.
export async function openConsultasAdminPage(
  page: Page,
  consultasAdminUrl = midasoftConfig.consultasAdminUrl
): Promise<void> {
  // Abre la URL administrativa despues de tener una sesion valida.
  await page.goto(consultasAdminUrl, { waitUntil: 'domcontentloaded' });
}

// Busca el iframe que contiene el acceso administrativo, ya sea para ingresar o crear clave.
async function findAdminAccessFrame(page: Page): Promise<Frame> {
  // Guarda el iframe encontrado para poder devolverlo despues del polling.
  let selectedFrame: Frame | undefined;

  // Reintenta porque la aplicacion carga el formulario administrativo dentro de un iframe dinamico.
  await expect
    .poll(
      async () => {
        // Recorre todos los iframes actuales de la pagina.
        for (const frame of page.frames()) {
          // Detecta el flujo normal antiguo: ya existe clave administrativa y aparece el campo tecnico conocido.
          const hasExistingPasswordInput = await frame
            .locator(consultasAdminSelectors.adminPasswordInput)
            .isVisible()
            .catch(() => false);

          // Detecta el flujo inicial: Midasoft pide crear la clave administrativa.
          const hasCreatePasswordForm = await frame
            .getByText(/Crear Contrase[ñn]a/i)
            .isVisible()
            .catch(() => false);

          // Detecta el flujo normal nuevo: solo aparece un campo "Contraseña" y un icono de confirmacion.
          const hasPasswordPrompt = await frame
            .getByText(/contrase[ñn]a correcta|funcionalidad exclusiva/i)
            .isVisible()
            .catch(() => false);

          // Si cualquiera de los dos formularios existe, este es el iframe que necesitamos.
          if (hasExistingPasswordInput || hasCreatePasswordForm || hasPasswordPrompt) {
            selectedFrame = frame;
            return true;
          }
        }

        // Devuelve false para que Playwright siga esperando.
        return false;
      },
      { timeout: 60_000, message: 'No se encontro el formulario de clave administrativa en Consultas Admin.' }
    )
    .toBe(true);

  // Si no se guardo ningun iframe, se detiene con un error explicito.
  if (!selectedFrame) {
    throw new Error('No se pudo seleccionar el iframe de clave administrativa.');
  }

  // Devuelve el iframe que contiene el formulario administrativo.
  return selectedFrame;
}

// Configura la clave administrativa cuando Midasoft muestra el formulario inicial de creacion.
async function createAdminPassword(adminFrame: Frame, adminPassword: string): Promise<void> {
  // Valida que realmente estamos en la ventana alternativa de creacion de clave.
  await expect(adminFrame.getByText(/Crear Contrase[ñn]a/i)).toBeVisible();

  // Localiza el campo visible llamado exactamente "Contraseña".
  const password = adminFrame.getByRole('textbox', { name: /^Contrase[ñn]a$/i });

  // Localiza el campo visible llamado "Confirmar Contraseña".
  const confirmation = adminFrame.getByRole('textbox', { name: /^Confirmar Contrase[ñn]a$/i });

  // Valida que el campo principal este disponible antes de escribir.
  await expect(password).toBeVisible();
  // Valida que el campo de confirmacion este disponible antes de escribir.
  await expect(confirmation).toBeVisible();

  // Escribe la clave administrativa definida en la variable de entorno.
  await password.fill(adminPassword);
  // Repite la clave para confirmar la creacion.
  await confirmation.fill(adminPassword);
  // Selecciona el primer boton visible de la ventana, que corresponde al icono de confirmacion.
  await adminFrame.locator('button:visible').first().click();
}

// Ingresa la clave administrativa en el formulario normal de Consultas Admin.
async function submitAdminPassword(adminFrame: Frame, adminPassword: string): Promise<void> {
  // Pregunta si esta disponible el campo tecnico del flujo antiguo de ingreso de clave.
  const hasExistingPasswordInput = await adminFrame
    .locator(consultasAdminSelectors.adminPasswordInput)
    .isVisible()
    .catch(() => false);

  // Si el campo tecnico existe, se usa el flujo original que ya estaba automatizado.
  if (hasExistingPasswordInput) {
    // Escribe la clave admin dentro del campo ubicado en ese iframe.
    await adminFrame.locator(consultasAdminSelectors.adminPasswordInput).fill(adminPassword);
    // Hace clic en el boton que desbloquea o confirma el acceso al modulo.
    await adminFrame.locator(consultasAdminSelectors.adminSubmitButton).click();
    // Termina porque ya se envio la clave por el flujo antiguo.
    return;
  }

  // Localiza el campo visible "Contraseña" del flujo nuevo.
  const password = adminFrame.getByRole('textbox', { name: /^Contrase[ñn]a$/i });
  // Valida que el campo este listo antes de escribir.
  await expect(password).toBeVisible();
  // Escribe la clave administrativa.
  await password.fill(adminPassword);
  // Selecciona el primer boton visible, que corresponde al icono de confirmacion del formulario.
  await adminFrame.locator('button:visible').first().click();
}

// Ingresa la clave administrativa y devuelve el iframe donde queda disponible el editor SQL.
export async function unlockConsultasAdmin(page: Page, adminPassword: string): Promise<Frame> {
  // Busca el iframe que contiene el acceso admin, sea ingreso normal o creacion inicial de clave.
  const adminFrame = await findAdminAccessFrame(page);

  // Pregunta si esta visible el formulario de creacion de clave administrativa.
  const hasCreatePasswordForm = await adminFrame
    .getByText(/Crear Contrase[ñn]a/i)
    .isVisible()
    .catch(() => false);

  // Si aparece "Crear Contraseña", primero crea y confirma la clave administrativa.
  if (hasCreatePasswordForm) {
    // Llena "Contraseña" y "Confirmar Contraseña" con la clave definida en el entorno.
    await createAdminPassword(adminFrame, adminPassword);

    // Espera a que la ventana de creacion se cierre o cambie al siguiente formulario.
    await adminFrame.getByText(/Crear Contrase[ñn]a/i).waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
  }

  // Busca de nuevo el iframe porque la aplicacion puede reemplazar el contenido despues de crear la clave.
  const passwordFrame = await findAdminAccessFrame(page);
  // Ingresa la clave administrativa en el formulario normal, si todavia se solicita.
  await submitAdminPassword(passwordFrame, adminPassword);

  // Busca el iframe donde aparece el textarea para escribir la consulta SQL.
  const queryFrame = await findFrameWithSelector(page, consultasAdminSelectors.queryTextarea);
  // Valida que el textarea de consulta este visible antes de continuar.
  await expect(queryFrame.locator(consultasAdminSelectors.queryTextarea)).toBeVisible();

  // Devuelve el iframe listo para que otros tests escriban consultas.
  return queryFrame;
}

// Abre Consultas Admin desde una sesion ya iniciada y lo deja listo para ejecutar SQL.
export async function accessConsultasAdminFromCurrentSession(page: Page, adminPassword: string): Promise<Frame> {
  // Navega a la pagina del modulo administrativo.
  await openConsultasAdminPage(page);
  // Ingresa la clave administrativa y retorna el editor SQL habilitado.
  return unlockConsultasAdmin(page, adminPassword);
}

// Alias de compatibilidad para casos existentes que ya usan este nombre.
export async function enterConsultasAdmin(page: Page, adminPassword: string): Promise<Frame> {
  // Usa el flujo explicito que no hace login; requiere una sesion valida previamente.
  return accessConsultasAdminFromCurrentSession(page, adminPassword);
}

// Ejecuta una consulta SQL dentro del modulo de consultas admin y valida que muestre resultados.
export async function executeAdminQuery(page: Page, query: string): Promise<Frame> {
  // Recupera el iframe donde esta el editor de consulta.
  const queryFrame = await findFrameWithSelector(page, consultasAdminSelectors.queryTextarea);

  // Marca la opcion de tipo de consulta que permite ejecutar SQL personalizado.
  await queryFrame.locator(consultasAdminSelectors.queryTypeRadio).check();
  // Escribe la consulta definida por el test.
  await queryFrame.locator(consultasAdminSelectors.queryTextarea).fill(query);
  // Hace clic en el boton que ejecuta la consulta.
  await queryFrame.locator(consultasAdminSelectors.executeQueryButton).click();

  // Valida que el sistema muestre el mensaje de ejecucion correcta.
  await expect(queryFrame.getByText(/Consulta ejecutada correctamente/i)).toBeVisible({ timeout: 30_000 });
  // Valida que la tabla de resultados exista y este visible.
  await expect(queryFrame.locator(consultasAdminSelectors.resultsTable)).toBeVisible();

  // Devuelve el iframe con los resultados por si el test necesita mas validaciones.
  return queryFrame;
}

// Lee el primer valor disponible de una columna especifica en la tabla de resultados.
export async function getFirstResultValueByColumn(queryFrame: Frame, columnName: string): Promise<string> {
  // Localiza la tabla de resultados generada por Consultas Admin.
  const resultsTable = queryFrame.locator(consultasAdminSelectors.resultsTable);

  // Valida que la tabla este visible antes de intentar leer sus celdas.
  await expect(resultsTable).toBeVisible();

  // Ejecuta la lectura dentro del navegador para recorrer filas y columnas como DOM real.
  const value = await resultsTable.evaluate((table, requestedColumn) => {
    // Normaliza textos para comparar "Oficio", "OFICIO" o textos con tildes de forma consistente.
    const normalize = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    // Guarda el nombre de columna solicitado ya normalizado.
    const wantedColumn = normalize(requestedColumn);
    // Convierte todas las filas de la tabla en un arreglo facil de recorrer.
    const rows = Array.from(table.querySelectorAll('tr'));

    // Recorre cada fila buscando primero la cabecera que contiene la columna pedida.
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      // Obtiene las celdas de la fila actual, sean cabeceras th o celdas td.
      const cells = Array.from(rows[rowIndex].querySelectorAll('th,td'));
      // Busca una coincidencia exacta para evitar tomar columnas parecidas por accidente.
      let columnIndex = cells.findIndex((cell) => normalize(cell.textContent ?? '') === wantedColumn);

      // Si no hay coincidencia exacta, permite coincidencia parcial por si la UI agrega iconos o espacios.
      if (columnIndex === -1) {
        columnIndex = cells.findIndex((cell) => normalize(cell.textContent ?? '').includes(wantedColumn));
      }

      // Si esta fila no contiene la cabecera buscada, continua con la siguiente.
      if (columnIndex === -1) {
        continue;
      }

      // Desde la fila siguiente a la cabecera, toma el primer valor no vacio de esa columna.
      for (const dataRow of rows.slice(rowIndex + 1)) {
        // Obtiene las celdas de datos de la fila.
        const dataCells = Array.from(dataRow.querySelectorAll('td'));
        // Lee la celda que corresponde a la columna encontrada.
        const text = dataCells[columnIndex]?.textContent?.trim() ?? '';

        // Devuelve el primer valor real encontrado.
        if (text) {
          return text;
        }
      }
    }

    // Si no se encontro columna o valor, se devuelve null para fallar con un mensaje claro en Node.
    return null;
  }, columnName);

  // Si la tabla no contiene un valor util, detiene la prueba con contexto de la columna solicitada.
  if (!value) {
    throw new Error(`No se encontro un valor para la columna "${columnName}" en la tabla de resultados.`);
  }

  // Devuelve el valor encontrado para que el caso pueda usarlo en pasos posteriores.
  return value;
}

// Lee todos los valores disponibles de una columna especifica en la tabla de resultados.
export async function getResultValuesByColumn(queryFrame: Frame, columnName: string): Promise<string[]> {
  // Localiza la tabla de resultados generada por Consultas Admin.
  const resultsTable = queryFrame.locator(consultasAdminSelectors.resultsTable);

  // Valida que la tabla este visible antes de intentar leer sus celdas.
  await expect(resultsTable).toBeVisible();

  // Ejecuta la lectura dentro del navegador para recorrer filas y columnas como DOM real.
  const values = await resultsTable.evaluate((table, requestedColumn) => {
    // Normaliza textos para comparar nombres de columna sin depender de mayusculas o tildes.
    const normalize = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    // Guarda el nombre de columna solicitado ya normalizado.
    const wantedColumn = normalize(requestedColumn);
    // Convierte todas las filas de la tabla en un arreglo facil de recorrer.
    const rows = Array.from(table.querySelectorAll('tr'));

    // Recorre cada fila buscando primero la cabecera que contiene la columna pedida.
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      // Obtiene las celdas de la fila actual, sean cabeceras th o celdas td.
      const cells = Array.from(rows[rowIndex].querySelectorAll('th,td'));
      // Busca una coincidencia exacta para evitar tomar columnas parecidas por accidente.
      let columnIndex = cells.findIndex((cell) => normalize(cell.textContent ?? '') === wantedColumn);

      // Si no hay coincidencia exacta, permite coincidencia parcial por si la UI agrega iconos o espacios.
      if (columnIndex === -1) {
        columnIndex = cells.findIndex((cell) => normalize(cell.textContent ?? '').includes(wantedColumn));
      }

      // Si esta fila no contiene la cabecera buscada, continua con la siguiente.
      if (columnIndex === -1) {
        continue;
      }

      // Desde la fila siguiente a la cabecera, toma todos los valores no vacios de esa columna.
      return rows
        .slice(rowIndex + 1)
        .map((dataRow) => {
          // Obtiene las celdas de datos de la fila.
          const dataCells = Array.from(dataRow.querySelectorAll('td'));
          // Lee la celda que corresponde a la columna encontrada.
          return dataCells[columnIndex]?.textContent?.trim() ?? '';
        })
        .filter(Boolean);
    }

    // Si no se encontro columna, devuelve arreglo vacio para fallar con un mensaje claro en Node.
    return [];
  }, columnName);

  // Si la tabla no contiene valores utiles, detiene la prueba con contexto de la columna solicitada.
  if (!values.length) {
    throw new Error(`No se encontraron valores para la columna "${columnName}" en la tabla de resultados.`);
  }

  // Devuelve los valores encontrados para que el caso pueda intentar con el siguiente registro.
  return values;
}
