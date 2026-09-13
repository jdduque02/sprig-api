/**
 * `@react-email/render` usa un `import()` dinámico interno (react-dom/server)
 * que revienta bajo Jest/CJS sin --experimental-vm-modules. `MailService`
 * la invoca en `onApplicationBootstrap` para sembrar la plantilla OTP; los
 * e2e no verifican el HTML del correo, así que se stubea con un string fijo.
 */
module.exports = {
  render: async () => '<html><body>fake-email</body></html>',
};
