declare module "pdf-parse" {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
    text: string;
  }

  interface PDFOptions {
    password?: string;
    max?: number;
    pagerender?: (pageData: unknown) => Promise<string>;
  }

  function pdf(buffer: Buffer, options?: PDFOptions): Promise<PDFData>;
  export = pdf;
}
