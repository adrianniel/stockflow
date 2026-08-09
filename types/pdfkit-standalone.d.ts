declare module "pdfkit/js/pdfkit.standalone" {
  const PDFDocument: {
    new (options?: PDFKit.PDFDocumentOptions): PDFKit.PDFDocument;
  };

  export default PDFDocument;
}
