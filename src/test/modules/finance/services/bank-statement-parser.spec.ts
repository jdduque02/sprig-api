import {
  extractTextLines,
  parseAmount,
  parseDateFromToken,
  parsePdfStatement,
  parseStatementLines,
  pdfjsLoader,
  TextLine,
} from '@finance/service/bank-statement-parser';
import { TransactionTypeEnum } from '@shared/enums';

type Tok = [number, string];

function line(y: number, page: number, toks: Tok[]): TextLine {
  return {
    y,
    page,
    tokens: toks.map(([absX, text]) => ({
      x: absX,
      y,
      text,
      absX,
      page,
    })),
  };
}

describe('bank-statement-parser', () => {
  describe('Bancolombia (tarjeta de crédito)', () => {
    const lines: TextLine[] = [
      line(586.6, 2, [
        [30, 'Nuevos movimientos entre 15 jun hasta 15 jul. 2026'],
      ]),
      line(566.4, 2, [
        [40, 'Número de'],
        [93.8, 'Fecha'],
        [165.1, 'Movimientos'],
        [275.2, 'Valor'],
        [381.7, 'Valor'],
        [534.3, 'Saldo'],
      ]),
      line(536.4, 2, [
        [40, 'C78699'],
        [85.8, '15/07/2026'],
        [142.9, 'ABONO SUCURSAL VIRTUAL'],
        [259.6, '$ -1.547.390,00'],
        [366.1, '$ -1.547.390,00'],
        [533.5, '$ 0,00'],
      ]),
      line(511.4, 2, [
        [40, '000000'],
        [85.8, '15/07/2026'],
        [155.6, 'CUOTA DE MANEJO'],
        [265.4, '$ 36.990,00'],
        [371.9, '$ 36.990,00'],
        [533.5, '$ 0,00'],
      ]),
      line(486.4, 2, [
        [40, 'R71865'],
        [85.8, '12/07/2026'],
        [145.2, 'MOVISTAR PAGOSEPAYCO'],
        [263.5, '$ 176.490,00'],
        [332.3, '1/1'],
        [380.5, '$ 0,00'],
        [533.5, '$ 0,00'],
      ]),
      line(371.6, 2, [[30, 'Movimientos antes de 15 jun']]),
      line(321.4, 2, [
        [40, 'C02797'],
        [85.8, '14/06/2026'],
        [142.9, 'ABONO SUCURSAL VIRTUAL'],
        [259.6, '$ -1.084.732,00'],
        [366.1, '$ -1.084.732,00'],
        [533.5, '$ 0,00'],
      ]),
      // Misma coordenada y que la fila de la página 2: nunca debe fusionarse.
      line(536.4, 5, [
        [40, '000000'],
        [85.8, '03/07/2026'],
        [143.1, 'TRASLADO SALDO A FAVOR'],
        [274, '$ 0,85'],
        [380.5, '$ 0,85'],
        [533.5, '$ 0,00'],
      ]),
    ];

    it('detecta el banco y el período', () => {
      const result = parseStatementLines(lines);
      expect(result.bank).toBe('bancolombia');
      expect(result.period).toBe('15 jun - 15 jul 2026');
    });

    it('parsea las transacciones de la sección de movimientos', () => {
      const result = parseStatementLines(lines);
      expect(result.transactions).toHaveLength(3);

      const [cuota, compra, traslado] = result.transactions;

      expect(cuota).toMatchObject({
        transaction_date: '2026-07-15',
        description: 'CUOTA DE MANEJO',
        amount: 36990,
        type: TransactionTypeEnum.EXPENSE,
        reference: '000000',
      });

      expect(compra).toMatchObject({
        transaction_date: '2026-07-12',
        description: 'MOVISTAR PAGOSEPAYCO',
        amount: 176490,
        type: TransactionTypeEnum.EXPENSE,
        reference: 'R71865',
      });

      expect(traslado).toMatchObject({
        transaction_date: '2026-07-03',
        description: 'TRASLADO SALDO A FAVOR',
        amount: 0.85,
        type: TransactionTypeEnum.EXPENSE,
      });
    });

    it('omite ABONO SUCURSAL VIRTUAL (pago de tarjeta)', () => {
      const result = parseStatementLines(lines);
      const descs = result.transactions.map((t) => t.description);
      expect(descs).not.toContain('ABONO SUCURSAL VIRTUAL');
      expect(descs).toContain('TRASLADO SALDO A FAVOR');
    });
  });

  describe('Bancolombia (cuenta de ahorros)', () => {
    const lines: TextLine[] = [
      line(698.8, 1, [
        [332, 'DESDE:'],
        [370, '2024/06/30'],
        [450, 'HASTA:'],
        [490, '2024/09/30'],
      ]),
      line(602.8, 2, [
        [31.5, 'FECHA'],
        [132.3, 'DESCRIPCIÓN'],
        [269.5, 'SUCURSAL'],
        [355.1, 'DCTO.'],
        [434.1, 'VALOR'],
        [533.8, 'SALDO'],
      ]),
      line(584.6, 2, [
        [35, '14/07'],
        [79, 'RETIRO CAJERO AUTO CASTILLA 2'],
        [448.2, '-100,000.00'],
        [549, '746,073.88'],
      ]),
      line(566.6, 2, [
        [35, '27/08'],
        [79, 'ABONO INTERESES AHORROS'],
        [481.8, '5.76'],
        [539.4, '1,053,466.25'],
      ]),
      line(530.6, 2, [
        [35, '30/08'],
        [79, 'TRANSFERENCIA CTA SUC VIRTUAL'],
        [448.2, '-245,100.00'],
        [549, '808,367.35'],
      ]),
      line(472.6, 1, [
        [45, 'SALDO ANTERIOR'],
        [140, '$'],
        [222.4, '1,913,832.07'],
        [330, 'SALDO PROMEDIO'],
        [465, '$'],
        [537.2, '858,048'],
      ]),
    ];

    it('detecta el layout de cuenta y usa el parser de ahorros', () => {
      const result = parseStatementLines(lines);
      expect(result.bank).toBe('bancolombia');
      expect(result.period).toBe('2024/06/30 - 2024/09/30');
      expect(result.transactions).toHaveLength(3);

      const [retiro, abono, transfer] = result.transactions;
      expect(retiro).toMatchObject({
        transaction_date: '2024-07-14',
        description: 'RETIRO CAJERO AUTO CASTILLA 2',
        amount: 100000,
        type: TransactionTypeEnum.EXPENSE,
        balance: 746073.88,
      });
      expect(abono).toMatchObject({
        transaction_date: '2024-08-27',
        description: 'ABONO INTERESES AHORROS',
        amount: 5.76,
        type: TransactionTypeEnum.INCOME,
        balance: 1053466.25,
      });
      expect(transfer).toMatchObject({
        transaction_date: '2024-08-30',
        description: 'TRANSFERENCIA CTA SUC VIRTUAL',
        amount: 245100,
        type: TransactionTypeEnum.EXPENSE,
      });
    });

    it('omite filas de resumen sin fecha', () => {
      const result = parseStatementLines(lines);
      const descs = result.transactions.map((t) => t.description);
      expect(descs).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ description: 'SALDO ANTERIOR' }),
        ]),
      );
    });

    it('usa el parser de cuenta aunque la entidad detecte el de tarjeta', () => {
      const withCreditHeader: TextLine[] = [
        line(586.6, 2, [
          [30, 'Nuevos movimientos entre 15 jun hasta 15 jul. 2026'],
        ]),
        ...lines,
      ];
      const entities = [
        { code: 'bancolombia', detect_patterns: ['Nuevos movimientos entre'] },
      ];

      const result = parseStatementLines(withCreditHeader, undefined, entities);

      expect(result.bank).toBe('bancolombia');
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0]).toMatchObject({
        transaction_date: '2024-07-14',
        description: 'RETIRO CAJERO AUTO CASTILLA 2',
      });
    });
  });

  describe('RappiCard (Davivienda)', () => {
    const lines: TextLine[] = [
      line(510.6, 1, [
        [284.8, 'Desde'],
        [316.4, '27 jun 2026'],
      ]),
      line(495.6, 1, [
        [285.7, 'Hasta'],
        [317.4, '30 jul 2026'],
      ]),
      line(743.3, 2, [
        [48.8, 'Tarjeta'],
        [88, 'Fecha'],
        [151, 'Descripción'],
        [240.5, 'Valor'],
        [307.7, 'Capital facturado'],
        [368.5, 'Cuotas'],
        [481.4, 'Tasa M.V'],
      ]),
      line(704.7, 2, [
        [48.8, '-'],
        [88, '2026-06-30'],
        [151, 'PAGOS POR PSE'],
        [234.5, '$-357.032,00'],
        [322.5, 'N/A'],
        [377.1, 'N/A'],
        [432, 'N/A'],
        [489.1, '0%'],
        [514.9, '0,00%'],
      ]),
      line(685.9, 2, [
        [48.8, 'Virtual'],
        [88, '2026-06-30'],
        [151, 'RAPPI'],
        [236, '$357.032,00'],
        [319.9, '$0,00'],
        [377.1, 'N/A'],
        [429.4, '$0,00'],
        [481.2, '0,0000%'],
        [514.9, '0,00%'],
      ]),
      line(667.2, 2, [[151, 'PLUS 12 MONTH']]),
      line(661.2, 2, [
        [48.8, 'Virtual'],
        [88, '2026-07-06'],
        [235.7, '$479.900,00'],
        [319.9, '$0,00'],
        [377.1, 'N/A'],
        [429.4, '$0,00'],
        [514.9, '0,00%'],
      ]),
      line(655.2, 2, [[151, 'FAMILY']]),
      line(636.4, 2, [
        [48.8, 'Virtual'],
        [88, '2026-07-11'],
        [151, 'FAP*GVGMALL'],
        [238, '$107.095,17'],
        [319.9, '$0,00'],
        [377.1, 'N/A'],
        [429.4, '$0,00'],
        [514.9, '0,00%'],
      ]),
      // Texto de otras páginas en rango de descripción: no debe pegarse.
      line(542, 1, [
        [192.5, 'Pago mínimo'],
        [247.6, '$0.00'],
      ]),
      line(760.5, 3, [
        [158, 'Valor sobre el cual se generarán gastos de cobranza'],
      ]),
    ];

    it('detecta el banco y el período desde Desde/Hasta', () => {
      const result = parseStatementLines(lines);
      expect(result.bank).toBe('rappicard');
      expect(result.period).toBe('27 jun 2026 - 30 jul 2026');
    });

    it('parsea pagos como ingreso y compras como gasto', () => {
      const result = parseStatementLines(lines);
      expect(result.transactions).toHaveLength(4);

      const [pago, rappi, family, gv] = result.transactions;

      expect(pago).toMatchObject({
        transaction_date: '2026-06-30',
        description: 'PAGOS POR PSE',
        amount: 357032,
        type: TransactionTypeEnum.INCOME,
      });
      expect(rappi).toMatchObject({
        transaction_date: '2026-06-30',
        description: 'RAPPI PLUS 12 MONTH',
        amount: 357032,
        type: TransactionTypeEnum.EXPENSE,
      });
      expect(family).toMatchObject({
        transaction_date: '2026-07-06',
        description: 'FAMILY',
        amount: 479900,
        type: TransactionTypeEnum.EXPENSE,
      });
      expect(gv).toMatchObject({
        transaction_date: '2026-07-11',
        description: 'FAP*GVGMALL',
        amount: 107095.17,
        type: TransactionTypeEnum.EXPENSE,
      });
    });

    it('ignora texto de otras páginas que intercala el PDF', () => {
      const result = parseStatementLines(lines);
      const descs = result.transactions.map((t) => t.description);
      expect(descs).not.toContain('FAP*GVGMALL Pago mínimo');
      expect(descs.join(' ')).not.toContain('gastos de cobranza');
    });
  });

  describe('Nu Bank', () => {
    const lines: TextLine[] = [
      line(617.9, 1, [
        [152, 'Nu Placa'],
        [266, 'Número de Cuenta'],
        [418, 'Período'],
      ]),
      line(603.7, 1, [
        [152, 'JDG370'],
        [266, '57442710'],
        [418, '01 - 31 JUL 2026'],
      ]),
      line(715.8, 2, [[116, 'Movimientos']]),
      line(673.4, 2, [
        [68, '04 jul'],
        [121, 'Recibiste dinero de un CDT'],
        [462.5, '+$608.657,28'],
      ]),
      line(638.4, 2, [
        [68, '30 jul'],
        [121, 'Recibiste de Jose David Duque Gutierrez'],
        [458.7, '+$750.000,00'],
      ]),
      line(568.4, 2, [
        [121, 'Rendimiento total de tu cuenta'],
        [469.1, '+$96.016,20'],
      ]),
      line(532.4, 2, [[121, 'Los rendimientos se pagan a diario']]),
    ];

    it('detecta el banco e infiere el año del período', () => {
      const result = parseStatementLines(lines);
      expect(result.bank).toBe('nu');
      expect(result.period).toBe('01 - 31 JUL 2026');
    });

    it('parsea movimientos con fecha, descripción y monto con signo', () => {
      const result = parseStatementLines(lines);
      expect(result.transactions).toHaveLength(2);

      const [cdt, recibido] = result.transactions;

      expect(cdt).toMatchObject({
        transaction_date: '2026-07-04',
        description: 'Recibiste dinero de un CDT',
        amount: 608657.28,
        type: TransactionTypeEnum.INCOME,
      });
      expect(recibido).toMatchObject({
        transaction_date: '2026-07-30',
        description: 'Recibiste de Jose David Duque Gutierrez',
        amount: 750000,
        type: TransactionTypeEnum.INCOME,
      });
    });

    it('omite filas resumen sin fecha', () => {
      const result = parseStatementLines(lines);
      expect(result.transactions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            description: 'Rendimiento total de tu cuenta',
          }),
        ]),
      );
    });
  });

  describe('Parser genérico (sin banco detectado)', () => {
    const lines: TextLine[] = [
      line(610, 1, [
        [0.15, 'FECHA'],
        [0.35, 'DETALLE'],
        [0.55, 'DEBITO'],
        [0.72, 'CREDITO'],
        [0.9, 'SALDO'],
      ]),
      line(590, 1, [
        [0.2, '01/07/2026'],
        [0.35, 'SUPERMERCADO'],
        [0.55, '50.000,00'],
      ]),
    ];

    it('no detecta banco y usa el parser genérico', () => {
      const result = parseStatementLines(lines);
      expect(result.bank).toBeUndefined();
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        transaction_date: '2026-07-01',
        description: 'SUPERMERCADO',
        amount: 50000,
        type: TransactionTypeEnum.EXPENSE,
      });
    });
  });

  describe('Detección con entidades configuradas (soporte)', () => {
    const header = [
      [0.15, 'FECHA'],
      [0.35, 'DETALLE'],
      [0.55, 'DEBITO'],
      [0.72, 'CREDITO'],
      [0.9, 'SALDO'],
    ] as [number, string][];

    it('reconoce una entidad personalizada por sus patrones', () => {
      const lines: TextLine[] = [
        line(610, 1, header),
        line(590, 1, [
          [0.2, '01/07/2026'],
          [0.35, 'SUPERMERCADO'],
          [0.55, '50.000,00'],
        ]),
        line(700, 1, [[0.5, 'Daviplata - Movimientos de tu cuenta']]),
      ];
      const entities = [
        { code: 'daviplata', detect_patterns: ['Movimientos de tu cuenta'] },
      ];

      const result = parseStatementLines(lines, undefined, entities);

      expect(result.bank).toBe('daviplata');
      expect(result.transactions).toHaveLength(1);
    });

    it('toma la entidad con más coincidencias', () => {
      const lines: TextLine[] = [
        line(610, 1, header),
        line(590, 1, [
          [0.2, '01/07/2026'],
          [0.35, 'SUPERMERCADO'],
          [0.55, '50.000,00'],
        ]),
        line(700, 1, [
          [0.5, 'Banco Futuro'],
          [0.6, 'Cuenta de ahorros'],
        ]),
        line(680, 1, [[0.5, 'Leyenda bancaria de la entidad']]),
      ];
      const entities = [
        { code: 'bancoa', detect_patterns: ['Banco Futuro'] },
        {
          code: 'bancob',
          detect_patterns: ['Cuenta de ahorros', 'Leyenda bancaria'],
        },
      ];

      const result = parseStatementLines(lines, undefined, entities);

      expect(result.bank).toBe('bancob');
    });

    it('no detecta banco si ningún patrón coincide', () => {
      const lines: TextLine[] = [
        line(610, 1, header),
        line(590, 1, [
          [0.2, '01/07/2026'],
          [0.35, 'SUPERMERCADO'],
          [0.55, '50.000,00'],
        ]),
      ];
      const entities = [
        { code: 'bancoa', detect_patterns: ['Cosa inexistente'] },
      ];

      const result = parseStatementLines(lines, undefined, entities);

      expect(result.bank).toBeUndefined();
      expect(result.transactions).toHaveLength(1);
    });

    it('ignora patrones inválidos (regex mal escrita)', () => {
      const lines: TextLine[] = [
        line(610, 1, header),
        line(590, 1, [
          [0.2, '01/07/2026'],
          [0.35, 'SUPERMERCADO'],
          [0.55, '50.000,00'],
        ]),
        line(700, 1, [[0.5, 'Extracto Daviplata']]),
      ];
      const entities = [
        { code: 'daviplata', detect_patterns: ['[a-', 'Extracto Daviplata'] },
      ];

      const result = parseStatementLines(lines, undefined, entities);

      expect(result.bank).toBe('daviplata');
    });

    it('usa los patrones integrados si la lista de entidades está vacía', () => {
      const lines: TextLine[] = [
        line(700, 1, [
          [0.5, 'Nu Placa'],
          [0.5, 'Dinero Disponible'],
        ]),
      ];
      const result = parseStatementLines(lines, undefined, []);
      expect(result.bank).toBe('nu');
    });

    it('en empate de puntajes gana la primera entidad', () => {
      const lines: TextLine[] = [
        line(610, 1, header),
        line(590, 1, [
          [0.2, '01/07/2026'],
          [0.35, 'SUPERMERCADO'],
          [0.55, '50.000,00'],
        ]),
        line(700, 1, [[0.5, 'Frase comun']]),
      ];
      const entities = [
        { code: 'primera', detect_patterns: ['Frase comun'] },
        { code: 'segunda', detect_patterns: ['Frase comun'] },
      ];

      const result = parseStatementLines(lines, undefined, entities);

      expect(result.bank).toBe('primera');
    });
  });

  describe('Bancolombia (tarjeta) - cuotas e installment_value', () => {
    const head: Tok[] = [
      [30, 'Nuevos movimientos entre 15 jun hasta 15 jul. 2026'],
    ];

    it('extrae número de cuotas y valor de cuota cuando el extracto lo reporta', () => {
      const lines: TextLine[] = [
        line(586.6, 2, head),
        line(536.4, 2, [
          [40, 'C12345'],
          [85.8, '10/07/2026'],
          [155.6, 'NEVERAS LTDA'],
          [263.5, '$ 1.200.000,00'],
          [332.3, '12'],
          [380.5, '$ 100.000,00'],
          [533.5, '$ 0,00'],
        ]),
      ];
      const result = parseStatementLines(lines);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        description: 'NEVERAS LTDA',
        amount: 1200000,
        installments: 12,
        installment_value: 100000,
      });
    });

    it('cuotas = 1 solo fija installments (sin valor de cuota)', () => {
      const lines: TextLine[] = [
        line(586.6, 2, head),
        line(536.4, 2, [
          [40, 'C99999'],
          [85.8, '11/07/2026'],
          [155.6, 'COMPRA DE CONTADO'],
          [263.5, '$ 150.000,00'],
          [332.3, '1'],
          [380.5, '$ 150.000,00'],
          [533.5, '$ 0,00'],
        ]),
      ];
      const result = parseStatementLines(lines);
      expect(result.transactions[0]).toMatchObject({
        amount: 150000,
        installments: 1,
      });
      expect(result.transactions[0].installment_value).toBeUndefined();
    });

    it('estima el valor de la cuota cuando no hay columna explícita (gasto)', () => {
      const lines: TextLine[] = [
        line(586.6, 2, head),
        line(536.4, 2, [
          [40, 'C88888'],
          [85.8, '12/07/2026'],
          [155.6, 'CUOTA COMPRA'],
          [263.5, '$ 600.000,00'],
          [332.3, '6'],
          [380.5, '$ 0,00'],
          [533.5, '$ 2.000.000,00'],
        ]),
      ];
      const result = parseStatementLines(lines);
      expect(result.transactions[0]).toMatchObject({
        amount: 600000,
        installments: 6,
        installment_value: 100000,
      });
    });

    it('abono (ingreso) con cuotas: solo installments, sin valor estimado', () => {
      const lines: TextLine[] = [
        line(586.6, 2, head),
        line(536.4, 2, [
          [40, 'C77777'],
          [85.8, '05/07/2026'],
          [155.6, 'ABONO CUOTA EXTRA'],
          [263.5, '$ -600.000,00'],
          [332.3, '6'],
          [380.5, '$ 0,00'],
          [533.5, '$ 0,00'],
        ]),
      ];
      const result = parseStatementLines(lines);
      expect(result.transactions[0]).toMatchObject({
        amount: 600000,
        type: TransactionTypeEnum.INCOME,
        installments: 6,
      });
      expect(result.transactions[0].installment_value).toBeUndefined();
    });

    it('ignora enteros pequeños tras las cuotas y estima si no hay valor', () => {
      const lines: TextLine[] = [
        line(586.6, 2, head),
        line(536.4, 2, [
          [40, 'C66666'],
          [85.8, '13/07/2026'],
          [155.6, 'OTRA CUOTA'],
          [263.5, '$ 600.000,00'],
          [332.3, '6'],
          [380.5, '3'],
          [429.0, '$ 0,00'],
          [533.5, '$ 2.000.000,00'],
        ]),
      ];
      const result = parseStatementLines(lines);
      expect(result.transactions[0]).toMatchObject({
        amount: 600000,
        installments: 6,
        installment_value: 100000,
      });
    });

    it('un cero en la columna de cuotas no se toma como cuotas', () => {
      const lines: TextLine[] = [
        line(586.6, 2, head),
        line(536.4, 2, [
          [40, 'C55555'],
          [85.8, '14/07/2026'],
          [155.6, 'SIN CUOTAS'],
          [263.5, '$ 600.000,00'],
          [332.3, '0'],
          [380.5, '$ 600.000,00'],
          [533.5, '$ 0,00'],
        ]),
      ];
      const result = parseStatementLines(lines);
      expect(result.transactions[0]).toMatchObject({ amount: 600000 });
      expect(result.transactions[0].installments).toBeUndefined();
    });

    it('omite fechas inválidas y valores en cero', () => {
      const lines: TextLine[] = [
        line(586.6, 2, head),
        line(536.4, 2, [
          [40, 'C44444'],
          [85.8, '99/99/2026'],
          [155.6, 'FECHA MALA'],
          [263.5, '$ 10.000,00'],
          [533.5, '$ 0,00'],
        ]),
        line(511.4, 2, [
          [40, 'C33333'],
          [85.8, '16/07/2026'],
          [155.6, 'VALOR CERO'],
          [263.5, '$ 0,00'],
          [533.5, '$ 0,00'],
        ]),
      ];
      const result = parseStatementLines(lines);
      expect(result.transactions).toHaveLength(0);
    });

    it('valor de cuota negativo cae a la estimación monto/cuotas', () => {
      const lines: TextLine[] = [
        line(586.6, 2, head),
        line(536.4, 2, [
          [40, 'C11111'],
          [85.8, '19/07/2026'],
          [155.6, 'CUOTA NEGATIVA'],
          [263.5, '$ 600.000,00'],
          [332.3, '6'],
          [380.5, '$ -100.000,00'],
          [533.5, '$ 0,00'],
        ]),
      ];
      const result = parseStatementLines(lines);
      expect(result.transactions[0]).toMatchObject({
        amount: 600000,
        installments: 6,
        installment_value: 100000,
      });
    });

    it('detecta el banco aunque el período no traiga año', () => {
      const lines: TextLine[] = [
        line(586.6, 2, [[30, 'Nuevos movimientos entre 15 jun hasta 15 jul']]),
        line(536.4, 2, [
          [40, 'C00001'],
          [85.8, '16/07/2026'],
          [155.6, 'COMPRA'],
          [263.5, '$ 50.000,00'],
          [533.5, '$ 0,00'],
        ]),
      ];
      const result = parseStatementLines(lines);
      expect(result.bank).toBe('bancolombia');
      expect(result.period).toBeUndefined();
      expect(result.transactions).toHaveLength(1);
    });

    it('sin descripción usa Movimiento bancario y sin referencia', () => {
      const lines: TextLine[] = [
        line(586.6, 2, head),
        line(536.4, 2, [
          [85.8, '18/07/2026'],
          [263.5, '$ 5.000,00'],
          [533.5, '$ 0,00'],
        ]),
        line(511.4, 2, [
          [40, 'C22222'],
          [85.8, '17/07/2026'],
          [155.6, 'COMPRA'],
          [263.5, 'REFERENCIA'],
          [533.5, '$ 0,00'],
        ]),
      ];
      const result = parseStatementLines(lines);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        transaction_date: '2026-07-18',
        description: 'Movimiento bancario',
        amount: 5000,
      });
      expect(result.transactions[0].reference).toBeUndefined();
    });
  });

  describe('Bancolombia (cuenta de ahorros) - casos límite', () => {
    const header: TextLine[] = [
      line(602.8, 2, [
        [31.5, 'FECHA'],
        [132.3, 'DESCRIPCIÓN'],
        [269.5, 'SUCURSAL'],
        [355.1, 'DCTO.'],
        [434.1, 'VALOR'],
        [533.8, 'SALDO'],
      ]),
    ];

    it('omite fechas inválidas y filas sin VALOR; usa año actual sin período', () => {
      const year = new Date().getFullYear();
      const lines: TextLine[] = [
        ...header,
        line(584.6, 2, [
          [35, '99/13'],
          [79, 'FECHA INVALIDA'],
          [448.2, '-100,000.00'],
          [549, '746,073.88'],
        ]),
        line(566.6, 2, [
          [35, '14/07'],
          [79, 'SOLO SALDO'],
          [549, '746,073.88'],
        ]),
        line(548.6, 2, [
          [35, '15/07'],
          [79, 'VALOR CERO'],
          [448.2, '0,00'],
          [549, '746,073.88'],
        ]),
        line(530.6, 2, [
          [35, '16/07'],
          [79, 'RETIRO VALIDO'],
          [448.2, '-50,000.00'],
          [549, '696,073.88'],
        ]),
      ];

      const result = parseStatementLines(lines);

      expect(result.period).toBeUndefined();
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        transaction_date: `${year}-07-16`,
        description: 'RETIRO VALIDO',
        amount: 50000,
        type: TransactionTypeEnum.EXPENSE,
        balance: 696073.88,
      });
    });

    it('token de cabecera sin absX usa 0 como coordenada', () => {
      const lines: TextLine[] = [
        {
          y: 602.8,
          tokens: [
            { x: 0.2, y: 602.8, text: 'FECHA', absX: 31.5 },
            { x: 0.4, y: 602.8, text: 'DESCRIPCIÓN', absX: 132.3 },
            { x: 0.55, y: 602.8, text: 'DCTO.', absX: 355.1 },
            { x: 0.6, y: 602.8, text: 'VALOR' },
            { x: 0.9, y: 602.8, text: 'SALDO', absX: 533.8 },
          ],
        },
        line(584.6, 2, [
          [35, '14/07'],
          [10, '5.76'],
        ]),
      ];

      const result = parseStatementLines(lines);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        amount: 5.76,
        description: 'Movimiento bancario',
      });
      expect(result.transactions[0].balance).toBeUndefined();
    });
  });

  describe('RappiCard - casos límite', () => {
    const base: TextLine[] = [
      line(743.3, 2, [
        [48.8, 'Tarjeta'],
        [88, 'Fecha'],
        [151, 'Descripción'],
        [240.5, 'Valor'],
        [307.7, 'Capital facturado'],
        [368.5, 'Cuotas'],
        [481.4, 'Tasa M.V'],
      ]),
    ];

    it('extrae cuotas y valor de cuota', () => {
      const lines: TextLine[] = [
        ...base,
        line(704.7, 2, [
          [48.8, 'Virtual'],
          [88, '2026-07-10'],
          [151, 'ALMACEN X'],
          [236, '$1.200.000,00'],
          [319.9, '$0,00'],
          [368.5, '12'],
          [429.4, '$100.000,00'],
          [514.9, '0,00%'],
        ]),
      ];

      const result = parseStatementLines(lines);
      expect(result.bank).toBe('rappicard');
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        description: 'ALMACEN X',
        amount: 1200000,
        installments: 12,
        installment_value: 100000,
      });
    });

    it('continúa la descripción en la misma página y respeta el orden vertical', () => {
      const lines: TextLine[] = [
        ...base,
        line(704.7, 2, [
          [48.8, 'Virtual'],
          [88, '2026-07-10'],
          [151, 'ALMACEN X'],
          [236, '$1.200.000,00'],
          [368.5, '12'],
        ]),
        {
          y: 640,
          tokens: [{ x: 151, y: 640, text: 'SEGUNDA LINEA', absX: 151 }],
        },
        line(720, 2, [[151, 'NO DEBE APARECER']]),
        line(630, 2, [[100, 'FUERA DE RANGO']]),
      ];

      const result = parseStatementLines(lines);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe(
        'ALMACEN X SEGUNDA LINEA',
      );
    });

    it('fila con fecha pero sin valor: no genera transacción', () => {
      const lines: TextLine[] = [
        ...base,
        line(704.7, 2, [
          [48.8, '-'],
          [88, '2026-06-30'],
          [151, 'SIN VALOR'],
        ]),
      ];
      const result = parseStatementLines(lines);
      expect(result.transactions).toHaveLength(0);
    });

    it('valor N/A se trata como cero', () => {
      const lines: TextLine[] = [
        ...base,
        line(704.7, 2, [
          [48.8, '-'],
          [88, '2026-06-30'],
          [151, 'DESCRIPCION'],
          [236, 'N/A'],
        ]),
      ];
      const result = parseStatementLines(lines);
      expect(result.transactions).toHaveLength(0);
    });

    it('sin filas de movimientos: finalize con current nulo', () => {
      const result = parseStatementLines([
        ...base,
        line(495.6, 1, [
          [285.7, 'Hasta'],
          [317.4, 'NADA'],
        ]),
      ]);
      expect(result.transactions).toHaveLength(0);
      expect(result.period).toBeUndefined();
    });

    it('fecha sin página → page 0; descripción vacía → Movimiento bancario', () => {
      const lines: TextLine[] = [
        ...base,
        {
          y: 700,
          tokens: [
            { x: 88, y: 700, text: '2026-07-15', absX: 88 },
            { x: 236, y: 700, text: '$10.000,00', absX: 236 },
          ],
        },
      ];
      const result = parseStatementLines(lines);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        transaction_date: '2026-07-15',
        description: 'Movimiento bancario',
        amount: 10000,
      });
    });
  });

  describe('Nu Bank - casos límite', () => {
    const head: TextLine[] = [
      line(603.7, 1, [
        [152, 'Nu Placa'],
        [266, 'Número de Cuenta'],
        [418, '01 - 31 JUL 2026'],
      ]),
    ];

    it('omite mes inválido, fecha inexistente y montos en cero', () => {
      const lines: TextLine[] = [
        ...head,
        line(673.4, 2, [
          [68, '04 xyz'],
          [121, 'MES MALO'],
          [462.5, '+$608.657,28'],
        ]),
        line(655.4, 2, [
          [68, '31 feb'],
          [121, 'DIA INEXISTENTE'],
          [462.5, '+$100,00'],
        ]),
        line(637.4, 2, [
          [68, '05 jul'],
          [121, 'MONTO CERO'],
          [462.5, '0,00'],
        ]),
        line(619.4, 2, [
          [68, '07 jul'],
          [121, 'SIN MONTO'],
          [350, '$100,00'],
        ]),
        line(601.4, 2, [
          [68, '06 jul'],
          [121, 'Gasto con tarjeta'],
          [462.5, '-$50.000,00'],
        ]),
      ];

      const result = parseStatementLines(lines);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        transaction_date: '2026-07-06',
        description: 'Gasto con tarjeta',
        amount: 50000,
        type: TransactionTypeEnum.EXPENSE,
      });
    });

    it('sin descripción → Movimiento bancario; sin período → año actual', () => {
      const year = new Date().getFullYear();
      const lines: TextLine[] = [
        line(603.7, 1, [[152, 'Nu Placa']]),
        line(673.4, 2, [
          [68, '04 jul'],
          [462.5, '+$608.657,28'],
        ]),
      ];

      const result = parseStatementLines(lines);

      expect(result.period).toBeUndefined();
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        transaction_date: `${year}-07-04`,
        description: 'Movimiento bancario',
        amount: 608657.28,
      });
    });
  });

  describe('parseAmount', () => {
    it('parsea negativos entre paréntesis', () => {
      expect(parseAmount('(1.500,00)')).toBe(-1500);
      expect(parseAmount('($1.500,00)')).toBe(-1500);
    });

    it('parsea signo negativo al final', () => {
      expect(parseAmount('1234-')).toBe(-1234);
      expect(parseAmount('1.234,56-')).toBe(-1234.56);
    });

    it('usa la coma como separador de miles sin punto decimal', () => {
      expect(parseAmount('1,234,567')).toBe(1234567);
      expect(parseAmount('123,456')).toBe(123.45);
      expect(parseAmount('123,567')).toBe(123.56);
    });

    it('usa el punto como separador de miles sin coma decimal', () => {
      expect(parseAmount('1.234.567')).toBe(1234567);
      expect(parseAmount('1234.56')).toBe(1234.56);
    });

    it('conserva signo y moneda en formato CO', () => {
      expect(parseAmount('$ -1.547.390,00')).toBe(-1547390);
      expect(parseAmount('€ 1.000,00')).toBe(1000);
      expect(parseAmount('+1.000,00')).toBe(1000);
    });

    it('devuelve null para entradas vacías, no numéricas o inválidas', () => {
      expect(parseAmount('')).toBeNull();
      expect(parseAmount('N/A')).toBeNull();
      expect(parseAmount('12ab')).toBeNull();
      expect(parseAmount('CR')).toBeNull();
      expect(parseAmount('9'.repeat(400))).toBeNull();
    });
  });

  describe('parseDateFromToken', () => {
    it('parsea fechas ISO YYYY-MM-DD', () => {
      expect(parseDateFromToken('2026-07-15')).toEqual({ date: '2026-07-15' });
      expect(parseDateFromToken('2026-7-5')).toEqual({ date: '2026-07-05' });
      expect(parseDateFromToken('2026-07-15 COMPRA')).toEqual({
        date: '2026-07-15',
        rest: 'COMPRA',
      });
    });

    it('parsea DD/MM/AAAA y DD/MM/AA', () => {
      expect(parseDateFromToken('15/07/2026')).toEqual({ date: '2026-07-15' });
      expect(parseDateFromToken('15/07/26')).toEqual({ date: '2026-07-15' });
      expect(parseDateFromToken('15/07/90')).toEqual({ date: '1990-07-15' });
    });

    it('parsea fechas con nombre de mes', () => {
      expect(parseDateFromToken('15 jul 2026')).toEqual({ date: '2026-07-15' });
      expect(parseDateFromToken('15 SEP 2026')).toEqual({ date: '2026-09-15' });
      expect(parseDateFromToken('15 set 2026')).toEqual({ date: '2026-09-15' });
      expect(parseDateFromToken('15 ENE 2026')).toEqual({ date: '2026-01-15' });
      expect(parseDateFromToken('15 jul 26')).toEqual({ date: '2026-07-15' });
      expect(parseDateFromToken('15 jul 90')).toEqual({ date: '1990-07-15' });
    });

    it('fecha con nombre de mes y resto del token', () => {
      expect(parseDateFromToken('15 jul 2026 PAGO')).toEqual({
        date: '2026-07-15',
        rest: 'PAGO',
      });
    });

    it('devuelve null para fechas inválidas o texto sin fecha', () => {
      expect(parseDateFromToken('')).toBeNull();
      expect(parseDateFromToken('   ')).toBeNull();
      expect(parseDateFromToken('2026-02-30')).toBeNull();
      expect(parseDateFromToken('31/02/2026')).toBeNull();
      expect(parseDateFromToken('32/01/2026')).toBeNull();
      expect(parseDateFromToken('31 feb 2026')).toBeNull();
      expect(parseDateFromToken('15 xyz 2026')).toBeNull();
      expect(parseDateFromToken('no es fecha')).toBeNull();
    });
  });

  describe('Parser genérico - layout y heurísticas', () => {
    it('solo columna de crédito + saldo → ingreso con saldo', () => {
      const lines: TextLine[] = [
        line(610, 1, [
          [0.15, 'FECHA'],
          [0.35, 'DETALLE'],
          [0.72, 'CREDITO'],
          [0.9, 'SALDO'],
        ]),
        line(590, 1, [
          [0.2, '01/07/2026'],
          [0.35, 'ABONO NOMINA'],
          [0.72, '1.000.000,00'],
          [0.9, '1.100.000,00'],
        ]),
      ];

      const result = parseStatementLines(lines);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        transaction_date: '2026-07-01',
        description: 'ABONO NOMINA',
        amount: 1000000,
        type: TransactionTypeEnum.INCOME,
        balance: 1100000,
      });
    });

    it('débito y crédito en la misma fila: gana débito con defaultType', () => {
      const lines: TextLine[] = [
        line(610, 1, [
          [0.15, 'FECHA'],
          [0.35, 'DETALLE'],
          [0.55, 'DEBITO'],
          [0.72, 'CREDITO'],
        ]),
        line(590, 1, [
          [0.2, '01/07/2026'],
          [0.35, 'MOVIMIENTO'],
          [0.55, '50.000,00'],
          [0.72, '10.000,00'],
        ]),
      ];

      const result = parseStatementLines(lines, TransactionTypeEnum.INCOME);
      expect(result.transactions[0]).toMatchObject({
        amount: 50000,
        type: TransactionTypeEnum.INCOME,
      });
    });

    it('débito y crédito en la misma fila sin defaultType → gasto', () => {
      const lines: TextLine[] = [
        line(610, 1, [
          [0.15, 'FECHA'],
          [0.35, 'DETALLE'],
          [0.55, 'DEBITO'],
          [0.72, 'CREDITO'],
        ]),
        line(590, 1, [
          [0.2, '01/07/2026'],
          [0.35, 'MOVIMIENTO'],
          [0.55, '50.000,00'],
          [0.72, '10.000,00'],
        ]),
      ];

      const result = parseStatementLines(lines);
      expect(result.transactions[0]).toMatchObject({
        amount: 50000,
        type: TransactionTypeEnum.EXPENSE,
      });
    });

    it('montos en cero con cabeceras no generan transacción', () => {
      const lines: TextLine[] = [
        line(610, 1, [
          [0.15, 'FECHA'],
          [0.35, 'DETALLE'],
          [0.55, 'DEBITO'],
          [0.72, 'CREDITO'],
        ]),
        line(590, 1, [
          [0.2, '01/07/2026'],
          [0.35, 'AJUSTE'],
          [0.55, '0,00'],
        ]),
      ];

      const result = parseStatementLines(lines);
      expect(result.transactions).toHaveLength(0);
    });

    it('heurística sin cabeceras: [débito, crédito, saldo]', () => {
      const lines: TextLine[] = [
        line(590, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'COMPRA MERCADO'],
          [0.5, '50.000,00'],
          [0.7, '120.000,00'],
          [0.9, '1.000.000,00'],
        ]),
      ];

      const result = parseStatementLines(lines);
      expect(result.transactions[0]).toMatchObject({
        amount: 50000,
        type: TransactionTypeEnum.EXPENSE,
        balance: 1000000,
      });

      const income = parseStatementLines(lines, TransactionTypeEnum.INCOME);
      expect(income.transactions[0]).toMatchObject({
        amount: 50000,
        type: TransactionTypeEnum.INCOME,
        balance: 1000000,
      });
    });

    it('heurística: solo débito o solo crédito', () => {
      const debit = parseStatementLines([
        line(590, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'COMPRA'],
          [0.5, '50.000,00'],
          [0.7, '0,00'],
          [0.9, '1.000.000,00'],
        ]),
      ]);
      expect(debit.transactions[0]).toMatchObject({
        amount: 50000,
        type: TransactionTypeEnum.EXPENSE,
        balance: 1000000,
      });

      const credit = parseStatementLines([
        line(590, 1, [
          [0.15, '02/07/2026'],
          [0.35, 'CONSIGNACION'],
          [0.5, '0,00'],
          [0.7, '120.000,00'],
          [0.9, '1.000.000,00'],
        ]),
      ]);
      expect(credit.transactions[0]).toMatchObject({
        amount: 120000,
        type: TransactionTypeEnum.INCOME,
        balance: 1000000,
      });
    });

    it('heurística sin débito ni crédito cae al último monto', () => {
      const result = parseStatementLines([
        line(590, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'SALDO'],
          [0.5, '0,00'],
          [0.7, '0,00'],
          [0.9, '1.000.000,00'],
        ]),
      ]);
      expect(result.transactions[0]).toMatchObject({
        amount: 1000000,
        type: TransactionTypeEnum.EXPENSE,
      });
    });

    it('monto único sin señales → gasto por defecto', () => {
      const result = parseStatementLines([
        line(590, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'TRANSFERENCIA'],
          [0.5, '500.000,00'],
        ]),
      ]);
      expect(result.transactions[0]).toMatchObject({
        amount: 500000,
        type: TransactionTypeEnum.EXPENSE,
      });

      const income = parseStatementLines(
        [
          line(590, 1, [
            [0.15, '01/07/2026'],
            [0.35, 'TRANSFERENCIA'],
            [0.5, '500.000,00'],
          ]),
        ],
        TransactionTypeEnum.INCOME,
      );
      expect(income.transactions[0].type).toBe(TransactionTypeEnum.INCOME);
    });

    it('monto negativo y flags CR/DB', () => {
      const negative = parseStatementLines([
        line(590, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'RETIRO'],
          [0.5, '-500.000,00'],
        ]),
      ]);
      expect(negative.transactions[0]).toMatchObject({
        amount: 500000,
        type: TransactionTypeEnum.EXPENSE,
      });

      const db = parseStatementLines([
        line(590, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'MOVIMIENTO'],
          [0.5, '500.000,00 DB'],
        ]),
      ]);
      expect(db.transactions[0].type).toBe(TransactionTypeEnum.EXPENSE);

      const cr = parseStatementLines([
        line(590, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'MOVIMIENTO'],
          [0.5, '500.000,00 CR'],
        ]),
      ]);
      expect(cr.transactions[0].type).toBe(TransactionTypeEnum.INCOME);
    });

    it('monto cero se omite', () => {
      const result = parseStatementLines([
        line(590, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'AJUSTE'],
          [0.5, '0,00'],
        ]),
      ]);
      expect(result.transactions).toHaveLength(0);
    });

    it('clasifica por palabras clave de gasto e ingreso', () => {
      const gasto = parseStatementLines([
        line(590, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'PAGO DE TARJETA'],
          [0.5, '500.000,00'],
        ]),
      ]);
      expect(gasto.transactions[0].type).toBe(TransactionTypeEnum.EXPENSE);

      const ingreso = parseStatementLines([
        line(590, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'CONSIGNACION BANCARIA'],
          [0.5, '500.000,00'],
        ]),
      ]);
      expect(ingreso.transactions[0].type).toBe(TransactionTypeEnum.INCOME);
    });
  });

  describe('Parser genérico - continuaciones y ruido', () => {
    it('fusiona la continuación de descripción con montos', () => {
      const result = parseStatementLines([
        line(610, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'COMPRA'],
          [0.5, '50.000,00'],
        ]),
        line(600, 1, [
          [0.35, 'CUOTA 2'],
          [0.5, '10.000,00'],
        ]),
      ]);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        description: 'COMPRA CUOTA 2',
        amount: 10000,
      });
    });

    it('acumula descripción sin montos y la adjunta al siguiente movimiento', () => {
      const result = parseStatementLines([
        line(610, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'COMPRA'],
          [0.5, '50.000,00'],
        ]),
        line(600, 1, [[0.35, 'CUOTA 2 DE 12']]),
        line(590, 1, [
          [0.15, '05/07/2026'],
          [0.35, 'ABONO'],
          [0.5, '20.000,00'],
        ]),
      ]);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].description).toBe('COMPRA CUOTA 2 DE 12');
    });

    it('omite líneas de resumen, ruido y líneas vacías', () => {
      const result = parseStatementLines([
        line(700, 1, []),
        line(610, 1, [
          [0.35, 'SALDO INICIAL'],
          [0.5, '100.000,00'],
        ]),
        line(600, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'COMPRA'],
          [0.5, '50.000,00'],
        ]),
        line(590, 1, [
          [0.35, 'TOTAL DEBITOS'],
          [0.5, '200.000,00'],
        ]),
      ]);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('COMPRA');
    });

    it('línea con fecha pero sin montos se trata como cabecera', () => {
      const result = parseStatementLines([
        line(610, 1, [
          [0.15, '05/07/2026'],
          [0.35, 'DETALLE DE CUENTA'],
        ]),
      ]);
      expect(result.transactions).toHaveLength(0);
    });

    it('fecha con texto en el mismo token (resto de fecha)', () => {
      const result = parseStatementLines([
        line(610, 1, [
          [0.15, '01/07/2026 COMPRA'],
          [0.5, '50.000,00'],
        ]),
      ]);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('COMPRA');
    });

    it('continuación con token numérico no parseable se descarta', () => {
      const result = parseStatementLines([
        line(610, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'COMPRA'],
          [0.5, '50.000,00'],
        ]),
        line(600, 1, [[0.5, '123DB']]),
      ]);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('COMPRA');
    });

    it('extrae referencias tipo REF / # del texto', () => {
      const result = parseStatementLines([
        line(610, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'COMPRA REF: A123'],
          [0.5, '50.000,00'],
        ]),
      ]);
      expect(result.transactions[0]).toMatchObject({
        reference: 'REF: A123',
      });

      const hash = parseStatementLines([
        line(610, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'PAGO #87654'],
          [0.5, '50.000,00'],
        ]),
      ]);
      expect(hash.transactions[0].reference).toBe('#87654');
    });

    it('token numérico no parseable en fila con fecha se descarta', () => {
      const result = parseStatementLines([
        line(610, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'COMPRA'],
          [0.5, '123DB'],
          [0.6, '50.000,00'],
        ]),
      ]);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        description: 'COMPRA',
        amount: 50000,
      });
    });

    it('texto sin contenido alfanumérico ni espacios se descarta', () => {
      const result = parseStatementLines([
        line(610, 1, [
          [0.15, '01/07/2026'],
          [0.35, 'COMPRA'],
          [0.5, '50.000,00'],
        ]),
        line(600, 1, [[0.35, '!!!']]),
        line(590, 1, [[0.35, '   ']]),
      ]);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('COMPRA');
    });

    it('sin descripción usa Movimiento bancario', () => {
      const result = parseStatementLines([
        line(610, 1, [
          [0.15, '01/07/2026'],
          [0.5, '50.000,00'],
        ]),
      ]);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        description: 'Movimiento bancario',
        amount: 50000,
      });
    });
  });

  describe('extractTextLines (PDF mock)', () => {
    const getDocumentMock = jest.fn();

    beforeEach(() => {
      getDocumentMock.mockReset();
      jest
        .spyOn(pdfjsLoader, 'load')
        .mockResolvedValue({ getDocument: getDocumentMock } as never);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function makeDoc(
      items: Array<{ str?: string; transform?: number[] }>,
      numPages = 1,
    ) {
      return {
        numPages,
        getPage: jest.fn(() => ({
          getTextContent: () =>
            Promise.resolve({
              items: items.map((i) => ({
                str: i.str as string,
                transform: i.transform,
              })),
            }),
        })),
        destroy: jest.fn(),
      };
    }

    it('extrae líneas ordenadas por y y normaliza X', async () => {
      const doc = makeDoc([
        { str: 'FECHA', transform: [1, 0, 0, 1, 0, 100] },
        { str: '   ', transform: [1, 0, 0, 1, 10, 100] },
        { str: 'VALOR', transform: [1, 0, 0, 1, 200, 100] },
        { str: '25/07/2026', transform: [1, 0, 0, 1, 50, 90] },
        { str: 'PAGO', transform: [1, 0, 0, 1, 60, 90] },
        { str: 'SIN X' },
        {},
      ]);
      getDocumentMock.mockReturnValue({ promise: Promise.resolve(doc) });

      const lines = await extractTextLines(Buffer.from('x'));

      const calls = getDocumentMock.mock.calls as unknown as Array<
        Array<{ data: Uint8Array; password?: string }>
      >;
      expect(calls[0][0].data).toBeInstanceOf(Uint8Array);
      expect(lines).toHaveLength(3);
      expect(lines[0].y).toBe(100);
      expect(lines[0].tokens.map((t) => t.text)).toEqual(['FECHA', 'VALOR']);
      expect(lines[0].tokens.map((t) => t.x)).toEqual([0, 1]);
      expect(lines[1].y).toBe(90);
      expect(lines[1].tokens.map((t) => t.text)).toEqual([
        '25/07/2026',
        'PAGO',
      ]);
      expect(lines[2].y).toBe(0);
      expect(lines[2].tokens[0].text).toBe('SIN X');
      expect(doc.destroy).toHaveBeenCalled();
    });

    it('re-lanza PasswordException / errores de contraseña', async () => {
      const err = new Error('contraseña incorrecta');
      err.name = 'PasswordException';
      getDocumentMock.mockReturnValue({ promise: Promise.reject(err) });

      await expect(extractTextLines(Buffer.from('x'))).rejects.toBe(err);
    });

    it('envuelve otros errores de lectura en PDF_READ_ERROR', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.reject(new Error('boom')),
      });

      await expect(extractTextLines(Buffer.from('x'))).rejects.toThrow(
        'PDF_READ_ERROR: Error: boom',
      );
    });

    it('envuelve errores sin nombre ni mensaje', async () => {
      const err = new Error('boom');
      err.name = undefined as unknown as string;
      err.message = undefined as unknown as string;
      getDocumentMock.mockReturnValue({ promise: Promise.reject(err) });

      await expect(extractTextLines(Buffer.from('x'))).rejects.toThrow(
        'PDF_READ_ERROR: : Error',
      );
    });

    it('libera el documento si la extracción de página falla (finally)', async () => {
      const doc = makeDoc([]);
      (doc.getPage as jest.Mock).mockRejectedValue(new Error('page fail'));
      getDocumentMock.mockReturnValue({ promise: Promise.resolve(doc) });

      await expect(extractTextLines(Buffer.from('x'))).rejects.toThrow(
        'page fail',
      );
      expect(doc.destroy).toHaveBeenCalled();
    });

    it('funciona si el documento no expone destroy', async () => {
      const doc = {
        numPages: 1,
        getPage: jest.fn(() => ({
          getTextContent: () => Promise.resolve({ items: [] }),
        })),
      };
      getDocumentMock.mockReturnValue({ promise: Promise.resolve(doc) });

      const lines = await extractTextLines(Buffer.from('x'));
      expect(lines).toEqual([]);
    });
  });

  describe('parsePdfStatement (PDF mock)', () => {
    const getDocumentMock = jest.fn();

    beforeEach(() => {
      getDocumentMock.mockReset();
      jest
        .spyOn(pdfjsLoader, 'load')
        .mockResolvedValue({ getDocument: getDocumentMock } as never);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('extrae y parsea un PDF sencillo pasando la contraseña', async () => {
      getDocumentMock.mockReturnValue({
        promise: Promise.resolve({
          numPages: 1,
          getPage: jest.fn(() => ({
            getTextContent: () =>
              Promise.resolve({
                items: [
                  { str: '01/07/2026', transform: [1, 0, 0, 1, 10, 100] },
                  { str: 'PAGO', transform: [1, 0, 0, 1, 30, 100] },
                  { str: '50.000,00', transform: [1, 0, 0, 1, 50, 100] },
                ],
              }),
          })),
          destroy: jest.fn(),
        }),
      });

      const result = await parsePdfStatement(
        Buffer.from('pdf-bytes'),
        'clave123',
      );

      const calls = getDocumentMock.mock.calls as unknown as Array<
        Array<{ data: Uint8Array; password?: string }>
      >;
      expect(calls[0][0].password).toBe('clave123');
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        transaction_date: '2026-07-01',
        description: 'PAGO',
        amount: 50000,
      });
    });
  });
});
