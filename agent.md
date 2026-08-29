# Agent Context - Cost Manager Backend

## 1. Propósito del Proyecto
Este proyecto es el backend de una aplicación de gestión de finanzas personales. Está diseñado bajo una arquitectura de **Monolito Modular** utilizando NestJS, asegurando una separación clara de dominios (Bounded Contexts) que actúan internamente casi como microservicios.

## 2. Stack Tecnológico Principal
- **Framework Core**: NestJS v11 (TypeScript)
- **Base de Datos**: PostgreSQL 16 (Particionamiento y esquemas por dominio)
- **ORM**: TypeORM
- **Autenticación**: Keycloak (JWT) + nest-keycloak-connect
- **Caché**: Redis
- **Mensajería**: RabbitMQ (`@nestjs/microservices` + `amqplib`, para comunicación asíncrona entre módulos)
- **Documentación API**: Swagger (`@nestjs/swagger`)
- **Testing**: Jest (Unitario y E2E con Supertest)
- **Calidad de Código**: ESLint, Prettier, SonarQube, Husky/Commitlint
- **DevOps**: Docker, Docker Compose, Jenkins

## 3. Estructura del Proyecto (`src/`)
El proyecto sigue una estructura fuertemente modular:

- `src/main.ts`: Punto de entrada. Configura Swagger, pipes globales de validación, filtros de excepciones, interceptores de respuesta (formato estándar) y versionado de API (`/api/v1`).
- `src/app.module.ts`: Módulo raíz de la aplicación que orquesta el resto de los módulos.
- `src/config/`: Configuraciones centralizadas (Base de datos, Redis, JWT, variables de entorno).
- `src/shared/`: Módulo global (`@Global()`) que expone utilidades técnicas transversales:
  - Base de datos (`base.entity.ts`).
  - Servicios de infraestructura: Redis, colas (BullMQ), auditoría (`audit.service.ts`), criptografía (`crypto.service.ts`).
  - `guards` (roles, JWT), `interceptors` (logging, transform) y `filters` (http-exception).
- `src/modules/`: Módulos de dominio de negocio:
  - `audit`: Registro de acciones (INSERT, UPDATE, DELETE).
  - `auth`: Manejo de integración de autenticación.
  - `banking`: Cuentas bancarias, activos y pasivos. (Usa pgcrypto para datos sensibles).
  - `catalog`: Categorías globales (admin) y subcategorías (usuario).
  - `finance`: Transacciones (particionadas), períodos financieros, objetivos y pagos.
  - `identity`: Usuarios y perfiles financieros (espejo de Keycloak).
  - `intelligence`: Resúmenes financieros, reportes DIAN y desglose analítico.
  - `notification`: Alertas, workers de BullMQ y tareas programadas (cron).

## 4. Reglas de Arquitectura Estrictas (Directrices para el LLM/Agente)
Al escribir o refactorizar código en este proyecto, se DEBEN seguir estrictamente estas reglas:

1. **Aislamiento de Módulos**: NINGÚN módulo debe acceder directamente al repositorio (`Repository<T>`) de otro módulo.
2. **Comunicación Cruzada**: La comunicación síncrona entre módulos debe limitarse y preferir la inyección de servicios. La comunicación asíncrona (eventos) DEBE realizarse a través de **RabbitMQ** (`@nestjs/microservices`).
3. **Módulo Compartido**: `SharedModule` es global. Solo debe contener y exponer infraestructura técnica, **NUNCA lógica de negocio**.
4. **Reglas de Base de Datos**:
   - Se usan **esquemas de PostgreSQL** separados por dominio (`identity`, `catalog`, `finance`, etc.).
   - Particionamiento: Todas las consultas a la tabla particionada `finance.transaction_record` DEBEN incluir `created_at` en la cláusula `WHERE` para habilitar el *partition pruning*.
5. **Seguridad y Privacidad**:
   - NO almacenar contraseñas ni credenciales. La tabla de usuarios solo guarda el `external_id` (sub) de Keycloak.
   - Todo dato bancario sensible en el módulo `banking` debe ser encriptado/desencriptado usando el `CryptoService`.
6. **Borrados**: Se usa borrado lógico (`soft delete` con `deleted_at`) a través de TypeORM para entidades como transacciones. **El borrado físico está estrictamente prohibido**.
7. **Controladores e Interceptores**: Las respuestas son envueltas globalmente por `TransformInterceptor` (`{ data, meta: { timestamp, version } }`). No es necesario darle formato manual a los retornos en el controlador.
8. **Gestión del Tiempo**: La zona horaria del usuario (`timezone` en `app_user`) es crítica para cálculos de cierres de período. Nunca se debe asumir UTC para la lógica de finanzas de usuario.

## 5. Scripts Principales (`package.json`)
Los comandos base usan el gestor de paquetes definido en el proyecto (probablemente `pnpm` según `pnpm-workspace.yaml` y el lockfile):

- **Desarrollo**: `npm run start:dev`
- **Producción**: `npm run build` seguido de `npm run start:prod`
- **Migraciones de Base de Datos**:
  - Generar: `npm run migration:generate`
  - Ejecutar: `npm run migration:run`
  - Revertir: `npm run migration:revert`
- **Calidad y Testing**:
  - Linter: `npm run lint`
  - Formatear: `npm run format`
  - Pruebas Unitarias: `npm run test`
  - Pruebas de Cobertura y Sonar: `npm run test:cov:sonar`
