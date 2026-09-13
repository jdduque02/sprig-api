/**
 * `@react-pdf/renderer` es ESM-only y no compila bajo ts-jest/CJS al
 * arrancar el AppModule completo en e2e (ver mismo mock usado en
 * financial-profile-report.service.spec.ts). Los e2e no verifican el
 * contenido binario del PDF, solo que el endpoint responde; se mockea
 * `renderToBuffer` a un Buffer fijo.
 */
module.exports = {
  renderToBuffer: async () => Buffer.from('fake-pdf'),
  Document: 'Document',
  Page: 'Page',
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
};
