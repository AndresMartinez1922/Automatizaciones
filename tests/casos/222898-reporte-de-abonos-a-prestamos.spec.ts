// Importa assertions, herramientas principales y tipos de Playwright Test.
import { expect, test, type Frame, type Locator, type Page, type TestInfo } from '@playwright/test';
// Importa lector de Excel para validar el archivo generado por Midasoft.
import XLSX from 'xlsx';
// Importa el generador de evidencias que crea el documento Word con pantallazos.
import { EvidenceReport } from '../support/evidence-report';
// Importa credenciales desde variables de entorno.
import { getMidasoftAdminPassword, getMidasoftCredentials } from '../support/midasoft-env';
// Importa la funcionalidad de Consultas Admin para validar el reporte contra la consulta fuente.
import {
  accessConsultasAdminFromCurrentSession,
  consultasAdminSelectors,
  executeAdminQuery
} from '../support/midasoft-consultas-admin';
// Importa las partes reutilizables del login.
import { openMidasoftLogin, submitMidasoftLogin } from '../support/midasoft-login';

// Agrupa las opciones de menu para llegar al reporte 222898.
const reporteAbonosPrestamosLabels = {
  // Modulo principal en el menu lateral.
  gestionNomina: /gesti[oó]n\s+de\s+n[oó]mina/i,
  // Primer nivel dentro de Gestion de Nomina.
  procesoNovedades: /proceso\s+de\s+novedades/i,
  // Segundo nivel solicitado.
  exportacionImportacion: /exportaci[oó]n\s*\/\s*importaci[oó]n/i,
  // Tercer nivel solicitado.
  transacciones: /^transacciones$/i,
  // Opcion final que abre la pantalla objetivo.
  exportacionVistaTablasProcedimientos: /exportaci[oó]n\s+de\s+vistas?\s*\/\s*tablas\s*\/\s*procedimientos/i
};

// Objeto solicitado para consultar el listado inferior.
const objetoReporteAbonosPrestamos = 'ViewConsolidadosMsp_Pcd_Hap';

type FiltroReporteAbonosPrestamos = {
  nombre: string;
  valorIni: string;
  aplicarFiltro?: boolean;
};

// Filtros que se aplican al objeto para generar el reporte.
const filtrosReporteAbonosPrestamos: FiltroReporteAbonosPrestamos[] = [
  { nombre: 'EMPLEADO', valorIni: '31245' },
  { nombre: 'NOMBRE_COMPLETO', valorIni: 'DAVID FERNANDO MORENO ROZO' },
  { nombre: 'TIPO_NOMINA', valorIni: 'ME' },
  { nombre: 'CLASE_NOMINA', valorIni: 'CA' },
  { nombre: 'NRO_PRESTAMO', valorIni: '202400020623' },
  { nombre: 'CONCEPTO', valorIni: 'PRESTAMO EMPRESA' },
  { nombre: 'DESCRIPCION', valorIni: 'PRESTAMO EMPRESA' },
  { nombre: 'FECHA_APROBADO', valorIni: '26/11/2024' },
  { nombre: 'FECHA_INICIO', valorIni: '26/11/2024' },
  { nombre: 'FECHA_DE_FINALIZACION', valorIni: '26/11/2024' },
  { nombre: 'VALOR MSP', valorIni: '26000000', aplicarFiltro: false },
  { nombre: 'MONTO_TOTAL', valorIni: '26000000' },
  { nombre: 'ACUMULADO_PAGADO', valorIni: '13722218' },
  { nombre: 'SALDO', valorIni: '12277782' },
  { nombre: 'FECHA_ULTIMO_DESCUENTO', valorIni: '30/06/2026' },
  { nombre: 'OBSERVACION', valorIni: '' },
  { nombre: 'ANO_PRO', valorIni: '2025' },
  { nombre: 'MES_PRO', valorIni: '08' },
  { nombre: 'PERIODO', valorIni: '08' },
  { nombre: 'SLD_INI', valorIni: '20222224' },
  { nombre: 'VLR_DBT', valorIni: '0' },
  { nombre: 'VLR_CRD', valorIni: '722222' },
  { nombre: 'FECHA', valorIni: '' },
  { nombre: 'VALOR', valorIni: '' }
];

type ReporteAbonosPrestamosDownload = {
  fileName: string;
  filePath: string;
};

type ReporteAbonosPrestamosExcelValidation = {
  sheetName: string;
  dataRowCount: number;
  validatedFilterCount: number;
  validatedColumns: string[];
  sampleValues: Array<{
    columna: string;
    esperado: string;
    obtenido: string;
  }>;
};

type ReportDataRow = Record<string, string>;

type ReporteAbonosPrestamosAdminValidation = {
  sheetName: string;
  adminRowCount: number;
  excelRowCount: number;
  validatedColumnCount: number;
  validatedColumns: string[];
  sampleValues: Array<{
    columna: string;
    esperado: string;
    obtenido: string;
  }>;
};

type ReporteAbonosPrestamosAdminCountValidation = {
  sheetName: string;
  adminRowCount: number;
  excelRowCount: number;
  filtroResumen: string;
};

type GeneratedEvidenceStep = Parameters<EvidenceReport['capture']>[1];

type ReporteAbonosPrestamosScenario = {
  testNumber: number;
  title: string;
  description: string;
  expectedResult: string;
  filtros: FiltroReporteAbonosPrestamos[];
  validateExcelContent: boolean;
  validateAgainstConsultasAdmin?: boolean;
  validateAdminRowCountOnly?: boolean;
};

const filtrosReporteAbonosPrestamosIndividuales = filtrosReporteAbonosPrestamos.filter(
  (filter) => filter.valorIni.trim() && filter.aplicarFiltro !== false
);

const reporteAbonosPrestamosScenarios: ReporteAbonosPrestamosScenario[] = [
  {
    testNumber: 1,
    title: 'Reporte de abonos a prestamos con todos los parametros',
    description: 'Validar la generacion del reporte de abonos a prestamos enviando todos los parametros disponibles del caso.',
    expectedResult:
      'El sistema debe permitir generar el reporte filtrado con todos los parametros y el Excel debe coincidir con la informacion enviada.',
    filtros: filtrosReporteAbonosPrestamos,
    validateExcelContent: true,
    validateAgainstConsultasAdmin: true
  },
  ...filtrosReporteAbonosPrestamosIndividuales.map((filter, index) => ({
    testNumber: index + 2,
    title: `Reporte de abonos a prestamos filtrando solo por ${filter.nombre}`,
    description: `Validar la generacion del reporte de abonos a prestamos enviando unicamente el parametro ${filter.nombre}.`,
    expectedResult: `El sistema debe permitir generar y descargar el reporte cuando solo se envia el parametro ${filter.nombre}.`,
    filtros: [filter],
    validateExcelContent: false,
    validateAdminRowCountOnly: true
  }))
];

// Devuelve el valor configurado para un filtro base del caso.
function baseFilterValue(nombre: string): string {
  const filter = filtrosReporteAbonosPrestamos.find((currentFilter) => normalizeColumnName(currentFilter.nombre) === normalizeColumnName(nombre));

  if (!filter) {
    throw new Error(`No se encontro el filtro base ${nombre}.`);
  }

  return filter.valorIni;
}

// Escapa valores de texto para construir condiciones SQL del query de contraste.
function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// Normaliza numeros usados en SQL para que 08 y 8 se filtren como el mismo valor numerico.
function sqlNumber(value: string): string {
  const normalizedValue = value.replace(/[^\d.-]/g, '');

  if (!normalizedValue) {
    throw new Error(`No se pudo convertir a numero el valor "${value}".`);
  }

  return normalizedValue.replace(/^(-?)0+(?=\d)/, '$1');
}

// Compara campos numericos o alfanumericos como texto para evitar conversiones SQL en tablas mixtas.
function sqlTextNumberCondition(expression: string, value: string): string {
  const normalizedValue = sqlNumber(value);

  return `TRY_CONVERT(DECIMAL(38, 6), ${expression}) = TRY_CONVERT(DECIMAL(38, 6), ${sqlText(normalizedValue)})`;
}

// Devuelve la expresion SQL que corresponde a cada columna visible del reporte.
function adminFilterSqlCondition(filter: FiltroReporteAbonosPrestamos, useTextSafeComparisons = false): string {
  const value = filter.valorIni.trim();

  switch (normalizeColumnName(filter.nombre)) {
    case 'EMPLEADO':
      return `MSP.EMPLEADO = ${sqlText(value)}`;
    case 'NOMBRECOMPLETO':
      return `LTRIM(RTRIM(EMP.NOMBRE)) + ' ' + LTRIM(RTRIM(EMP.APELLIDO)) = ${sqlText(value)}`;
    case 'TIPONOMINA':
      return `EMP.TIPO_NOM = ${sqlText(value)}`;
    case 'CLASENOMINA':
      return `MSP.CLASE_NOM = ${sqlText(value)}`;
    case 'NROPRESTAMO':
      return sqlTextNumberCondition('MSP.N_PRESTAMO', value);
    case 'CONCEPTO':
      return `CMP.DESCRIPCION = ${sqlText(value)}`;
    case 'DESCRIPCION':
      return `MSP.DESCRIPCION = ${sqlText(value)}`;
    case 'FECHAAPROBADO':
      return `CONVERT(VARCHAR(10), MSP.F_APROBADO, 103) = ${sqlText(value)}`;
    case 'FECHAINICIO':
      return `CONVERT(VARCHAR(10), MSP.F_INICIO, 103) = ${sqlText(value)}`;
    case 'FECHADEFINALIZACION':
      return `CONVERT(VARCHAR(10), DATEADD(DAY, MSP.PLAZO, MSP.F_INICIO), 103) = ${sqlText(value)}`;
    case 'VALORMSP':
      return `MSP.VALOR = ${sqlNumber(value)}`;
    case 'MONTOTOTAL':
      return `MSP.MONTO_T = ${sqlNumber(value)}`;
    case 'ACUMULADOPAGADO':
      return `MSP.ACUM_PAG = ${sqlNumber(value)}`;
    case 'SALDO':
      return `(MSP.MONTO_T - MSP.ACUM_PAG) = ${sqlNumber(value)}`;
    case 'FECHAULTIMODESCUENTO':
      return `CONVERT(VARCHAR(10), MSP.F_ULT_DSCTO, 103) = ${sqlText(value)}`;
    case 'OBSERVACION':
      return `ISNULL(MSP.OBSERVACION, '') = ${sqlText(value)}`;
    case 'ANOPRO':
      return useTextSafeComparisons ? sqlTextNumberCondition('PCD.ANO_PRO', value) : `PCD.ANO_PRO = ${sqlNumber(value)}`;
    case 'MESPRO':
      return useTextSafeComparisons ? sqlTextNumberCondition('PCD.MES_PRO', value) : `PCD.MES_PRO = ${sqlNumber(value)}`;
    case 'PERIODO':
      return useTextSafeComparisons ? sqlTextNumberCondition('PCD.PERIODO', value) : `PCD.PERIODO = ${sqlNumber(value)}`;
    case 'SLDINI':
      return useTextSafeComparisons ? sqlTextNumberCondition('PCD.SLD_INI', value) : `PCD.SLD_INI = ${sqlNumber(value)}`;
    case 'VLRDBT':
      return useTextSafeComparisons ? sqlTextNumberCondition('PCD.VLR_DBT', value) : `PCD.VLR_DBT = ${sqlNumber(value)}`;
    case 'VLRCRD':
      return useTextSafeComparisons ? sqlTextNumberCondition('PCD.VLR_CRD', value) : `PCD.VLR_CRD = ${sqlNumber(value)}`;
    case 'FECHA':
      return `CONVERT(VARCHAR(10), HAP.FECHA, 103) = ${sqlText(value)}`;
    case 'VALOR':
      return `HAP.VALOR = ${sqlNumber(value)}`;
    default:
      throw new Error(`No existe mapeo SQL para el filtro ${filter.nombre}.`);
  }
}

// Construye las condiciones WHERE que deben coincidir con los filtros enviados en la pantalla.
function reporteAbonosPrestamosAdminWhereConditions(
  filtros: FiltroReporteAbonosPrestamos[],
  includeNonAppliedFilters = false,
  useTextSafeComparisons = false
): string[] {
  return filtros
    .filter((filter) => filter.valorIni.trim())
    .filter((filter) => includeNonAppliedFilters || filter.aplicarFiltro !== false)
    .map((filter) => adminFilterSqlCondition(filter, useTextSafeComparisons));
}

// Une las tablas fuente del reporte para los queries de contraste.
function reporteAbonosPrestamosAdminFromClause(): string {
  return `FROM MSP
LEFT JOIN CMP
    ON CMP.CLASE_PRE = MSP.CLASE_PRE
INNER JOIN EMP
    ON EMP.EMPLEADO = MSP.EMPLEADO
INNER JOIN PCD
    ON LTRIM(RTRIM(CONVERT(VARCHAR(50), PCD.N_PRESTAMO))) = LTRIM(RTRIM(CONVERT(VARCHAR(50), MSP.N_PRESTAMO)))
LEFT JOIN HAP
    ON LTRIM(RTRIM(CONVERT(VARCHAR(50), HAP.N_PRESTAMO))) = LTRIM(RTRIM(CONVERT(VARCHAR(50), MSP.N_PRESTAMO)))`;
}

// Query fuente usado para contrastar el primer escenario contra Consultas Admin.
function reporteAbonosPrestamosAdminQuery(
  filtros: FiltroReporteAbonosPrestamos[] = filtrosReporteAbonosPrestamos,
  includeNonAppliedFilters = true
): string {
  const whereConditions = reporteAbonosPrestamosAdminWhereConditions(filtros, includeNonAppliedFilters);

  return `
SELECT
    MSP.EMPLEADO,
    LTRIM(RTRIM(EMP.NOMBRE)) + ' ' + LTRIM(RTRIM(EMP.APELLIDO)) AS [NOMBRE_COMPLETO],
    EMP.TIPO_NOM AS [TIPO_NOMINA],
    MSP.CLASE_NOM AS [CLASE_NOMINA],
    MSP.N_PRESTAMO AS [NRO_PRESTAMO],
    CMP.DESCRIPCION AS CONCEPTO,
    MSP.DESCRIPCION,
    CONVERT(VARCHAR(10), MSP.F_APROBADO, 103) AS [FECHA_APROBADO],
    CONVERT(VARCHAR(10), MSP.F_INICIO, 103) AS [FECHA_INICIO],
    CONVERT(VARCHAR(10), DATEADD(DAY, MSP.PLAZO, MSP.F_INICIO), 103) AS [FECHA_DE_FINALIZACION],
    MSP.VALOR AS [VALOR MSP],
    MSP.MONTO_T AS [MONTO_TOTAL],
    MSP.ACUM_PAG AS [ACUMULADO_PAGADO],
    (MSP.MONTO_T - MSP.ACUM_PAG) AS SALDO,
    CONVERT(VARCHAR(10), MSP.F_ULT_DSCTO, 103) AS [FECHA_ULTIMO_DESCUENTO],
    MSP.OBSERVACION,
    PCD.ANO_PRO,
    PCD.MES_PRO,
    PCD.PERIODO,
    PCD.SLD_INI,
    PCD.VLR_DBT,
    PCD.VLR_CRD,
    CONVERT(VARCHAR(10), HAP.FECHA, 103) AS FECHA,
    HAP.VALOR
${reporteAbonosPrestamosAdminFromClause()}
${whereConditions.length ? `WHERE ${whereConditions.join('\n  AND ')}` : ''}
ORDER BY MSP.EMPLEADO, MSP.N_PRESTAMO, PCD.ANO_PRO, PCD.MES_PRO, PCD.PERIODO, HAP.FECHA, HAP.VALOR`;
}

// Query de conteo usado para los escenarios individuales, donde no se compara campo a campo.
function reporteAbonosPrestamosAdminCountQuery(filtros: FiltroReporteAbonosPrestamos[]): string {
  const whereConditions = reporteAbonosPrestamosAdminWhereConditions(filtros, false, true);

  return `
SELECT COUNT(*) AS TOTAL_REGISTROS
${reporteAbonosPrestamosAdminFromClause()}
${whereConditions.length ? `WHERE ${whereConditions.join('\n  AND ')}` : ''}`;
}

// Despliega el menu lateral de Midasoft.
async function expandSideMenu(page: Page): Promise<void> {
  // Localiza el primer boton del menu lateral, que corresponde al icono de hamburguesa.
  const menuButton = page.locator('nav button').first();

  // Valida que el boton exista antes de interactuar.
  await expect(menuButton).toBeVisible({ timeout: 15_000 });
  // Abre el menu lateral.
  await menuButton.click();
}

// Devuelve el boton del menu lateral que corresponde al modulo indicado.
function sideMenuModuleLocator(page: Page, label: RegExp): Locator {
  return page.locator('nav').getByText(label).first();
}

// Devuelve la opcion visible del contenido principal.
function mainMenuOptionLocator(page: Page, label: RegExp): Locator {
  return page.locator('main').getByRole('button', { name: label }).first();
}

// Selecciona un modulo desde el menu lateral expandido.
async function clickSideMenuModule(page: Page, label: RegExp): Promise<void> {
  // Busca el texto dentro del nav para evitar hacer clic en el contenido principal cubierto por el backdrop.
  const module = sideMenuModuleLocator(page, label);

  // Espera que el modulo este visible en el menu lateral.
  await expect(module).toBeVisible({ timeout: 60_000 });
  // Hace clic en el item visible del menu lateral.
  await module.click({ timeout: 15_000 });
}

// Cierra el menu lateral usando la flecha superior para liberar el contenido principal.
async function closeSideMenu(page: Page): Promise<void> {
  // Cuando el menu esta desplegado, el primer boton del nav cambia a la flecha de cierre.
  const closeButton = page.locator('nav button').first();
  const backdrop = page.locator('.mat-drawer-backdrop.mat-drawer-shown');

  if (!(await backdrop.isVisible().catch(() => false))) {
    return;
  }

  // Cierra el menu lateral como lo haria el usuario.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await expect(closeButton).toBeVisible({ timeout: 15_000 });
    await closeButton.click({ timeout: 15_000 }).catch(() => {});

    if (await backdrop.waitFor({ state: 'hidden', timeout: 5_000 }).then(() => true).catch(() => false)) {
      return;
    }
  }

  // Escape cubre estados en los que Angular conserva el backdrop despues de navegar desde otro modulo.
  await page.keyboard.press('Escape').catch(() => {});
  await expect(backdrop).toBeHidden({ timeout: 10_000 });
}

// Selecciona una opcion visible del contenido principal por nombre accesible.
async function clickMainMenuOption(page: Page, label: RegExp): Promise<void> {
  // Asegura que el menu lateral no intercepte clics del contenido principal.
  await closeSideMenu(page);
  // Prioriza botones del contenido principal para no seleccionar opciones homonimas de otros modulos.
  const option = mainMenuOptionLocator(page, label);

  // Espera que la opcion exista y sea visible.
  await expect(option).toBeVisible({ timeout: 60_000 });
  // Selecciona la opcion del nivel actual.
  await option.click({ timeout: 15_000 });
}

// Selecciona la opcion final y espera que cargue su pantalla.
async function clickFinalMenuOption(page: Page): Promise<void> {
  // Busca la opcion final dentro del contenido principal.
  const finalOption = mainMenuOptionLocator(page, reporteAbonosPrestamosLabels.exportacionVistaTablasProcedimientos);

  // Entra a la opcion final.
  await expect(finalOption).toBeVisible({ timeout: 60_000 });
  await finalOption.click({ timeout: 15_000 });

  // La pantalla final carga el panel de Parametros; este es el indicador funcional del destino.
  await expect(page.locator('main').getByRole('button', { name: /parametros|par[aá]metros/i }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('main').getByRole('radiogroup', { name: /seleccione\s+tipo\s+de\s+objeto/i }).first()).toBeVisible({
    timeout: 60_000
  });
  await expect(page.locator('main').getByRole('textbox', { name: /objeto/i }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('main').getByRole('button', { name: /generar/i }).first()).toBeVisible({ timeout: 60_000 });
}

// Selecciona el objeto dentro del buscador paginado porque el campo Objeto es de solo lectura.
async function selectObjetoFromSearchDialog(page: Page, objectName: string): Promise<void> {
  // Abre el selector de objetos.
  await page.locator('main').getByRole('button', { name: /buscar/i }).first().click();
  const dialog = page.getByRole('dialog', { name: /objeto/i });
  // Espera que el dialogo muestre al menos una opcion seleccionable.
  await expect(dialog.locator('[role="option"]').first()).toBeVisible({ timeout: 60_000 });

  // El objeto esta al final del listado alfabetico; partir de la ultima pagina reduce pasos y flakiness.
  const lastPageButton = page.getByRole('button', { name: /last page/i }).first();

  if (!(await lastPageButton.isDisabled().catch(() => true))) {
    const firstOption = await dialog.locator('[role="option"]').first().innerText().catch(() => '');
    await lastPageButton.click({ timeout: 5_000 });
    await expect.poll(async () => dialog.locator('[role="option"]').first().innerText().catch(() => '')).not.toEqual(firstOption);
  }

  const previousButton = page.getByRole('button', { name: /previous page/i }).first();

  for (let pageIndex = 0; pageIndex < 20; pageIndex += 1) {
    const objectOption = dialog.locator('[role="option"]').filter({ hasText: objectName }).first();

    if (await objectOption.isVisible().catch(() => false)) {
      await objectOption.click();
      await expect(page.locator('main').getByRole('textbox', { name: /objeto/i }).first()).toHaveValue(objectName, {
        timeout: 60_000
      });
      return;
    }

    const firstOption = await dialog.locator('[role="option"]').first().innerText().catch(() => '');
    const wentToPreviousPage = await previousButton
      .click({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!wentToPreviousPage) {
      break;
    }

    await expect.poll(async () => dialog.locator('[role="option"]').first().innerText().catch(() => '')).not.toEqual(firstOption);
  }

  throw new Error(`No se encontro el objeto ${objectName} en el selector de objetos visibles.`);
}

// Diligencia el campo Objeto y espera que aparezca el listado filtrado.
async function fillObjetoAndReadNombres(page: Page, objectName: string): Promise<string[]> {
  // Selecciona el objeto desde el buscador porque el textbox visible es readonly.
  await selectObjetoFromSearchDialog(page, objectName);

  // Espera hasta que el listado inferior muestre el objeto escrito.
  await expect
    .poll(
      async () => {
        const nombres = await readVisibleNombreColumnValues(page);
        return nombres.length;
      },
      { timeout: 60_000, message: `No se mostro el listado de columnas para ${objectName}.` }
    )
    .toBeGreaterThan(0);

  // Lee los valores visibles de la columna Nombre.
  return readVisibleNombreColumnValues(page);
}

// Extrae los nombres desde el texto visible cuando la grilla Angular no usa una tabla HTML nativa.
function parseNombreColumnFromVisibleText(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const startIndex = lines.findIndex((line) => /^valor\s+fin$/i.test(line));
  const names: string[] = [];

  if (startIndex < 0) {
    return names;
  }

  for (let index = startIndex + 1; index < lines.length - 1; index += 1) {
    const current = lines[index];
    const next = lines[index + 1];

    if (/^\d+$/.test(current) && next && !/^\d+$/.test(next)) {
      names.push(next);
      index += 1;
    }
  }

  return Array.from(new Set(names));
}

// Normaliza nombres de columnas para tolerar diferencias visuales como espacios o guiones bajos.
function normalizeColumnName(value: string): string {
  return value.replace(/[\s_]+/g, '').toUpperCase();
}

// Normaliza valores para comparar el Excel contra los filtros enviados.
function normalizeComparableValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

// Limpia el SQL para mostrarlo en el reporte sin saltos de linea excesivos.
function formatQueryForEvidence(query: string): string {
  return query.replace(/\s+/g, ' ').trim();
}

// Convierte fechas de Excel a dd/mm/aaaa cuando el filtro espera ese formato.
function formatExcelDate(value: Date): string {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = String(value.getFullYear());

  return `${day}/${month}/${year}`;
}

// Lee una celda del Excel como texto comparable.
function readExcelCellValue(cellValue: unknown, expectedValue: string): string {
  if (cellValue instanceof Date) {
    return formatExcelDate(cellValue);
  }

  if (typeof cellValue === 'number' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(expectedValue)) {
    const parsedDate = XLSX.SSF.parse_date_code(cellValue);

    if (parsedDate) {
      return `${String(parsedDate.d).padStart(2, '0')}/${String(parsedDate.m).padStart(2, '0')}/${parsedDate.y}`;
    }
  }

  return String(cellValue ?? '').replace(/\s+/g, ' ').trim();
}

// Normaliza valores de reporte para comparar Consultas Admin contra Excel sin romper por formato visual.
function normalizeReportDataValue(value: string): string {
  const trimmedValue = value.replace(/\s+/g, ' ').trim().toUpperCase();

  if (!trimmedValue) {
    return '';
  }

  const dateMatch = trimmedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (dateMatch) {
    return `${Number(dateMatch[1])}/${Number(dateMatch[2])}/${dateMatch[3]}`;
  }

  const numericCandidate = trimmedValue.replace(/,/g, '');

  if (/^-?\d+(?:\.\d+)?$/.test(numericCandidate)) {
    const [integerPart, decimalPart = ''] = numericCandidate.split('.');
    const normalizedInteger = integerPart.replace(/^(-?)0+(?=\d)/, '$1');
    const normalizedDecimal = decimalPart.replace(/0+$/, '');

    return normalizedDecimal ? `${normalizedInteger}.${normalizedDecimal}` : normalizedInteger;
  }

  return trimmedValue;
}

// Construye una firma comparable de una fila usando las columnas esperadas del reporte.
function reportRowSignature(row: ReportDataRow, columns: string[]): string {
  return columns.map((column) => normalizeReportDataValue(row[normalizeColumnName(column)] ?? '')).join('||');
}

// Lee todas las filas visibles devueltas por Consultas Admin.
async function readConsultasAdminResultRows(queryFrame: Frame): Promise<ReportDataRow[]> {
  const resultsTable = queryFrame.locator(consultasAdminSelectors.resultsTable);

  await expect(resultsTable).toBeVisible({ timeout: 30_000 });

  const rows = await resultsTable.evaluate((table) => {
    const normalize = (value: string | null | undefined) =>
      (value ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[\s_]+/g, '')
        .toUpperCase();
    const tableRows = Array.from(table.querySelectorAll('tr'));
    const headerRow = tableRows.find((row) => row.querySelectorAll('th,td').length >= 1);
    const headers = Array.from(headerRow?.querySelectorAll('th,td') ?? []).map((cell) => normalize(cell.textContent));

    if (!headers.length) {
      return [];
    }

    return tableRows
      .slice(tableRows.indexOf(headerRow as HTMLTableRowElement) + 1)
      .map((row) => {
        const cells = Array.from(row.querySelectorAll('td'));

        if (cells.length < headers.length) {
          return undefined;
        }

        return headers.reduce<Record<string, string>>((currentRow, header, index) => {
          currentRow[header] = (cells[index]?.textContent ?? '').replace(/\s+/g, ' ').trim();
          return currentRow;
        }, {});
      })
      .filter((row): row is Record<string, string> => Boolean(row) && Object.values(row).some((value) => value.trim()));
  });

  if (!rows.length) {
    throw new Error('Consultas Admin no devolvio registros para contrastar el reporte.');
  }

  return rows;
}

// Extrae filas del Excel descargado usando las columnas esperadas del reporte.
function readReporteExcelRows(filePath: string, columns: string[]): { sheetName: string; rows: ReportDataRow[] } {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('El archivo descargado no contiene hojas para validar.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '', raw: true });
  const headerRowIndex = rawRows.findIndex((row) => {
    const normalizedHeaders = row.map((cell) => normalizeColumnName(String(cell ?? '')));
    const matchedHeaders = columns.filter((column) => normalizedHeaders.includes(normalizeColumnName(column)));

    return matchedHeaders.length >= Math.min(columns.length, 5);
  });

  if (headerRowIndex < 0) {
    throw new Error('No se encontro en el Excel una fila de encabezados compatible con Consultas Admin.');
  }

  const headers = rawRows[headerRowIndex].map((cell) => String(cell ?? ''));
  const columnIndexes = new Map<string, number>();

  headers.forEach((header, index) => {
    columnIndexes.set(normalizeColumnName(header), index);
  });

  const missingColumns = columns.filter((column) => !columnIndexes.has(normalizeColumnName(column)));

  expect(missingColumns, 'El Excel debe contener todas las columnas devueltas por la consulta fuente.').toEqual([]);

  const rows = rawRows
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? '').trim()))
    .map((row) =>
      columns.reduce<ReportDataRow>((currentRow, column) => {
        const columnIndex = columnIndexes.get(normalizeColumnName(column));
        const expectedValueForFormatting = '';
        currentRow[normalizeColumnName(column)] =
          columnIndex === undefined ? '' : readExcelCellValue(row[columnIndex], expectedValueForFormatting);

        return currentRow;
      }, {})
    );

  return { sheetName: firstSheetName, rows };
}

// Valida que el Excel descargado coincida en cantidad y contenido con Consultas Admin.
function validateReporteExcelAgainstConsultasAdmin(
  filePath: string,
  adminRows: ReportDataRow[],
  columns: string[] = filtrosReporteAbonosPrestamos.map((filter) => filter.nombre)
): ReporteAbonosPrestamosAdminValidation {
  const { sheetName, rows: excelRows } = readReporteExcelRows(filePath, columns);

  expect(excelRows.length, 'La cantidad de filas del Excel debe coincidir con Consultas Admin.').toBe(adminRows.length);

  const expectedSignatures = new Map<string, number>();

  for (const row of adminRows) {
    const signature = reportRowSignature(row, columns);
    expectedSignatures.set(signature, (expectedSignatures.get(signature) ?? 0) + 1);
  }

  const unexpectedRows: string[] = [];

  for (const row of excelRows) {
    const signature = reportRowSignature(row, columns);
    const currentCount = expectedSignatures.get(signature) ?? 0;

    if (currentCount <= 0) {
      unexpectedRows.push(signature);
      continue;
    }

    if (currentCount === 1) {
      expectedSignatures.delete(signature);
    } else {
      expectedSignatures.set(signature, currentCount - 1);
    }
  }

  const missingRows = Array.from(expectedSignatures.entries()).flatMap(([signature, count]) => Array(count).fill(signature));

  expect(
    { missingRows: missingRows.slice(0, 5), unexpectedRows: unexpectedRows.slice(0, 5) },
    'Las filas del Excel deben coincidir campo a campo con Consultas Admin.'
  ).toEqual({ missingRows: [], unexpectedRows: [] });

  const sampleAdminRow = adminRows[0] ?? {};
  const sampleSignature = reportRowSignature(sampleAdminRow, columns);
  const sampleExcelRow = excelRows.find((row) => reportRowSignature(row, columns) === sampleSignature) ?? excelRows[0] ?? {};
  const sampleValues = columns.map((column) => ({
    columna: column,
    esperado: sampleAdminRow[normalizeColumnName(column)] ?? '',
    obtenido: sampleExcelRow[normalizeColumnName(column)] ?? ''
  }));

  return {
    sheetName,
    adminRowCount: adminRows.length,
    excelRowCount: excelRows.length,
    validatedColumnCount: columns.length,
    validatedColumns: columns,
    sampleValues
  };
}

// Lee el total devuelto por el COUNT(*) ejecutado en Consultas Admin.
function readConsultasAdminCount(rows: ReportDataRow[]): number {
  const firstRow = rows[0] ?? {};
  const rawCount = firstRow.TOTALREGISTROS ?? firstRow.COUNT ?? Object.values(firstRow)[0] ?? '';
  const count = Number(String(rawCount).replace(/[^\d.-]/g, ''));

  if (!Number.isFinite(count)) {
    throw new Error(`No se pudo leer el total de registros devuelto por Consultas Admin: ${rawCount}.`);
  }

  return count;
}

// Valida solo la cantidad de registros entre Consultas Admin y el Excel descargado.
function validateReporteExcelRowCountAgainstConsultasAdmin(
  filePath: string,
  adminRowCount: number,
  filtroResumen: string,
  columns: string[] = filtrosReporteAbonosPrestamos.map((filter) => filter.nombre)
): ReporteAbonosPrestamosAdminCountValidation {
  const { sheetName, rows: excelRows } = readReporteExcelRows(filePath, columns);

  expect(excelRows.length, 'La cantidad de filas del Excel debe coincidir con el conteo de Consultas Admin.').toBe(adminRowCount);

  return {
    sheetName,
    adminRowCount,
    excelRowCount: excelRows.length,
    filtroResumen
  };
}

// Escapa texto para construir pantallas HTML de evidencia sin depender de la UI de la app.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Valida que el archivo descargado contenga datos acordes a los filtros diligenciados.
function validateReporteAbonosPrestamosExcel(
  filePath: string,
  filtros: FiltroReporteAbonosPrestamos[] = filtrosReporteAbonosPrestamos
): ReporteAbonosPrestamosExcelValidation {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('El archivo descargado no contiene hojas para validar.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '', raw: true });
  const filtersWithData = filtros.filter((filter) => filter.valorIni.trim());
  const headerRowIndex = rows.findIndex((row) => {
    const normalizedHeaders = row.map((cell) => normalizeColumnName(String(cell ?? '')));
    const matchedHeaders = filtersWithData.filter((filter) => normalizedHeaders.includes(normalizeColumnName(filter.nombre)));

    return matchedHeaders.length >= Math.min(filtersWithData.length, 5);
  });

  if (headerRowIndex < 0) {
    throw new Error('No se encontro en el Excel una fila de encabezados compatible con los filtros enviados.');
  }

  const headers = rows[headerRowIndex].map((cell) => String(cell ?? ''));
  const columnIndexes = new Map<string, number>();

  headers.forEach((header, index) => {
    columnIndexes.set(normalizeColumnName(header), index);
  });

  const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row.some((cell) => String(cell ?? '').trim()));

  expect(dataRows.length, 'El Excel descargado debe contener al menos una fila de datos.').toBeGreaterThan(0);

  const validationErrors: string[] = [];

  for (const filter of filtersWithData) {
    const columnIndex = columnIndexes.get(normalizeColumnName(filter.nombre));

    if (columnIndex === undefined) {
      validationErrors.push(`No se encontro la columna ${filter.nombre} en el Excel.`);
    }
  }

  for (const [rowIndex, row] of dataRows.entries()) {
    for (const filter of filtersWithData) {
      const columnIndex = columnIndexes.get(normalizeColumnName(filter.nombre));

      if (columnIndex === undefined) {
        continue;
      }

      const actualValue = readExcelCellValue(row[columnIndex], filter.valorIni);

      if (normalizeComparableValue(actualValue) !== normalizeComparableValue(filter.valorIni)) {
        validationErrors.push(
          `Fila ${rowIndex + 1}, columna ${filter.nombre}: esperado "${filter.valorIni}", obtenido "${actualValue}".`
        );
      }
    }
  }

  expect(validationErrors, 'Los datos del Excel deben coincidir con los filtros enviados.').toEqual([]);

  const sampleRow = dataRows[0] ?? [];
  const sampleValues = filtersWithData.map((filter) => {
    const columnIndex = columnIndexes.get(normalizeColumnName(filter.nombre));
    const actualValue = columnIndex === undefined ? '' : readExcelCellValue(sampleRow[columnIndex], filter.valorIni);

    return {
      columna: filter.nombre,
      esperado: filter.valorIni,
      obtenido: actualValue
    };
  });

  return {
    sheetName: firstSheetName,
    dataRowCount: dataRows.length,
    validatedFilterCount: filtersWithData.length,
    validatedColumns: filtersWithData.map((filter) => filter.nombre),
    sampleValues
  };
}

// Estilos base para pantallas visuales de evidencia generadas dentro del navegador.
function visualEvidenceBaseHtml(title: string, body: string): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #f3f6fb;
        color: #182033;
        font-family: Arial, Helvetica, sans-serif;
      }
      .shell {
        min-height: 100vh;
        padding: 34px;
      }
      .panel {
        background: #ffffff;
        border: 2px solid #0f8f3d;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
        overflow: hidden;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 24px;
        background: #0f8f3d;
        color: #ffffff;
      }
      h1 {
        margin: 0;
        font-size: 25px;
        line-height: 1.2;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 7px 12px;
        background: #dcfce7;
        color: #166534;
        font-weight: 700;
        font-size: 13px;
        white-space: nowrap;
      }
      .content {
        padding: 22px 24px 26px;
      }
      .grid {
        display: grid;
        grid-template-columns: 210px 1fr;
        gap: 10px 14px;
        margin: 0 0 18px;
      }
      .label {
        color: #475569;
        font-weight: 700;
      }
      .value {
        color: #0f172a;
        overflow-wrap: anywhere;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      th {
        background: #e8f5ee;
        color: #0f5132;
        text-align: left;
        border: 1px solid #b7dfc5;
        padding: 6px 8px;
      }
      td {
        border: 1px solid #d8e2dc;
        padding: 5px 8px;
        vertical-align: top;
      }
      .ok {
        color: #166534;
        font-weight: 700;
      }
      .note {
        margin-top: 14px;
        color: #475569;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="panel">
        <div class="header">
          <h1>${escapeHtml(title)}</h1>
          <span class="badge">Validado</span>
        </div>
        <div class="content">
          ${body}
        </div>
      </section>
    </main>
  </body>
</html>`;
}

// Construye la pantalla visual que evidencia la validacion del Excel descargado.
function validationEvidenceHtml(excelValidation: ReporteAbonosPrestamosExcelValidation): string {
  const rows = excelValidation.sampleValues
    .map(
      (value) =>
        `<tr>
          <td>${escapeHtml(value.columna)}</td>
          <td>${escapeHtml(value.esperado)}</td>
          <td>${escapeHtml(value.obtenido)}</td>
          <td class="ok">Coincide</td>
        </tr>`
    )
    .join('');

  return visualEvidenceBaseHtml(
    'Validacion del Excel descargado',
    `<div class="grid">
      <div class="label">Hoja validada</div>
      <div class="value">${escapeHtml(excelValidation.sheetName)}</div>
      <div class="label">Filas de datos</div>
      <div class="value">${excelValidation.dataRowCount}</div>
      <div class="label">Columnas validadas</div>
      <div class="value">${excelValidation.validatedFilterCount}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Columna</th>
          <th>Valor enviado</th>
          <th>Valor encontrado en Excel</th>
          <th>Resultado</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
  );
}

// Construye la pantalla visual de la validacion contra Consultas Admin.
function adminValidationEvidenceHtml(validation: ReporteAbonosPrestamosAdminValidation): string {
  const rows = validation.sampleValues
    .map(
      (value) =>
        `<tr>
          <td>${escapeHtml(value.columna)}</td>
          <td>${escapeHtml(value.esperado)}</td>
          <td>${escapeHtml(value.obtenido)}</td>
          <td class="ok">Coincide</td>
        </tr>`
    )
    .join('');

  return visualEvidenceBaseHtml(
    'Validacion contra Consultas Admin',
    `<div class="grid">
      <div class="label">Hoja validada</div>
      <div class="value">${escapeHtml(validation.sheetName)}</div>
      <div class="label">Registros Consultas Admin</div>
      <div class="value">${validation.adminRowCount}</div>
      <div class="label">Filas Excel</div>
      <div class="value">${validation.excelRowCount}</div>
      <div class="label">Columnas comparadas</div>
      <div class="value">${validation.validatedColumnCount}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Columna</th>
          <th>Valor Consultas Admin</th>
          <th>Valor Excel</th>
          <th>Resultado</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">La validacion compara cantidad de registros y contenido campo a campo usando todas las columnas del reporte.</p>`
  );
}

// Construye la pantalla visual de la validacion por cantidad de registros.
function adminCountValidationEvidenceHtml(validation: ReporteAbonosPrestamosAdminCountValidation): string {
  return visualEvidenceBaseHtml(
    'Validacion de cantidad contra Consultas Admin',
    `<div class="grid">
      <div class="label">Hoja validada</div>
      <div class="value">${escapeHtml(validation.sheetName)}</div>
      <div class="label">Filtro enviado</div>
      <div class="value">${escapeHtml(validation.filtroResumen)}</div>
      <div class="label">Registros Consultas Admin</div>
      <div class="value">${validation.adminRowCount}</div>
      <div class="label">Filas Excel</div>
      <div class="value">${validation.excelRowCount}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Origen</th>
          <th>Cantidad de registros</th>
          <th>Resultado</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Consultas Admin</td>
          <td>${validation.adminRowCount}</td>
          <td class="ok">Coincide</td>
        </tr>
        <tr>
          <td>Excel descargado</td>
          <td>${validation.excelRowCount}</td>
          <td class="ok">Coincide</td>
        </tr>
      </tbody>
    </table>
    <p class="note">La validacion de los escenarios individuales compara solo la cantidad de registros, porque el resultado puede incluir multiples filas.</p>`
  );
}

// Agrega una tarjeta visual sobre la pantalla real para evidenciar la descarga capturada.
async function showDownloadEvidenceOverlay(page: Page, downloadedReport: ReporteAbonosPrestamosDownload): Promise<void> {
  await page.evaluate((report) => {
    document.getElementById('codex-download-evidence-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'codex-download-evidence-overlay';
    overlay.innerHTML = `
      <style>
        #codex-download-evidence-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 2147483647;
          font-family: Arial, Helvetica, sans-serif;
        }
        #codex-download-evidence-overlay .download-card {
          position: absolute;
          top: 18px;
          right: 26px;
          width: 330px;
          min-height: 86px;
          display: grid;
          grid-template-columns: 34px 1fr;
          gap: 10px;
          align-items: center;
          padding: 14px 16px;
          color: #ffffff;
          background: #20232a;
          border-radius: 9px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.42);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        #codex-download-evidence-overlay .download-icon {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 7px;
          background: #eaf7ef;
          color: #14823b;
          font-size: 19px;
          font-weight: 700;
        }
        #codex-download-evidence-overlay .download-name {
          max-width: 250px;
          margin-bottom: 5px;
          overflow: hidden;
          color: #f8fafc;
          font-size: 13px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        #codex-download-evidence-overlay .download-state {
          color: #d1d5db;
          font-size: 12px;
        }
        #codex-download-evidence-overlay .arrow {
          position: absolute;
          top: 116px;
          right: 352px;
          width: 150px;
          height: 18px;
          background: #10b981;
          border-radius: 999px;
          box-shadow: 0 3px 8px rgba(16, 185, 129, 0.45);
          transform: rotate(-31deg);
          transform-origin: right center;
        }
        #codex-download-evidence-overlay .arrow::after {
          content: '';
          position: absolute;
          right: -4px;
          top: 50%;
          width: 0;
          height: 0;
          border-top: 17px solid transparent;
          border-bottom: 17px solid transparent;
          border-left: 25px solid #10b981;
          transform: translateY(-50%);
        }
        #codex-download-evidence-overlay .toast {
          position: absolute;
          left: 50%;
          bottom: 28px;
          transform: translateX(-50%);
          min-width: 340px;
          padding: 14px 20px;
          color: #ffffff;
          background: #4b5563;
          border-radius: 5px;
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
          font-size: 14px;
          font-weight: 700;
        }
      </style>
      <div class="download-card" aria-label="Descarga capturada">
        <div class="download-icon">✓</div>
        <div>
          <div class="download-name">${report.fileName}</div>
          <div class="download-state">Archivo Excel descargado - Hecho</div>
        </div>
      </div>
      <div class="arrow"></div>
      <div class="toast">Generado exitosamente</div>
    `;

    document.body.appendChild(overlay);
  }, downloadedReport);
}

// Retira la tarjeta visual de descarga despues de tomar el pantallazo.
async function hideDownloadEvidenceOverlay(page: Page): Promise<void> {
  await page.evaluate(() => document.getElementById('codex-download-evidence-overlay')?.remove()).catch(() => {});
}

// Captura la pantalla real de Midasoft con una tarjeta visual que simula la descarga del navegador.
async function captureDownloadEvidenceScreen(
  page: Page,
  evidence: EvidenceReport,
  downloadedReport: ReporteAbonosPrestamosDownload
): Promise<void> {
  await page.locator('main').evaluate((element) => element.scrollTo({ top: 0, left: 0 })).catch(() => {});
  await showDownloadEvidenceOverlay(page, downloadedReport);

  try {
    await evidence.capture(page, {
      title: 'Pantallazo de descarga del archivo',
      description:
        'Se muestra la pantalla real de Midasoft despues de generar el reporte, con una tarjeta visual que identifica el archivo Excel descargado.',
      expected: 'La prueba debe capturar la descarga del archivo generado al seleccionar Generar.',
      actual: `Descarga capturada correctamente: ${downloadedReport.fileName}.`
    });
  } finally {
    await hideDownloadEvidenceOverlay(page);
  }
}

// Captura una pantalla HTML generada para documentar pasos que no tienen UI propia en Midasoft.
async function captureGeneratedEvidenceScreen(page: Page, evidence: EvidenceReport, step: GeneratedEvidenceStep, html: string): Promise<void> {
  const evidencePage = await page.context().newPage();

  try {
    await evidencePage.setViewportSize({ width: 1280, height: 980 });
    await evidencePage.setContent(html);
    await evidence.capture(evidencePage, step);
  } finally {
    await evidencePage.close().catch(() => {});
  }
}

// Lee los valores de la columna Nombre en tablas HTML visibles.
async function readVisibleNombreColumnValues(page: Page): Promise<string[]> {
  const values = await page.locator('main table:visible').evaluateAll((tables) => {
    const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();
    const nombres: string[] = [];

    for (const table of tables) {
      const headers = Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td')).map((cell) =>
        normalize(cell.textContent)
      );
      const columnIndex = headers.findIndex((header) => /^nombre$/i.test(header));

      if (columnIndex < 0) {
        continue;
      }

      const rows = Array.from(table.querySelectorAll('tbody tr')).length
        ? Array.from(table.querySelectorAll('tbody tr'))
        : Array.from(table.querySelectorAll('tr')).slice(1);

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const value = normalize(cells[columnIndex]?.textContent);

        if (value) {
          nombres.push(value);
        }
      }
    }

    return Array.from(new Set(nombres));
  });

  if (values.length > 0) {
    return values;
  }

  // Respaldo para grillas Angular no nativas: toma el texto visible y reconstruye la columna Nombre.
  const text = await page.locator('main').innerText({ timeout: 2_000 }).catch(() => '');
  return parseNombreColumnFromVisibleText(text);
}

// Configura Operador = Igual y Valor Ini solo para las filas que tienen dato de filtro.
async function fillFiltrosReporteAbonosPrestamos(
  page: Page,
  filtros: FiltroReporteAbonosPrestamos[] = filtrosReporteAbonosPrestamos
): Promise<void> {
  const rows = page.locator('main .item-row');
  const filtrosPorNombre = new Map(filtros.map((filter) => [normalizeColumnName(filter.nombre), filter]));

  await expect(rows).toHaveCount(filtrosReporteAbonosPrestamos.length, { timeout: 60_000 });

  for (const [index, filtroBase] of filtrosReporteAbonosPrestamos.entries()) {
    const row = rows.nth(index);
    const rowText = await row.innerText({ timeout: 5_000 });
    const normalizedRowText = normalizeColumnName(rowText);
    const normalizedExpectedName = normalizeColumnName(filtroBase.nombre);
    const filtro = filtrosPorNombre.get(normalizedExpectedName) ?? { ...filtroBase, valorIni: '' };

    if (!normalizedRowText.includes(normalizedExpectedName)) {
      throw new Error(`La fila ${index + 1} no corresponde a ${filtroBase.nombre}. Texto visible: ${rowText}`);
    }

    const operatorField = row.locator('input[placeholder="Seleccionar operador"]').first();
    const valorIniField = row.locator('input[formcontrolname="Valor1"]').first();
    const valorIni = filtro.valorIni.trim();
    const shouldApplyFilter = filtro.aplicarFiltro !== false;

    if (!valorIni || !shouldApplyFilter) {
      continue;
    }

    await operatorField.scrollIntoViewIfNeeded().catch(() => {});
    await operatorField.fill('Igual');

    const igualOption = page.getByRole('option', { name: /^Igual$/i }).first();

    if (await igualOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await igualOption.click();
    } else {
      await operatorField.press('Enter').catch(() => {});
      await operatorField.press('Tab').catch(() => {});
    }

    await expect(operatorField).toHaveValue(/Igual/i, { timeout: 10_000 });

    await expect(valorIniField).toBeEnabled({ timeout: 10_000 });
    await valorIniField.fill(valorIni);
    await expect(valorIniField).toHaveValue(valorIni, { timeout: 10_000 });
  }
}

// Genera el reporte despues de configurar los filtros requeridos.
async function generateReporteAbonosPrestamos(
  page: Page,
  testInfo: TestInfo,
  fileNamePrefix = ''
): Promise<ReporteAbonosPrestamosDownload> {
  const generarButton = page.locator('main').getByRole('button', { name: /generar/i }).first();

  await expect(generarButton).toBeEnabled({ timeout: 30_000 });
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 }).catch(() => undefined);
  await generarButton.click({ timeout: 15_000 });
  const download = await downloadPromise;

  if (!download) {
    throw new Error('No se capturo la descarga del reporte despues de seleccionar Generar.');
  }

  const fileName = download.suggestedFilename();
  const savedFileName = `${fileNamePrefix}${fileName || 'reporte-abonos-prestamos.xlsx'}`;
  const filePath = testInfo.outputPath(savedFileName);

  await download.saveAs(filePath);

  return { fileName: savedFileName, filePath };
}

async function executeReporteAbonosPrestamosScenario(
  page: Page,
  testInfo: TestInfo,
  scenario: ReporteAbonosPrestamosScenario,
  evidence: EvidenceReport
): Promise<void> {
  const credentials = getMidasoftCredentials();
  const scenarioNumber = String(scenario.testNumber).padStart(2, '0');
  const filtrosConDato = scenario.filtros.filter((filter) => filter.valorIni.trim());
  const filtrosTexto = filtrosConDato.map((filter) => `${filter.nombre} = ${filter.valorIni}`).join(', ');
  const shouldValidateAgainstAdmin = scenario.validateAgainstConsultasAdmin || scenario.validateAdminRowCountOnly;
  let consultasAdminRows: ReportDataRow[] = [];
  let consultasAdminRowCount = 0;

  evidence.addStep({
    title: `TEST ${scenarioNumber} - ${scenario.title}`,
    description: scenario.description,
    expected: scenario.expectedResult,
    actual: 'Evidencia documentada'
  });

  {
    await test.step('Given el usuario abre la pagina de login', async () => {
      await openMidasoftLogin(page);

      await evidence.capture(page, {
        title: 'Pagina de login cargada',
        description: 'Se abre la URL de login de Midasoft y se valida que el formulario este disponible.',
        expected: 'La pantalla debe mostrar los campos necesarios para iniciar sesion.',
        actual: 'La pagina de login cargo correctamente.',
        highlight: page.getByRole('button', { name: /ingresar/i })
      });
    });

    await test.step('When inicia sesion con credenciales validas', async () => {
      await submitMidasoftLogin(page, credentials);

      await evidence.capture(page, {
        title: 'Login completado',
        description: 'Se diligencian las credenciales y se confirma el ingreso a Midasoft.',
        expected: 'La aplicacion debe salir de la pantalla de login.',
        actual: 'El usuario ingreso correctamente a la aplicacion.',
        highlight: page.locator('nav button').first()
      });
    });

    await test.step('Then el login queda completado', async () => {
      await expect(page).not.toHaveURL(/\/login\//i);
      await expect(page).toHaveURL(/\/NGMidasoft\//i);
    });

    if (shouldValidateAgainstAdmin) {
      await test.step('And ejecuta el query fuente en Consultas Admin', async () => {
        const adminPassword = getMidasoftAdminPassword();

        await accessConsultasAdminFromCurrentSession(page, adminPassword);
        const adminQuery = scenario.validateAdminRowCountOnly
          ? reporteAbonosPrestamosAdminCountQuery(scenario.filtros)
          : reporteAbonosPrestamosAdminQuery(scenario.filtros, true);
        const adminQueryForEvidence = formatQueryForEvidence(adminQuery);
        const queryFrame = await executeAdminQuery(page, adminQuery);
        const adminResultRows = await readConsultasAdminResultRows(queryFrame);

        if (scenario.validateAdminRowCountOnly) {
          consultasAdminRowCount = readConsultasAdminCount(adminResultRows);
        } else {
          consultasAdminRows = adminResultRows;
          consultasAdminRowCount = consultasAdminRows.length;
        }

        await evidence.capture(page, {
          title: 'Consulta Admin ejecutada',
          description: scenario.validateAdminRowCountOnly
            ? 'Se ejecuta el conteo del query fuente para validar la cantidad de registros del Excel.'
            : 'Se ejecuta el query fuente del reporte para obtener la informacion esperada antes de generar el Excel.',
          expected: `Consultas Admin debe devolver registros para contrastar contra el archivo descargado. Query ejecutado: ${adminQueryForEvidence}`,
          actual: `Consultas Admin devolvio ${consultasAdminRowCount} registros para el TEST ${scenarioNumber}.`,
          highlight: queryFrame.locator(consultasAdminSelectors.resultsTable)
        });
      });
    }

    await test.step('And navega por Gestion de Nomina hasta Exportacion de Vista/tablas/procedimientos', async () => {
      await expandSideMenu(page);

      await evidence.capture(page, {
        title: 'Menu lateral desplegado',
        description: 'Se despliega el menu lateral para ubicar el modulo Gestion de Nomina.',
        expected: 'El menu lateral debe mostrar los modulos disponibles del sistema.',
        actual: 'El menu lateral se desplego correctamente.',
        highlight: sideMenuModuleLocator(page, reporteAbonosPrestamosLabels.gestionNomina)
      });

      await clickSideMenuModule(page, reporteAbonosPrestamosLabels.gestionNomina);
      await closeSideMenu(page);

      await evidence.capture(page, {
        title: 'Gestion de Nomina',
        description: 'Se selecciona el modulo Gestion de Nomina desde el menu lateral.',
        expected: 'El sistema debe mostrar las opciones principales de Gestion de Nomina.',
        actual: 'Gestion de Nomina quedo abierta y lista para seleccionar Proceso de novedades.',
        highlight: mainMenuOptionLocator(page, reporteAbonosPrestamosLabels.procesoNovedades)
      });

      await clickMainMenuOption(page, reporteAbonosPrestamosLabels.procesoNovedades);

      await evidence.capture(page, {
        title: 'Proceso de novedades',
        description: 'Se selecciona Proceso de novedades dentro de Gestion de Nomina.',
        expected: 'El sistema debe mostrar las opciones disponibles dentro de Proceso de novedades.',
        actual: 'Proceso de novedades quedo abierto.',
        highlight: mainMenuOptionLocator(page, reporteAbonosPrestamosLabels.exportacionImportacion)
      });

      await clickMainMenuOption(page, reporteAbonosPrestamosLabels.exportacionImportacion);

      await evidence.capture(page, {
        title: 'Exportacion/Importacion',
        description: 'Se selecciona Exportacion/Importacion dentro de Proceso de novedades.',
        expected: 'El sistema debe mostrar las opciones disponibles de Exportacion/Importacion.',
        actual: 'Exportacion/Importacion quedo abierta.',
        highlight: mainMenuOptionLocator(page, reporteAbonosPrestamosLabels.transacciones)
      });

      await clickMainMenuOption(page, reporteAbonosPrestamosLabels.transacciones);

      await evidence.capture(page, {
        title: 'Transacciones',
        description: 'Se selecciona Transacciones dentro de Exportacion/Importacion.',
        expected: 'El sistema debe mostrar las transacciones disponibles para exportacion e importacion.',
        actual: 'Transacciones quedo abierta y muestra la opcion final del caso.',
        highlight: mainMenuOptionLocator(page, reporteAbonosPrestamosLabels.exportacionVistaTablasProcedimientos)
      });

      await clickFinalMenuOption(page);

      await evidence.capture(page, {
        title: 'Exportacion de Vista/tablas/procedimientos abierta',
        description:
          'Se navega desde el menu lateral por Gestion de Nomina, Proceso de novedades, Exportacion/importacion y Transacciones.',
        expected: 'La pantalla debe mostrar el panel Parametros con tipo de objeto, campo Objeto y accion Generar.',
        actual: 'La pantalla final cargo el panel Parametros con sus controles principales.',
        highlight: page.locator('main').getByRole('textbox', { name: /objeto/i }).first()
      });

      const nombres = await fillObjetoAndReadNombres(page, objetoReporteAbonosPrestamos);

      await evidence.capture(page, {
        title: 'Listado filtrado por Objeto',
        description: `Se diligencia el campo Objeto con ${objetoReporteAbonosPrestamos} y se revisa la columna Nombre del listado inferior.`,
        expected: 'El listado inferior debe mostrar registros asociados al objeto consultado.',
        actual: `Nombres visibles en la columna Nombre: ${nombres.join(', ') || 'No se encontraron nombres visibles.'}`,
        highlight: page.locator('main').getByText(objetoReporteAbonosPrestamos, { exact: true }).first()
      });

      await fillFiltrosReporteAbonosPrestamos(page, scenario.filtros);

      await evidence.capture(page, {
        title: 'Filtros diligenciados',
        description:
          'Se selecciona el operador Igual solo para las columnas con datos del escenario y se diligencia Valor Ini con la informacion requerida.',
        expected: 'Los filtros del escenario deben quedar configurados antes de generar el reporte.',
        actual: filtrosTexto
          ? `Filtros enviados en este test: ${filtrosTexto}.`
          : 'No se enviaron filtros con valor en este test.',
        highlight: page.locator('main .item-row').first()
      });

      const downloadedReport = await generateReporteAbonosPrestamos(page, testInfo, `222898-${scenarioNumber}-`);

      await captureDownloadEvidenceScreen(page, evidence, downloadedReport);

      await testInfo.attach(`Excel descargado 222898-${scenarioNumber}`, {
        path: downloadedReport.filePath,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      if (scenario.validateAgainstConsultasAdmin) {
        const excelValidation = validateReporteExcelAgainstConsultasAdmin(downloadedReport.filePath, consultasAdminRows);

        await captureGeneratedEvidenceScreen(
          page,
          evidence,
          {
            title: 'Pantallazo de validacion contra Consultas Admin',
            description:
              'Se muestra la comparacion entre los registros devueltos por Consultas Admin y el contenido del Excel descargado.',
            expected: 'El Excel debe coincidir con Consultas Admin en cantidad de registros y contenido campo a campo.',
            actual: [
              `Hoja validada: ${excelValidation.sheetName}.`,
              `Registros Consultas Admin: ${excelValidation.adminRowCount}.`,
              `Filas Excel: ${excelValidation.excelRowCount}.`,
              `Columnas comparadas: ${excelValidation.validatedColumns.join(', ')}.`
            ].join(' ')
          },
          adminValidationEvidenceHtml(excelValidation)
        );
      } else if (scenario.validateAdminRowCountOnly) {
        const excelValidation = validateReporteExcelRowCountAgainstConsultasAdmin(
          downloadedReport.filePath,
          consultasAdminRowCount,
          filtrosTexto || 'Sin filtros'
        );

        await captureGeneratedEvidenceScreen(
          page,
          evidence,
          {
            title: 'Pantallazo de validacion de cantidad',
            description: 'Se muestra la comparacion de cantidad de registros entre Consultas Admin y el Excel descargado.',
            expected: 'La cantidad de filas del Excel debe coincidir con el conteo devuelto por Consultas Admin.',
            actual: [
              `Hoja validada: ${excelValidation.sheetName}.`,
              `Registros Consultas Admin: ${excelValidation.adminRowCount}.`,
              `Filas Excel: ${excelValidation.excelRowCount}.`,
              `Filtro enviado: ${excelValidation.filtroResumen}.`
            ].join(' ')
          },
          adminCountValidationEvidenceHtml(excelValidation)
        );
      } else if (scenario.validateExcelContent) {
        const excelValidation = validateReporteAbonosPrestamosExcel(downloadedReport.filePath, scenario.filtros);

        await captureGeneratedEvidenceScreen(
          page,
          evidence,
          {
            title: 'Pantallazo de validacion del Excel',
            description: 'Se muestra la comparacion entre los valores enviados en los filtros y los valores encontrados en el Excel descargado.',
            expected: 'Cada columna validada del Excel debe coincidir con los datos enviados en el caso.',
            actual: [
              `Hoja validada: ${excelValidation.sheetName}.`,
              `Filas de datos validadas: ${excelValidation.dataRowCount}.`,
              `Filtros con datos validados: ${excelValidation.validatedFilterCount}.`,
              `Columnas validadas: ${excelValidation.validatedColumns.join(', ')}.`
            ].join(' ')
          },
          validationEvidenceHtml(excelValidation)
        );
      } else {
        await evidence.capture(page, {
          title: 'Validacion basica de descarga',
          description:
            'Para los escenarios por parametro individual no se ejecuta la comparacion final completa porque el resultado del Excel puede variar.',
          expected: 'El archivo Excel debe descargarse correctamente despues de enviar el parametro individual.',
          actual: `El archivo ${downloadedReport.fileName} fue descargado correctamente para el filtro ${filtrosTexto}.`
        });
      }
    });
  }
}

// Agrupa el caso 222898 de reporte de abonos a prestamos.
test.describe('222898 - Reporte de abonos a prestamos', () => {
  // Omite Firefox y WebKit porque este flujo usa una cuenta real y se valida solo en Chromium.
  test.skip(({ browserName }) => browserName !== 'chromium', 'Este flujo usa una cuenta real y se valida solo en Chromium.');

  test('01-21 - Reporte de abonos a prestamos con parametros completos e individuales', async ({ browser }, testInfo) => {
    // Aumenta el tiempo maximo porque el test consolida todos los escenarios del reporte 222898.
    test.setTimeout(7_200_000);

    const evidence = new EvidenceReport(testInfo, {
      caseId: '222898',
      description:
        'Validar en un solo reporte la generacion del reporte de abonos a prestamos con todos los parametros y con cada parametro enviado de forma individual.',
      analyst: process.env.EVIDENCE_ANALYST ?? 'Andres Giovanni Martinez Merchan',
      expectedResult:
        'El sistema debe permitir generar y descargar el reporte usando todos los parametros y luego usando cada parametro de forma individual.'
    });
    let executionError: unknown;
    let activePage: Page | undefined;
    let activeContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;

    try {
      for (const scenario of reporteAbonosPrestamosScenarios) {
        const scenarioNumber = String(scenario.testNumber).padStart(2, '0');

        await test.step(`${scenarioNumber} - ${scenario.title}`, async () => {
          activeContext = await browser.newContext();
          activePage = await activeContext.newPage();
          let scenarioFailed = false;

          try {
            await executeReporteAbonosPrestamosScenario(activePage, testInfo, scenario, evidence);
          } catch (error) {
            scenarioFailed = true;
            throw error;
          } finally {
            if (!scenarioFailed) {
              await activeContext.close().catch(() => {});
              activeContext = undefined;
              activePage = undefined;
            }
          }
        });
      }
    } catch (error) {
      executionError = error;
      throw error;
    } finally {
      const finalPage = activePage ?? (await browser.newPage());

      try {
        await evidence.finalize(finalPage, executionError);
      } finally {
        await activeContext?.close().catch(() => {});
        if (!activePage) {
          await finalPage.close().catch(() => {});
        }
      }
    }
  });
});
