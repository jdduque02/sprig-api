/**
 * Ejecuta SonarScanner leyendo el token desde:
 *   1. variable de entorno SONAR_TOKEN, o
 *   2. archivo .env.sonar (local, gitignoreado) en la raíz del proyecto.
 * La URL del servidor se lee de SONAR_HOST_URL o del archivo (default localhost:9000).
 */
const fs = require("node:fs");
const path = require("node:path");
const scanner = require("sonarqube-scanner").default;

function loadEnv(file) {
  try {
    const content = fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
    const result = {};
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) result[match[1]] = match[2];
    }
    return result;
  } catch {
    return {};
  }
}

const env = { ...loadEnv(".env.sonar"), ...loadEnv(".env") };
const token = process.env.SONAR_TOKEN || env.SONAR_TOKEN;

if (!token) {
  console.error(
    [
      "No se encontró un token de SonarQube (SONAR_TOKEN).",
      "",
      "1. Genera un token en: http://localhost:9000/account/security",
      "2. Crea el archivo .env.sonar en la raíz del proyecto con:",
      "",
      "   SONAR_TOKEN=<tu-token>",
      "",
      "   (o expórtalo: $env:SONAR_TOKEN = '<tu-token>')",
    ].join("\n"),
  );
  process.exit(1);
}

const serverUrl =
  process.env.SONAR_HOST_URL ||
  env.SONAR_HOST_URL ||
  "http://localhost:9000";

scanner(
  {
    serverUrl,
    token,
  },
  () => {
    process.exit(0);
  },
);
