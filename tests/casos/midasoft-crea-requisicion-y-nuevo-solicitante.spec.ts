// Importa las herramientas principales de Playwright Test.
import { expect, test } from '@playwright/test';
// Importa el generador de evidencias que crea el documento Word con pantallazos.
import { EvidenceReport } from '../support/evidence-report';
// Importa credenciales desde variables de entorno.
import { getMidasoftCredentials } from '../support/midasoft-env';
// Importa las piezas reutilizables del login.
import { openMidasoftLogin, submitMidasoftLogin } from '../support/midasoft-login';
// Importa las acciones especificas para crear una requisicion de personal.
import {
  addNewRequisicionAndReturnToInbox,
  fillNewRequisicionForm,
  openNewRequisicionForm
} from '../support/midasoft-crea-requisicion-personal';
// Importa el helper intermedio para crear un nuevo solicitante desde Gestion de Seleccion abierta.
import { MidasoftNuevoSolicitanteFlow } from '../support/midasoft-nuevo-solicitante';
// Importa el flujo reutilizable que navega por Gestion de Seleccion.
import { MidasoftRequisicionPersonalFlow } from '../support/midasoft-requisicion-personal';

// Contrato de trabajo fijo solicitado para el caso de requisicion.
const contratoTrabajoRequisicion = 'TI TERMINO INDEFINIDO AD/PRO/LOG';

// Cargo fijo solicitado para el caso de requisicion.
const cargoQueRequiereRequisicion = '10213031048000_INSTRUCTOR(A)';

// Codigo fijo solicitado para el campo Reemplazar a.
const reemplazarACodigo = '00202621';

// Agrupa el flujo encadenado de requisicion y solicitante.
test.describe('Midasoft crea requisicion personal y nuevo solicitante', () => {
  // Omite Firefox y WebKit porque este flujo usa una cuenta real y se valida solo en Chromium.
  test.skip(({ browserName }) => browserName !== 'chromium', 'Este flujo usa una cuenta real y se valida solo en Chromium.');

  test('usuario crea una requisicion de personal y luego registra un nuevo solicitante', async ({ page }) => {
    // Aumenta el tiempo maximo porque el flujo usa login, navegacion real, guardado y envio de correo.
    test.setTimeout(900_000);

    // Obtiene usuario y contrasena desde variables de entorno.
    const credentials = getMidasoftCredentials();
    // Crea el documento de evidencias que se guardara en output/evidencias.
    const evidence = new EvidenceReport(test.info(), {
      caseId: 'MIDASOFT-CREA-REQUISICION-Y-NUEVO-SOLICITANTE',
      description: 'Validar que el usuario pueda crear una requisicion de personal y despues registrar un nuevo solicitante.',
      analyst: process.env.EVIDENCE_ANALYST ?? 'Andres Giovanni Martinez Merchan',
      expectedResult:
        'El sistema debe crear la requisicion, regresar al listado y confirmar la creacion del solicitante con el envio de correo.',
      query: `Contrato: ${contratoTrabajoRequisicion}. Cargo: ${cargoQueRequiereRequisicion}. Reemplazar a: ${reemplazarACodigo}.`
    });
    // Guarda aqui cualquier error para incluirlo en el documento final antes de fallar la prueba.
    let executionError: unknown;

    try {
      await test.step('Given el usuario inicia sesion en Midasoft', async () => {
        // Abre y valida la pantalla de login.
        await openMidasoftLogin(page);
        // Diligencia credenciales y espera el ingreso al sistema.
        await submitMidasoftLogin(page, credentials);

        // Captura evidencia del login exitoso.
        await evidence.capture(page, {
          title: 'Login completado',
          description: 'Se ingresa a Midasoft con credenciales validas cargadas desde el entorno local.',
          expected: 'El sistema debe cargar la sesion del usuario.',
          actual: 'La sesion del usuario quedo activa.'
        });
      });

      const requisicionFlow = new MidasoftRequisicionPersonalFlow(page);

      await test.step('When abre Requisicion de Personal desde Gestion de Seleccion', async () => {
        // Navega desde la sesion actual hasta Gestion de Seleccion > Transacciones > Requisicion de Personal.
        await requisicionFlow.openRequisicionPersonalFromCurrentSession();

        // Captura evidencia de la pantalla de Requisicion de Personal.
        await evidence.capture(page, {
          title: 'Pantalla Requisicion de Personal',
          description: 'Se abre la pantalla donde se crea la requisicion de personal.',
          expected: 'La opcion de crear requisicion debe estar disponible.',
          actual: 'La pantalla de Requisicion de Personal quedo visible.'
        });
      });

      await test.step('And crea una requisicion de personal con datos fijos', async () => {
        // Abre el formulario con el icono +.
        await openNewRequisicionForm(page);
        // Llena los campos requeridos del formulario.
        const formData = await fillNewRequisicionForm(page, {
          contratoTrabajo: contratoTrabajoRequisicion,
          cargoQueRequiere: cargoQueRequiereRequisicion,
          reemplazarACodigo,
          nroVacantes: '1',
          estado: 'Abierta'
        });

        // Valida los datos principales antes de guardar.
        expect(formData.contratoTrabajo).toBe(contratoTrabajoRequisicion);
        expect(formData.cargoQueRequiere).toBe(cargoQueRequiereRequisicion);
        expect(formData.reemplazarACodigo).toBe(reemplazarACodigo);
        expect(formData.nroVacantes).toBe('1');
        expect(formData.estado).toBe('Abierta');
        expect(formData.funcionesYObservaciones).not.toHaveLength(0);
        expect(formData.salario).toMatch(/\d/);
        expect(formData.estructuraAdministrativaVisible).toBe(true);

        // Captura evidencia del formulario antes de guardar.
        await evidence.capture(page, {
          title: 'Formulario de requisicion diligenciado',
          description: 'Se diligencian contrato, cargo, motivo, persona a reemplazar, vacantes y estado.',
          expected: 'Los campos requeridos y automaticos deben quedar diligenciados antes de agregar.',
          actual: `Formulario listo con salario "${formData.salario}" y una vacante.`
        });

        // Guarda la requisicion y exige que el sistema regrese al listado.
        const addResult = await addNewRequisicionAndReturnToInbox(page, {
          onBlocked: async (message) => {
            await evidence.capture(page, {
              title: 'Bloqueo al crear requisicion',
              description: 'Midasoft no permitio guardar la requisicion.',
              expected: 'La requisicion debe guardarse y volver al listado.',
              actual: message
            });
          }
        });

        expect(addResult.created, `No se pudo crear la requisicion. Mensaje: ${addResult.blockingMessage ?? 'sin mensaje'}`).toBe(true);
        expect(addResult.returnedToInbox).toBe(true);

        // Captura evidencia del regreso al listado de requisiciones.
        await evidence.capture(page, {
          title: 'Requisicion creada',
          description: 'Despues de seleccionar Agregar, Midasoft regresa a la bandeja de Requisicion de Personal.',
          expected: 'La requisicion debe quedar creada y el listado debe estar disponible.',
          actual: 'La requisicion fue creada y se regreso a la bandeja.'
        });
      });

      await test.step('And vuelve a Gestion de Seleccion para usar el helper de nuevo solicitante', async () => {
        // El helper de nuevo solicitante inicia desde Gestion de Seleccion ya abierta por un flujo anterior.
        await requisicionFlow.openGestionSeleccion();

        // Captura evidencia del contrato de entrada del helper intermedio.
        await evidence.capture(page, {
          title: 'Gestion de Seleccion abierta',
          description: 'Se vuelve al modulo Gestion de Seleccion para continuar con Registro de Solicitantes Nuevo.',
          expected: 'Gestion de Seleccion debe quedar visible antes de iniciar el helper de solicitante.',
          actual: 'Gestion de Seleccion quedo abierta.'
        });
      });

      await test.step('Then registra un nuevo solicitante', async () => {
        // Crea el helper intermedio desde la sesion actual.
        const solicitanteFlow = new MidasoftNuevoSolicitanteFlow(page);
        // Abre Registro de Solicitantes Nuevo partiendo de Gestion de Seleccion abierta.
        await solicitanteFlow.openRegistroSolicitanteNuevoFromGestionSeleccionOpen();
        // Abre el formulario, genera datos ficticios, los diligencia y confirma el envio de correo.
        const solicitanteResult = await solicitanteFlow.createNuevoSolicitante();

        // Valida el resultado observable del sistema.
        expect(solicitanteResult.creation.created).toBe(true);
        expect(solicitanteResult.creation.emailMessage).toMatch(/correo|email/i);
        expect(solicitanteResult.formData.correoElectronico).toMatch(/@na\.com$/i);

        // Captura evidencia del solicitante creado.
        await evidence.capture(page, {
          title: 'Solicitante creado',
          description: 'Se crea un solicitante con datos ficticios y correo con dominio @na.com.',
          expected: 'Midasoft debe mostrar la confirmacion de envio de correo y volver al listado de solicitantes.',
          actual: `Mensaje observado: ${solicitanteResult.creation.emailMessage}. Correo usado: ${solicitanteResult.formData.correoElectronico}.`
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
