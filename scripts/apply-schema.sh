#!/bin/sh
# Aplica schema.sql (dump completo, generado 2026-08-16) y luego cualquier
# migración *.sql posterior a esa fecha, en orden por nombre de archivo.
#
# El repo no tiene un mecanismo de migraciones automatizado real: el
# `migration:run` de TypeORM (src/config/data-source.ts) solo busca
# archivos .js/.ts y por eso siempre reporta "No migrations are pending",
# aunque migrations/*.sql tenga cambios reales pendientes de aplicar.
# Este script es el que realmente deja la base de datos al día.
set -eu

SCHEMA_CUTOFF="20260816"

echo "==> Aplicando schema.sql"
psql -v ON_ERROR_STOP=1 -f /work/schema.sql

for f in /work/migrations/*.sql; do
  name="$(basename "$f")"
  prefix="${name%%-*}"
  if [ "$prefix" \> "$SCHEMA_CUTOFF" ]; then
    echo "==> Aplicando migración $name"
    psql -v ON_ERROR_STOP=1 -f "$f"
  fi
done

echo "==> Esquema al día."
