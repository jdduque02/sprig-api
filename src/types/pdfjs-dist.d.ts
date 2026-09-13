/**
 * Declaración mínima de `pdfjs-dist` (v4, build "legacy" para Node.js) para
 * extracción de texto. El paquete es ESM-only desde la v4, por lo que se
 * carga con `import()` dinámico real (ver `bank-statement-parser.ts`); esta
 * declaración solo cubre el subconjunto de la API que usamos.
 */
declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export interface PDFTextItem {
    str: string;
    width?: number;
    height?: number;
    transform: number[];
  }

  export interface PDFTextContent {
    items: PDFTextItem[];
  }

  export interface PDFPageProxy {
    getTextContent(): Promise<PDFTextContent>;
  }

  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
    destroy(): Promise<void>;
  }

  export interface GetDocumentParams {
    data: Uint8Array;
    password?: string;
    standardFontDataUrl?: string;
  }

  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }

  export class PasswordException extends Error {}

  export const version: string;

  export function getDocument(
    params: GetDocumentParams,
  ): PDFDocumentLoadingTask;
}
