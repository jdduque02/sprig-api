/**
 * `ResponseInterceptor` (src/shared/interceptors/response.interceptor.ts)
 * envuelve TODA respuesta no paginada en `data: T[]`, incluso cuando el
 * controller devuelve un único objeto (`Array.isArray(data) ? data : [data]`).
 * Los endpoints de "recurso único" (create/findOne/update/etc.) llegan como
 * `data: [recurso]`; los de listado ya son `data: recurso[]` de por sí.
 * `unwrapOne` normaliza el primer caso para los e2e.
 */
export function unwrapOne<T>(body: { data: T | T[] }): T {
  return Array.isArray(body.data) ? body.data[0] : body.data;
}
