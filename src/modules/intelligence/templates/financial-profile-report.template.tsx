import * as React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { BRAND_PALETTE } from '@config/brand';
import { UserResponseDto } from '@identity/dto/user/user-response.dto';
import { FinancialProfile } from '@identity/entities/financial-profile.entity';
import { FinancialAiAnalysisResponseDto } from '@intelligence/dto/financial-ai-analysis-response.dto';
import { BankAccountResponseDto } from '@banking/dto/bank-account/bank-account-response.dto';
import { FinancialAsset } from '@banking/entities/financial-asset.entity';
import { FinancialLiability } from '@banking/entities/financial-liability.entity';
import { FinancialObjectiveWithProgress } from '@finance/repositories/financial-objective.repository';
import { TransactionCategorySummaryDto } from '@finance/dto/transaction-record/transaction-summary-response.dto';
import { TransactionRecord } from '@finance/entities/transaction-record.entity';
import { Category } from '@catalog/entities/category.entity';

export interface CategoryYearlyReviewRow {
  category_id: number;
  name: string;
  expenses: number;
  count: number;
  sharePercent: number;
  /** Heurístico: gasto discrecional que concentra una porción alta del año. */
  shouldReview: boolean;
}

export interface FinancialProfileReportProps {
  user: UserResponseDto;
  profile: FinancialProfile;
  analysis: FinancialAiAnalysisResponseDto;
  accounts: BankAccountResponseDto[];
  assets: FinancialAsset[];
  liabilities: FinancialLiability[];
  activeObjectives: FinancialObjectiveWithProgress[];
  byCategory: TransactionCategorySummaryDto[];
  categoryById: Map<number, Category>;
  yearlyCategoryReview: CategoryYearlyReviewRow[];
  /** Ya sin transferencias entre cuentas propias (ver servicio). */
  recentTransactions: TransactionRecord[];
  /** true si el total real de movimientos superó el tope de la consulta. */
  recentTransactionsTruncated: boolean;
  generatedAt: Date;
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: BRAND_PALETTE.neutralDark,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: BRAND_PALETTE.primary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: BRAND_PALETTE.bodyMuted,
    marginBottom: 16,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: BRAND_PALETTE.primary,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: `1px solid ${BRAND_PALETTE.divider}`,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  label: { color: BRAND_PALETTE.bodyMuted },
  value: { fontWeight: 700 },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: BRAND_PALETTE.surfaceGreen,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottom: `1px solid ${BRAND_PALETTE.divider}`,
  },
  cell: { flex: 1 },
  cellHeader: { flex: 1, fontWeight: 700, color: BRAND_PALETTE.primary },
  alertBox: {
    backgroundColor: '#FCEFEF',
    borderLeft: `3px solid ${BRAND_PALETTE.danger}`,
    padding: 8,
    marginBottom: 6,
  },
  alertTitle: { fontWeight: 700, color: BRAND_PALETTE.danger, marginBottom: 2 },
  narrative: { lineHeight: 1.5, color: BRAND_PALETTE.bodyMuted },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 8,
    color: BRAND_PALETTE.footerMuted,
    textAlign: 'center',
    borderTop: `1px solid ${BRAND_PALETTE.divider}`,
    paddingTop: 6,
  },
  emptyText: { color: BRAND_PALETTE.bodyMuted, fontStyle: 'italic' },
});

const cop = (value: number | string | null | undefined): string => {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP`;
};

const pct = (value: number | string | null | undefined): string =>
  value === null || value === undefined ? 'N/D' : `${Number(value)}%`;

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const SEVERITY_LABEL: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

const TYPE_LABEL: Record<string, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  investment: 'Inversión',
  transfer: 'Transferencia',
};

const formatDate = (value: Date | string): string =>
  new Date(value).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export function FinancialProfileReportDocument({
  user,
  profile,
  analysis,
  accounts,
  assets,
  liabilities,
  activeObjectives,
  byCategory,
  categoryById,
  yearlyCategoryReview,
  recentTransactions,
  recentTransactionsTruncated,
  generatedAt,
}: FinancialProfileReportProps) {
  const categoryName = (categoryId: number | null): string =>
    (categoryId != null && categoryById.get(categoryId)?.name) ||
    'Sin categoría';
  const categoriesToReview = yearlyCategoryReview.filter((c) => c.shouldReview);
  return (
    <Document title={`Reporte financiero - ${user.full_name ?? user.username}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Reporte financiero</Text>
        <Text style={styles.subtitle}>
          {(user.full_name ?? user.username) + ' · ' + user.email} · Generado el{' '}
          {generatedAt.toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Perfil financiero</Text>
          <KeyValueRow label="Perfil" value={profile.profile_name} />
          <KeyValueRow
            label="Necesidades / Deseos / Ahorro / Inversión"
            value={`${pct(profile.needs_ratio)} / ${pct(profile.wants_ratio)} / ${pct(profile.savings_ratio)} / ${pct(profile.investment_ratio)}`}
          />
          <KeyValueRow
            label="Endeudamiento máximo recomendado"
            value={pct(profile.max_debt_ratio)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen del período</Text>
          <KeyValueRow label="Ingresos" value={cop(analysis.total_income)} />
          <KeyValueRow label="Gastos" value={cop(analysis.total_expense)} />
          <KeyValueRow
            label="Patrimonio neto"
            value={cop(analysis.net_worth)}
          />
          <KeyValueRow label="Deuda total" value={cop(analysis.total_debt)} />
          <KeyValueRow
            label="% de gasto sobre ingreso"
            value={pct(analysis.expense_ratio)}
          />
          <KeyValueRow
            label="% de deuda sobre ingreso"
            value={pct(analysis.debt_ratio)}
          />
          <KeyValueRow
            label="Tasa de ahorro"
            value={pct(analysis.savings_rate)}
          />
        </View>

        {analysis.insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alertas y recomendaciones</Text>
            {analysis.insights.map((insight, idx) => (
              <View key={idx} style={styles.alertBox}>
                <Text style={styles.alertTitle}>
                  {SEVERITY_LABEL[insight.severity] ?? insight.severity}
                </Text>
                <Text>{insight.message}</Text>
                {insight.suggested_action ? (
                  <Text style={{ marginTop: 2 }}>
                    Sugerencia: {insight.suggested_action}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Análisis</Text>
          <Text style={styles.narrative}>{analysis.narrative}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuentas bancarias</Text>
          {accounts.length === 0 ? (
            <Text style={styles.emptyText}>Sin cuentas registradas.</Text>
          ) : (
            <>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.cellHeader}>Banco</Text>
                <Text style={styles.cellHeader}>Tipo</Text>
                <Text style={styles.cellHeader}>Número</Text>
                <Text style={styles.cellHeader}>Saldo</Text>
              </View>
              {accounts.map((a) => (
                <View key={a.id} style={styles.tableRow}>
                  <Text style={styles.cell}>{a.bank_name}</Text>
                  <Text style={styles.cell}>{a.account_type}</Text>
                  <Text style={styles.cell}>{a.masked_account_number}</Text>
                  <Text style={styles.cell}>{cop(a.display_balance)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {(assets.length > 0 || liabilities.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activos y pasivos</Text>
            {assets.map((asset) => (
              <View key={`asset-${asset.id}`} style={styles.row}>
                <Text style={styles.label}>{asset.name} (activo)</Text>
                <Text style={styles.value}>{cop(asset.current_value)}</Text>
              </View>
            ))}
            {liabilities.map((liability) => (
              <View key={`liability-${liability.id}`} style={styles.row}>
                <Text style={styles.label}>{liability.name} (pasivo)</Text>
                <Text style={styles.value}>
                  -{cop(liability.current_balance)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metas financieras activas</Text>
          {activeObjectives.length === 0 ? (
            <Text style={styles.emptyText}>Sin metas activas.</Text>
          ) : (
            <>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.cellHeader}>Meta</Text>
                <Text style={styles.cellHeader}>Avance</Text>
                <Text style={styles.cellHeader}>Restante</Text>
                <Text style={styles.cellHeader}>Días</Text>
              </View>
              {activeObjectives.map((objective) => (
                <View key={objective.id} style={styles.tableRow}>
                  <Text style={styles.cell}>{objective.name}</Text>
                  <Text style={styles.cell}>
                    {pct(objective.progress_percent)}
                  </Text>
                  <Text style={styles.cell}>
                    {objective.amount_remaining === null
                      ? 'N/D'
                      : cop(objective.amount_remaining)}
                  </Text>
                  <Text style={styles.cell}>
                    {objective.days_remaining === null
                      ? 'N/D'
                      : objective.days_remaining}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gasto por categoría</Text>
          {byCategory.length === 0 ? (
            <Text style={styles.emptyText}>
              Sin transacciones categorizadas en el período.
            </Text>
          ) : (
            <>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.cellHeader}>Categoría</Text>
                <Text style={styles.cellHeader}>Gasto</Text>
                <Text style={styles.cellHeader}>Movimientos</Text>
              </View>
              {byCategory.map((c) => (
                <View key={c.category_id} style={styles.tableRow}>
                  <Text style={styles.cell}>{categoryName(c.category_id)}</Text>
                  <Text style={styles.cell}>{cop(c.expenses)}</Text>
                  <Text style={styles.cell}>{c.count}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>
            Consolidado anual por categoría (últimos 12 meses)
          </Text>
          {yearlyCategoryReview.length === 0 ? (
            <Text style={styles.emptyText}>
              Sin transacciones categorizadas en el último año.
            </Text>
          ) : (
            <>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.cellHeader}>Categoría</Text>
                <Text style={styles.cellHeader}>Gasto anual</Text>
                <Text style={styles.cellHeader}>% del gasto</Text>
                <Text style={styles.cellHeader}>Movimientos</Text>
                <Text style={styles.cellHeader}>¿Revisar?</Text>
              </View>
              {yearlyCategoryReview.map((c) => (
                <View key={c.category_id} style={styles.tableRow}>
                  <Text style={styles.cell}>{c.name}</Text>
                  <Text style={styles.cell}>{cop(c.expenses)}</Text>
                  <Text style={styles.cell}>{pct(c.sharePercent)}</Text>
                  <Text style={styles.cell}>{c.count}</Text>
                  <Text style={styles.cell}>{c.shouldReview ? 'Sí' : '—'}</Text>
                </View>
              ))}
            </>
          )}
          {categoriesToReview.length > 0 && (
            <Text style={{ ...styles.narrative, marginTop: 6 }}>
              Recomendación: {categoriesToReview.map((c) => c.name).join(', ')}{' '}
              {categoriesToReview.length === 1
                ? 'concentra una porción alta'
                : 'concentran una porción alta'}{' '}
              del gasto discrecional del último año — son las primeras
              candidatas a evaluar y reducir.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Movimientos de los últimos 30 días
          </Text>
          <Text style={{ ...styles.emptyText, marginBottom: 4 }}>
            No incluye transferencias entre tus propias cuentas.
          </Text>
          {recentTransactions.length === 0 ? (
            <Text style={styles.emptyText}>
              Sin transacciones en los últimos 30 días.
            </Text>
          ) : (
            <>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.cellHeader}>Fecha</Text>
                <Text style={{ ...styles.cellHeader, flex: 2 }}>
                  Descripción
                </Text>
                <Text style={styles.cellHeader}>Categoría</Text>
                <Text style={styles.cellHeader}>Tipo</Text>
                <Text style={styles.cellHeader}>Monto</Text>
              </View>
              {recentTransactions.map((tx) => (
                <View key={tx.id} style={styles.tableRow}>
                  <Text style={styles.cell}>
                    {formatDate(tx.transaction_date)}
                  </Text>
                  <Text style={{ ...styles.cell, flex: 2 }}>
                    {tx.description ?? '—'}
                  </Text>
                  <Text style={styles.cell}>
                    {categoryName(tx.category_id)}
                  </Text>
                  <Text style={styles.cell}>
                    {TYPE_LABEL[tx.type] ?? tx.type}
                  </Text>
                  <Text style={styles.cell}>{cop(tx.amount)}</Text>
                </View>
              ))}
              {recentTransactionsTruncated && (
                <Text style={{ ...styles.emptyText, marginTop: 4 }}>
                  Tuviste un volumen muy alto de movimientos en este período —
                  se muestran solo los más recientes.
                </Text>
              )}
            </>
          )}
        </View>

        <Text style={styles.footer}>
          Este reporte es informativo y no constituye asesoría financiera. Todos
          los montos están en pesos colombianos (COP). Generado automáticamente
          por Sprig.
        </Text>
      </Page>
    </Document>
  );
}
