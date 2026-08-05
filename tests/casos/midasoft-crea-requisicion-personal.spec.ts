// Importa las herramientas principales de Playwright Test.
import { expect, test } from '@playwright/test';
// Importa el generador de evidencias que crea el documento Word con pantallazos.
import { EvidenceReport } from '../support/evidence-report';
// Importa credenciales desde variables de entorno.
import { getMidasoftCredentials } from '../support/midasoft-env';
// Importa las piezas reutilizables del login.
import { openMidasoftLogin, submitMidasoftLogin } from '../support/midasoft-login';
// Importa las acciones especificas del escenario de creacion.
import {
  addNewRequisicionAndReturnToInbox,
  fillNewRequisicionForm,
  openNewRequisicionForm
} from '../support/midasoft-crea-requisicion-personal';
// Importa el flujo reutilizable que navega hasta Requisicion de Personal.
import { MidasoftRequisicionPersonalFlow } from '../support/midasoft-requisicion-personal';

// Contrato de trabajo fijo solicitado para el caso.
const contratoTrabajoRequisicion = 'TI TERMINO INDEFINIDO AD/PRO/LOG';

// Cargo fijo solicitado para el caso.
const cargoQueRequiereRequisicion = '10213031048000_INSTRUCTOR(A)';

// Agrupa los escenarios del flujo de creacion de requisicion de personal.
test.describe('Midasoft crea requisicion personal', () => {
  // Omite Firefox y WebKit porque este flujo usa una cuenta real y se estabilizo para Chromium.
  test.skip(({ browserName }) => browserName !== 'chromium', 'Este flujo usa una cuenta real y se valida solo en Chromium.');

  // Inicia el caso abriendo el formulario y llenando los campos iniciales fijos solicitados.
  test('usuario diligencia datos iniciales de una requisicion de personal con cargo fijo', async ({ page }) => {
    // Aumenta el tiempo maximo porque el flujo usa login, navegacion real y guardado en Midasoft.
    test.setTimeout(600_000);

    // Obtiene usuario y contrasena desde variables de entorno.
    const credentials = getMidasoftCredentials();
    // Crea el documento de evidencias que se guardara en output/evidencias.
    const evidence = new EvidenceReport(test.info(), {
      caseId: 'MIDASOFT-CREA-REQUISICION-PERSONAL',
      description:
        'Validar que el usuario pueda crear una requisicion de personal usando el contrato y cargo fijos solicitados.',
      analyst: process.env.EVIDENCE_ANALYST ?? 'Andres Giovanni Martinez Merchan',
      expectedResult:
        'El sistema debe permitir diligenciar la requisicion, agregarla correctamente y regresar a la bandeja de Requisicion de Personal.',
      query: `Contrato: ${contratoTrabajoRequisicion}. Cargo que requiere: ${cargoQueRequiereRequisicion}.`
    });
    // Guarda aqui cualquier error para incluirlo en el documento final antes de fallar la prueba.
    let executionError: unknown;

    try {
      // Primer paso BDD: preparar el estado inicial con la pantalla de login.
    await test.step('Given el usuario abre la pagina de login', async () => {
      // Abre y valida que el formulario de login este disponible.
      await openMidasoftLogin(page);

      // Captura evidencia de la pantalla inicial de login.
      await evidence.capture(page, {
        title: 'Pagina de login cargada',
        description: 'Se abre la URL de login de Midasoft y se valida que el formulario este disponible.',
        expected: 'La pantalla debe permitir iniciar sesion con usuario y contrasena.',
        actual: 'La pagina de login cargo correctamente.'
      });
    });

    // Segundo paso BDD: ingresar al sistema.
    await test.step('When inicia sesion en Midasoft', async () => {
      // Diligencia usuario y contrasena, presiona Ingresar y espera el resultado del login.
      await submitMidasoftLogin(page, credentials);

      // Captura evidencia del ingreso exitoso a Midasoft.
      await evidence.capture(page, {
        title: 'Login completado',
        description: 'Se diligencian las credenciales validas y se confirma el ingreso al sistema.',
        expected: 'El sistema debe salir de la pantalla de login y cargar la sesion del usuario.',
        actual: 'El usuario ingreso correctamente a Midasoft.'
      });
    });

    // Tercer paso BDD: entrar una sola vez a Requisicion de Personal reutilizando el helper existente.
    await test.step('And abre la pantalla de Requisicion de Personal', async () => {
      // Crea el flujo reutilizable para navegar desde la sesion actual.
      const requisicionFlow = new MidasoftRequisicionPersonalFlow(page);
      // Abre Gestion de Seleccion, Transacciones y Requisicion de Personal sin repetir el login.
      await requisicionFlow.openRequisicionPersonalFromCurrentSession();

      // Captura evidencia de la pantalla de Requisicion de Personal.
      await evidence.capture(page, {
        title: 'Pantalla Requisicion de Personal',
        description: 'Se navega desde la sesion actual hasta Gestion de Seleccion, Transacciones y Requisicion de Personal.',
        expected: 'La pantalla de Requisicion de Personal debe quedar disponible para crear un nuevo registro.',
        actual: 'La pantalla de Requisicion de Personal se abrio correctamente.'
      });
    });

    // Cuarto paso BDD: seleccionar el icono + para mostrar el formulario de creacion.
    await test.step('Then selecciona el icono + y visualiza el formulario', async () => {
      // Hace clic en el boton superior de nueva requisicion desde el helper especifico de creacion.
      await openNewRequisicionForm(page);

      // Captura evidencia del formulario de nueva requisicion.
      await evidence.capture(page, {
        title: 'Formulario de nueva requisicion',
        description: 'Se selecciona el icono + para abrir el formulario de creacion de requisicion.',
        expected: 'El sistema debe mostrar el formulario para diligenciar una nueva requisicion de personal.',
        actual: 'El formulario de nueva requisicion quedo visible.'
      });
    });

    // Quinto paso BDD: llenar los campos iniciales solicitados en el formulario.
    await test.step('And diligencia el formulario con contrato y cargo fijos', async () => {
      // Llena Contrato de trabajo, Cargo, Motivo, Reemplazar a, Nro.vacantes y Estado.
      const formData = await fillNewRequisicionForm(page, {
        contratoTrabajo: contratoTrabajoRequisicion,
        cargoQueRequiere: cargoQueRequiereRequisicion,
        reemplazarACodigo: '00202621',
        nroVacantes: '1',
        estado: 'Abierta'
      });

      // Valida que el helper haya usado el contrato solicitado.
      expect(formData.contratoTrabajo).toBe(contratoTrabajoRequisicion);
      // Valida que el helper haya usado el cargo solicitado.
      expect(formData.cargoQueRequiere).toBe(cargoQueRequiereRequisicion);
      // Valida que el motivo configurado sea Ascenso.
      expect(formData.motivo).toBe('Ascenso');
      // Valida que el codigo de reemplazo sea el solicitado para este caso.
      expect(formData.reemplazarACodigo).toBe('00202621');
      // Valida que el numero de vacantes sea el solicitado.
      expect(formData.nroVacantes).toBe('1');
      // Valida que el estado seleccionado sea Abierta.
      expect(formData.estado).toBe('Abierta');
      // Valida que Midasoft haya cargado automaticamente Funciones y observaciones.
      expect(formData.funcionesYObservaciones).not.toHaveLength(0);
      // Valida que Midasoft haya cargado automaticamente un salario con al menos un digito.
      expect(formData.salario).toMatch(/\d/);
      // Valida que el apartado Estructura administrativa se muestre, aunque no todos sus campos tengan valor.
      expect(formData.estructuraAdministrativaVisible).toBe(true);

      // Captura evidencia del formulario diligenciado.
      await evidence.capture(page, {
        title: 'Formulario diligenciado',
        description: `Se diligencia el formulario usando contrato "${contratoTrabajoRequisicion}", cargo "${cargoQueRequiereRequisicion}", reemplazo 00202621, una vacante y estado Abierta.`,
        expected: 'El formulario debe quedar diligenciado y los campos automaticos principales deben cargar correctamente.',
        actual: `El formulario quedo diligenciado con salario "${formData.salario}" y funciones/observaciones cargadas.`
      });
    });

    // Sexto paso BDD: guardar la requisicion y exigir regreso a la bandeja.
    await test.step('Then agrega la requisicion y vuelve a la bandeja', async () => {
      // Controla si ya se capturo la evidencia del bloqueo dentro del helper.
      let bloqueoDocumentado = false;
      // Guarda el mensaje de bloqueo o error observado despues de Agregar.
      let mensajeNoCreado = '';

      // Selecciona Agregar y espera si Midasoft crea la requisicion o muestra bloqueo por plazas en cero.
      const addResult = await addNewRequisicionAndReturnToInbox(page, {
        // Captura la alerta visual antes de cerrarla cuando Midasoft bloquea por plazas en cero.
        onBlocked: async (message) => {
          bloqueoDocumentado = true;
          mensajeNoCreado = message;
          await evidence.capture(page, {
            title: 'Bloqueo por plazas',
            description: `Se selecciona Agregar usando el cargo "${cargoQueRequiereRequisicion}", pero Midasoft no permite crear la requisicion.`,
            expected: 'El sistema debe guardar la requisicion y volver a la bandeja.',
            actual: message
          });
        }
      });

      // Si no se creo, deja evidencia posterior cuando el bloqueo no haya sido capturado antes.
      if (!addResult.created && !bloqueoDocumentado) {
        mensajeNoCreado = addResult.blockingMessage ?? 'Midasoft no creo la requisicion ni regreso a la bandeja.';

        await evidence.capture(page, {
          title: 'Requisicion no creada',
          description: `Se selecciona Agregar usando el cargo "${cargoQueRequiereRequisicion}", pero el sistema no confirmo la creacion.`,
          expected: 'La requisicion debe guardarse correctamente y volver al listado de Requisicion de Personal.',
          actual: mensajeNoCreado
        });
      }

      // El caso solo es exitoso si Midasoft creo la requisicion y regreso a la bandeja.
      expect(addResult.created, `No se pudo crear la requisicion. Mensaje: ${mensajeNoCreado}`).toBe(true);
      expect(addResult.returnedToInbox).toBe(true);

      // Captura evidencia del regreso exitoso a la bandeja.
      await evidence.capture(page, {
        title: 'Requisicion creada',
        description: `Se selecciona Agregar usando el cargo "${cargoQueRequiereRequisicion}" y el sistema retorna a la bandeja.`,
        expected: 'La requisicion debe guardarse correctamente y volver al listado de Requisicion de Personal.',
        actual: 'La requisicion fue creada y la bandeja quedo visible.'
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
