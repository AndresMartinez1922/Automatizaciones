// Importa assertions de Playwright y los tipos necesarios para paginas e iframes.
import { expect, type Frame, type Page } from '@playwright/test';

// Declara una funcion que busca el iframe donde exista un selector especifico.
export async function findFrameWithSelector(page: Page, selector: string): Promise<Frame> {
  // Guarda aqui el frame encontrado para poder devolverlo al final.
  let selectedFrame: Frame | undefined;

  // Usa expect.poll para reintentar la busqueda hasta que el frame aparezca o se agote el tiempo.
  await expect
    // `poll` ejecuta una funcion varias veces hasta que el resultado cumpla la expectativa.
    .poll(
      // Funcion que Playwright ejecuta repetidamente mientras espera.
      async () => {
        // Recorre todos los frames/iframes que existen actualmente en la pagina.
        for (const frame of page.frames()) {
          // Pregunta si dentro de este frame existe al menos un elemento con el selector buscado.
          if (await frame.locator(selector).count()) {
            // Guarda el frame que contiene el selector.
            selectedFrame = frame;
            // Devuelve true para indicar que la busqueda fue exitosa.
            return true;
          }
        }

        // Devuelve false para que `poll` siga reintentando.
        return false;
      },
      // Define un tiempo maximo de espera de 30 segundos.
      { timeout: 30_000 }
    )
    // Valida que `poll` haya terminado devolviendo true.
    .toBe(true);

  // Proteccion adicional por si, por alguna razon, no quedo guardado el frame.
  if (!selectedFrame) {
    // Lanza un error con el selector que no se pudo encontrar.
    throw new Error(`No frame found with selector: ${selector}`);
  }

  // Devuelve el frame encontrado para interactuar con sus campos internos.
  return selectedFrame;
}
