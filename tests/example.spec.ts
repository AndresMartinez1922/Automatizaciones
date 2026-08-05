// Importa `test` para crear pruebas y `expect` para validar resultados.
import { expect, test } from '@playwright/test';

// Define una prueba con un nombre legible que aparecera en el reporte.
test('loads Playwright homepage', async ({ page }) => {
  // Carga HTML directamente en la pagina; esto evita depender de internet para esta prueba de ejemplo.
  await page.setContent(`
    <!-- Declara que este documento usa HTML5. -->
    <!doctype html>
    <!-- Abre el documento HTML y declara que el idioma principal es ingles. -->
    <html lang="en">
      <!-- Abre la seccion de metadatos del documento. -->
      <head>
        <!-- Define el titulo que el navegador muestra en la pestana. -->
        <title>Playwright ready</title>
      <!-- Cierra la seccion de metadatos. -->
      </head>
      <!-- Abre el contenido visible de la pagina. -->
      <body>
        <!-- Marca el contenido principal de la pagina. -->
        <main>
          <!-- Muestra un encabezado principal que Playwright podra buscar por rol. -->
          <h1>Playwright is ready</h1>
        <!-- Cierra el contenido principal. -->
        </main>
      <!-- Cierra el contenido visible. -->
      </body>
    <!-- Cierra el documento HTML. -->
    </html>
  `);

  // Valida que el titulo real de la pagina sea exactamente el esperado.
  await expect(page).toHaveTitle('Playwright ready');
  // Busca un encabezado accesible por rol y nombre, y valida que sea visible.
  await expect(page.getByRole('heading', { name: 'Playwright is ready' })).toBeVisible();
});
