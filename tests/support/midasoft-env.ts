// Define las URLs y datos configurables que usan las pruebas de Midasoft.
export const midasoftConfig = {
  // Usa la URL configurada por entorno o la URL real de login como valor por defecto.
  loginUrl: process.env.MIDASOFT_LOGIN_URL ?? 'https://opepermoda.midasoft.co/NGMidasoft/login/10',
  // Usa la URL configurada por entorno o la URL real de consultas admin como valor por defecto.
  consultasAdminUrl:
    process.env.MIDASOFT_CONSULTAS_ADMIN_URL ?? 'https://opepermoda.midasoft.co/NGMidasoft/consultas-admin',
  // Usa la query configurada por entorno o la consulta pedida para el flujo actual.
  query: process.env.MIDASOFT_QUERY ?? 'Select top 5 * from EMP'
};

// Define la configuracion base para consumir las APIs integradas de Midasoft.
export const midasoftApiConfig = {
  // Usa la URL configurada por entorno o la ruta publica de integracion como base.
  baseUrl: process.env.MIDASOFT_API_BASE_URL ?? 'https://opepermoda.midasoft.co/apis/integracion/api/v1',
  // Permite inyectar un token directo cuando ya exista una sesion o un token emitido manualmente.
  token: process.env.MIDASOFT_API_TOKEN?.trim() || undefined
};

// Describe los datos necesarios para iniciar sesion en Midasoft.
export type MidasoftCredentials = {
  // Usuario de Midasoft.
  username: string;
  // Contrasena de Midasoft.
  password: string;
};

// Declara una funcion reutilizable para exigir que una variable de entorno exista.
export function requiredEnv(name: string): string {
  // Busca el valor de la variable de entorno usando el nombre recibido.
  const value = process.env[name];

  // Si el valor no existe, detiene la prueba con un mensaje claro.
  if (!value) {
    // Lanza un error para que Playwright marque la prueba como fallida y explique que falta configurar.
    throw new Error(`Missing required environment variable: ${name}`);
  }

  // Devuelve el valor ya validado para que el resto del codigo pueda usarlo.
  return value;
}

// Agrupa las credenciales de login desde variables de entorno.
export function getMidasoftCredentials(): MidasoftCredentials {
  // Devuelve usuario y contrasena sin escribir secretos dentro del codigo fuente.
  return {
    username: requiredEnv('MIDASOFT_USERNAME'),
    password: requiredEnv('MIDASOFT_PASSWORD')
  };
}

// Obtiene la clave administrativa desde variables de entorno.
export function getMidasoftAdminPassword(): string {
  // Reutiliza la validacion comun para fallar rapido si falta configuracion.
  return requiredEnv('MIDASOFT_ADMIN_PASSWORD');
}
