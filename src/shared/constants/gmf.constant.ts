/**
 * Tarifa del Gravamen a los Movimientos Financieros (GMF / "4x1000") en
 * Colombia. Tarifa fija de 4 por cada 1000 = 0.4%, definida en los arts.
 * 871 y 872 del Estatuto Tributario Nacional (Decreto 624 de 1989, con las
 * modificaciones vigentes). A diferencia de los umbrales DIAN/UVT, esta
 * tarifa NO depende del valor de la UVT ni del año fiscal: es un porcentaje
 * fijo sobre el valor de cada transacción financiera gravada.
 *
 * Se aplica sobre retiros/débitos realizados desde cuentas bancarias que no
 * estén marcadas como exentas (`BankAccount.exempt_4x1000 = false`).
 */
export const GMF_RATE = 0.004;
