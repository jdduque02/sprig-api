# Tax Summary Calculation Service

## Propósito

Genera un resumen fiscal (`tax_summary`) a partir de datos operativos registrados por el usuario (transacciones, cuentas, activos, pasivos). Valida qué información está disponible y genera advertencias sobre datos faltantes.

## Flujo de Cálculo

```
POST /api/v1/users/{userId}/intelligence/tax-summary/calculate?year=2026&uvt=42680
                ↓
        TaxSummaryCalculatorService.calculateAndPersist()
                ↓
    ┌───────────────────────────────────────────────┐
    │ 1. VALIDAR (no debe existir para ese año)     │
    │    - Si existe → ConflictException             │
    └───────────────────────────────────────────────┘
                ↓
    ┌───────────────────────────────────────────────┐
    │ 2. RESOLVER DATOS OPERATIVOS EN PARALELO      │
    ├─────────────────────────────────────────────┬─┤
    │ A. Income (TransactionRecordService)        │ │
    │    - Suma INCOME type en [1/1, 12/31]       │ │
    │    - Retorna: total + details                │ │
    ├─────────────────────────────────────────────┤ │
    │ B. Assets (BankAccountService +              │ │
    │    FinancialAssetService)                    │ │
    │    - Suma display_balance +                  │ │
    │      current_value                           │ │
    │    - Retorna: total + details                │ │
    ├─────────────────────────────────────────────┤ │
    │ C. Liabilities (FinancialLiabilityService)   │ │
    │    - Suma current_balance                    │ │
    │    - Retorna: total + details                │ │
    └─────────────────────────────────────────────┴─┘
                ↓
    ┌───────────────────────────────────────────────┐
    │ 3. VALIDAR DATOS Y DETECTAR FALTANTES         │
    │    - income = 0 → WARNING                     │
    │    - assets = 0 → WARNING                     │
    │    - Genera: is_valid, warnings, missing_data│
    └───────────────────────────────────────────────┘
                ↓
    ┌───────────────────────────────────────────────┐
    │ 4. CALCULAR VALORES PRINCIPALES               │
    │    - total_income                             │
    │    - total_assets                             │
    │    - total_liabilities                        │
    │    - patrimony (STORED: assets - liabilities) │
    │    - income_in_uvt (STORED: income / uvt)    │
    │    - assets_in_uvt (STORED: assets / uvt)    │
    └───────────────────────────────────────────────┘
                ↓
    ┌───────────────────────────────────────────────┐
    │ 5. DETERMINAR OBLIGACIÓN DE DECLARAR (DIAN)   │
    │    - income_in_uvt >= 1400 UVT → must_declare│
    │    - assets_in_uvt >= 4750 UVT → must_declare│
    │    - Si alguna condición es true → true      │
    └───────────────────────────────────────────────┘
                ↓
    ┌───────────────────────────────────────────────┐
    │ 6. PERSISTIR EN BD                            │
    │    - Crea registro en tax_summary             │
    │    - Almacena en calculation_notes la         │
    │      validación y detalles                    │
    └───────────────────────────────────────────────┘
                ↓
         HTTP 201 CREATED
      (TaxSummaryCalculationResponseDto)
```

## Estructura de Datos

### Entrada (Query Parameters)

```typescript
{
  year?: number        // Año fiscal (default: año actual)
  uvt?: number         // Valor UVT (default: 42680 para 2026)
}
```

### Salida (201 Created)

```json
{
  "id": 1,
  "user_id": 10,
  "fiscal_year": 2026,
  "total_income": 72000000,           // COP
  "total_assets": 200000000,          // COP
  "total_liabilities": 50000000,      // COP
  "patrimony": 150000000,             // GENERADO: assets - liabilities
  "income_in_uvt": 1686.92,           // GENERADO: income / uvt
  "assets_in_uvt": 4684.05,           // GENERADO: assets / uvt
  "uvt_value": 42680,                 // UVT del año
  "must_declare": true,               // Criterio DIAN
  "created_at": "2026-09-11T20:30:00Z",
  
  "validation": {
    "is_valid": true,                 // Todos datos requeridos disponibles
    "warnings": [],                   // Advertencias sobre calidad de datos
    "missing_data": [],               // Datos que podrían mejorar precisión
    "notes": {}                       // Detalles de validación
  },
  
  "calculation_details": {
    "calculated_at": "2026-09-11T20:30:00Z",
    "income_sources": {
      "count": 42,
      "byMonth": { /* desglose por mes */ }
    },
    "assets_breakdown": {
      "bank_accounts": {
        "count": 2,
        "total": 75000000
      },
      "financial_assets": {
        "count": 2,
        "total": 125000000
      }
    },
    "liabilities_breakdown": {
      "count": 2,
      "total": 50000000
    }
  }
}
```

## Validaciones Implementadas

| Tipo | Condición | Acción |
|------|-----------|--------|
| **Income** | total_income = 0 | WARNING: "No se encontraron transacciones de ingreso" |
| **Assets** | total_assets = 0 | WARNING: "No hay activos registrados" |
| **UVT** | uvt_value = 0 | MISSING: "Valor UVT del año fiscal" |
| **Must Declare** | income_in_uvt ≥ 1400 | true (criterio DIAN) |
| **Must Declare** | assets_in_uvt ≥ 4750 | true (criterio DIAN) |
| **Duplicado** | Ya existe para ese año | 409 ConflictException |

## Umbrales DIAN (Colombia 2026)

```typescript
const UVT_2026 = 42680
const DECLARATION_INCOME_THRESHOLD = 1400 * UVT_2026 = 59,652,000 COP
const DECLARATION_ASSETS_THRESHOLD = 4750 * UVT_2026 = 202,730,000 COP
```

> **Nota:** Ajustar anualmente en `tax-summary-calculator.service.ts` con el valor UVT publicado por DIAN.

## Casos de Uso

### 1. Usuario con datos completos

```
Total Income:    72,000,000 COP
Total Assets:   200,000,000 COP
Total Liabilities: 50,000,000 COP
Patrimony:      150,000,000 COP

Income in UVT:    1,686.92 (> 1400) → must_declare = TRUE
Assets in UVT:    4,684.05 (< 4750) → but income already triggers
```

**Resultado:** Resumen válido, usuario DEBE declarar impuestos.

### 2. Usuario sin activos registrados

```
Total Income:    50,000,000 COP
Total Assets:            0 COP ← FALTA
Total Liabilities:       0 COP

Validation:
  - is_valid: false
  - warnings: ["No hay activos registrados"]
  - missing_data: ["Desglose de activos"]
```

**Resultado:** Resumen creado con datos parciales. Usuario debe registrar activos para precisión.

### 3. Usuario sin ingresos registrados

```
Total Income:            0 COP ← FALTA
Total Assets:   50,000,000 COP
Total Liabilities: 10,000,000 COP

Validation:
  - warnings: ["No se encontraron transacciones de ingreso"]
  - must_declare: FALSE (income = 0 < 1400 UVT)
```

**Resultado:** Patrimonio calculado, pero obligación de declarar no aplica sin ingresos.

## Errores Posibles

| Código | Mensaje | Causa |
|--------|---------|-------|
| 201 | OK | Cálculo exitoso |
| 409 | TAX_SUMMARY_ALREADY_EXISTS | Ya existe para ese año |
| 404 | FINANCIAL_PROFILE_REQUIRED | Usuario sin perfil financiero (futuro) |
| 500 | Error interno | Falla al obtener datos operativos |

## Integración con Otros Servicios

### TransactionRecordService
- Método: `getSummary(userId, { date_from, date_to, type: 'INCOME' })`
- Retorna: `TransactionSummaryResponseDto` con totales y desglose
- Filtro: `created_at BETWEEN date_from AND date_to AND type = 'INCOME'`

### BankAccountService
- Método: `findAll(userId)`
- Retorna: Array de cuentas con `display_balance`

### FinancialAssetService
- Método: `findAll(userId)`
- Retorna: Array de activos con `current_value`

### FinancialLiabilityService
- Método: `findAll(userId)`
- Retorna: Array de pasivos con `current_balance`

## Archivos Relacionados

- `TaxSummaryCalculatorService`: Lógica de cálculo
- `TaxSummary` (Entity): Modelo persistente
- `TaxSummaryResponseDto`: DTO de respuesta básica
- `TaxSummaryCalculationResponseDto`: DTO con validación
- `TaxSummaryCalculatorService.spec.ts`: Tests unitarios

## Edición Manual (PUT)

```
PUT /api/v1/users/{userId}/intelligence/tax-summary/{id}
                ↓
        TaxSummaryCalculatorService.update()
                ↓
    ┌───────────────────────────────────────────────┐
    │ 1. BUSCAR (debe existir para ese id + userId) │
    │    - Si no existe → NotFoundException          │
    └───────────────────────────────────────────────┘
                ↓
    ┌───────────────────────────────────────────────┐
    │ 2. APLICAR CAMPOS PROVISTOS                   │
    │    total_income, total_assets,                │
    │    total_liabilities, uvt_value,               │
    │    estimated_tax                                │
    └───────────────────────────────────────────────┘
                ↓
    ┌───────────────────────────────────────────────┐
    │ 3. RECALCULAR must_declare (umbrales DIAN)    │
    │    - Usa los valores resultantes (nuevos o     │
    │      existentes) salvo que el DTO envíe        │
    │      must_declare explícitamente (override)    │
    └───────────────────────────────────────────────┘
                ↓
    ┌───────────────────────────────────────────────┐
    │ 4. PERSISTIR                                   │
    │    - patrimony, income_in_uvt, assets_in_uvt   │
    │      se recalculan en BD (GENERATED STORED)    │
    └───────────────────────────────────────────────┘
                ↓
         HTTP 200 OK
      (TaxSummaryResponseDto)
```

`fiscal_year` y `user_id` no son editables por este endpoint (identidad del registro).

## Próximas Mejoras

- [ ] Endpoint GET para listar tax summaries por usuario (histórico)
- [ ] Cálculo automático de `estimated_tax` según régimen tributario
- [ ] Sincronización con UVT actualizado (importar de DIAN)
- [ ] Historial de cambios en `calculation_notes`
