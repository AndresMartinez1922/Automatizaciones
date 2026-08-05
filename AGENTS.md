# AGENTS.md

## Project Overview

Este es un proyecto de pruebas end-to-end con Playwright usando Bun como gestor de paquetes.

## Commands

- Instalar dependencias: `bun install`
- Instalar navegadores de Playwright: `bun run install:browsers`
- Ejecutar pruebas: `bun run test`
- Ejecutar solo el flujo Midasoft: `bun run test:midasoft`
- Ejecutar solo login Midasoft: `bun run test:midasoft:login`
- Ejecutar solo acceso a consultas admin: `bun run test:midasoft:admin`
- Ejecutar login + consultas admin en un solo caso: `bun run test:midasoft:base`
- Ejecutar login + consultas admin y abrir reporte HTML: `bun run test:midasoft:base:report`
- Ejecutar inicio del caso crea requisicion personal: `bun run test:midasoft:crea-requisicion`
- Ejecutar flujo completo Midasoft con query y evidencias: `bun run test:midasoft:full`
- Ejecutar pruebas con navegador visible: `bun run test:headed`
- Abrir Playwright UI mode: `bun run test:ui`
- Ver reporte HTML: `bun run report`

## Conventions

- Mantener las pruebas dentro de `tests/`.
- Guardar los casos de prueba armados dentro de `tests/casos/` para diferenciarlos de helpers y soporte.
- Usar fixtures y assertions de `@playwright/test`.
- Preferir locators estables como `getByRole`, `getByLabel` y `getByTestId`.
- Evitar esperas fijas salvo que no exista un evento, assertion o locator confiable.
- Mantener fuera de git los artefactos generados: `node_modules/`, `test-results/`, `playwright-report/` y `blob-report/`.
- No guardar secretos, credenciales, tokens ni datos sensibles en tests, reportes, screenshots o trazas.

## Buenas Practicas Playwright

- Escribir pruebas desde el comportamiento del usuario, no desde detalles internos de HTML, CSS o implementacion.
- Preferir assertions autoesperadas de Playwright como `toBeVisible`, `toHaveText`, `toHaveURL` y `toHaveCount`.
- No usar `page.waitForTimeout()` salvo como ultimo recurso documentado.
- Mantener cada test independiente: debe poder ejecutarse solo, en paralelo y en cualquier orden.
- Crear datos de prueba desde fixtures, APIs o helpers dedicados; evitar depender de datos manuales compartidos.
- Limpiar o aislar datos creados por la prueba cuando puedan afectar otros escenarios.
- Usar `test.step()` para narrar acciones importantes y facilitar trazas, reportes y debugging.
- Mantener screenshots, videos y traces como evidencia de diagnostico, no como mecanismo principal de validacion.
- Para flujos que requieran soporte documental, usar `tests/support/evidence-report.ts` para generar el DOCX de evidencias con pantallazos por paso al finalizar.
- Evitar selectores fragiles como clases CSS generadas, rutas DOM largas o textos demasiado volatiles.
- Si un flujo se repite en varios tests, extraerlo a un helper, fixture o Page Object con responsabilidad clara.
- Reutilizar las partes de Midasoft desde `tests/support/midasoft-login.ts`, `tests/support/midasoft-consultas-admin.ts` y `tests/support/midasoft-requisicion-personal.ts` antes de duplicar pasos en un spec nuevo.

## Principios SOLID Aplicados a Tests

- Single Responsibility: cada test valida un comportamiento principal; cada helper, fixture o Page Object tiene una razon clara para cambiar.
- Open/Closed: agregar nuevos escenarios extendiendo fixtures, builders o helpers existentes sin reescribir tests estables.
- Liskov Substitution: los Page Objects y helpers deben tener contratos consistentes; una implementacion especializada no debe romper expectations existentes.
- Interface Segregation: exponer metodos pequenos y especificos como `loginAsAdmin()` o `createInvoice()`, no objetos enormes con acciones no relacionadas.
- Dependency Inversion: los tests deben depender de abstracciones del dominio, fixtures y datos configurables, no de valores hardcodeados o detalles de infraestructura.

## BDD y Legibilidad

- Nombrar tests con formato orientado a comportamiento: `test('usuario puede completar el checkout con tarjeta valida', ...)`.
- Organizar escenarios con una estructura clara tipo Given/When/Then usando comentarios breves o `test.step()`.
- Priorizar lenguaje de negocio en nombres de tests, fixtures y helpers.
- Validar resultados observables para el usuario o para el sistema, no detalles accidentales de implementacion.
- Mantener un escenario por intencion. Si el test necesita muchas ramas, dividirlo en casos mas pequenos.
- Para flujos criticos, cubrir camino feliz, errores esperados y permisos/roles relevantes.

## Estrategia de Bajo Coste de Mantenimiento

- Crear Page Objects solo cuando reduzcan duplicacion real o encapsulen una pantalla/componente estable.
- Evitar Page Objects genericos que mezclen demasiadas responsabilidades.
- Centralizar usuarios, rutas, credenciales falsas, factories y datos repetidos en fixtures o archivos de soporte.
- Centralizar rutas y variables de Midasoft en `tests/support/midasoft-env.ts`.
- Para crear un caso nuevo que requiera sesion iniciada, usar `loginToMidasoft()` en lugar de copiar los pasos del login.
- Para crear un caso nuevo dentro de consultas admin despues de una sesion ya iniciada, usar `accessConsultasAdminFromCurrentSession()` y luego agregar solo las acciones especificas del nuevo caso.
- `enterConsultasAdmin()` queda como alias de compatibilidad, pero los casos nuevos deben preferir `accessConsultasAdminFromCurrentSession()` para dejar claro que no ejecuta login.
- Para leer datos de una tabla de Consultas Admin, reutilizar `getFirstResultValueByColumn()` antes de crear selectores nuevos para columnas.
- Para crear un caso nuevo de Requisicion de Personal despues de una sesion ya iniciada, usar `MidasoftRequisicionPersonalFlow` y sus metodos `openGestionSeleccion()`, `expectTransaccionesVisible()` y `openRequisicionPersonal()`.
- Cargar credenciales reales desde variables de entorno o `.env` local ignorado por git; nunca escribirlas en el test ni en `AGENTS.md`.
- Preferir setup por API cuando sea mas rapido y estable que preparar estado navegando por la UI.
- Mantener los tests cortos: preparar estado, ejecutar accion principal y verificar resultado.
- Revisar tests flaky de inmediato; no aumentar timeouts globales sin entender la causa.
- Usar tags o proyectos para separar smoke, regresion, navegadores y pruebas largas.
- Ejecutar localmente el subconjunto afectado antes de correr toda la suite cuando el cambio sea pequeno.
- Conservar trazas en fallos para diagnostico, pero evitar versionar artefactos generados.
- Actualizar dependencias de Playwright de forma controlada y ejecutar la suite despues de cada actualizacion.
- Cuando un selector cambie con frecuencia, coordinar con la app para agregar roles, labels o `data-testid` estables.
- Documentar convenciones nuevas en este archivo cuando se repitan en mas de un test.

## Skills Disponibles

Usar estas skills cuando ayuden directamente a la tarea:

- `playwright`: para crear, mantener, explicar o depurar pruebas Playwright.
- `playwright-interactive`: para explorar flujos en navegador, construir pasos de prueba o diagnosticar interacciones complejas.
- `screenshot`: para capturar evidencia visual, revisar estados de UI o comparar resultados.
- `security-best-practices`: para revisar riesgos de seguridad, manejo de secretos, dependencias, configuraciones y datos sensibles.
- `browser:browser`: para abrir URLs locales, interactuar con la app, inspeccionar comportamiento y validar visualmente desde el navegador integrado de Codex.

## MCPs y Herramientas

- Usar `mcp_servers.playwright` cuando se necesite automatizar navegador con Playwright desde Codex, inspeccionar páginas, generar acciones o apoyar pruebas end-to-end.
- Usar el Browser integrado cuando la validación sea visual, interactiva o dependa de una URL local como `localhost`.
- Usar las herramientas de filesystem y git local para editar archivos, revisar cambios y preparar commits cuando el usuario lo pida.
- Usar automation solo si el usuario pide recordatorios, ejecuciones recurrentes, monitoreo o seguimiento programado.
- No usar GitHub MCP/plugin en este proyecto salvo que el usuario lo pida explícitamente.

## Verification

Antes de considerar los cambios completos, ejecutar:

```bash
bun run test
```

Para validar solo el caso Midasoft y generar el DOCX de evidencias:

```bash
bun run test:midasoft
```

Para validar por partes sin ejecutar todo el flujo:

```bash
bun run test:midasoft:login
bun run test:midasoft:admin
```

Para validar el flujo base encadenado y abrir el reporte HTML al final:

```bash
bun run test:midasoft:base:report
```

Para validar el inicio del caso crea requisicion personal:

```bash
bun run test:midasoft:crea-requisicion
```

Si los cambios afectan UI o flujos de usuario, complementar con una validación visual usando Browser, Playwright MCP o screenshots.
