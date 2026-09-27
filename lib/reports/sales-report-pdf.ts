import PDFDocument from "pdfkit/js/pdfkit.standalone";

import type {
  ExportCollection,
  ExportSale,
  SalesExportData,
} from "@/lib/shop/report-export";
import { dateKey } from "@/lib/shop/report-range";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export async function renderSalesReportPdf(
  data: SalesExportData,
  shopName: string,
  generatedAt: Date = new Date(),
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];

  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const cursor = new Cursor(doc);

  cursor.title(shopName, data.range.label, data.range.fromKey, data.range.toKey, generatedAt);
  cursor.section("Sales summary");
  cursor.summaryRow("Total revenue", money(data.totalRevenue));
  cursor.summaryRow("Total cost", money(data.totalCost));
  cursor.summaryRow("Gross profit", money(data.totalProfit));
  cursor.summaryRow("Transactions", String(data.sales.length));

  cursor.section("Sales details");
  for (const sale of data.sales) {
    cursor.sale(sale);
  }

  cursor.section("Product summary");
  const products = aggregateProducts(data.sales);
  if (products.length === 0) {
    cursor.muted("No active sales in this period.");
  } else {
    cursor.tableHeader("Product", "Qty", "Revenue");
    for (const product of products) {
      cursor.tableRow(product.productName, String(product.quantity), money(product.revenue));
    }
  }

  cursor.section("Collections summary");
  cursor.summaryRow(
    "Total collected",
    money(data.collections.reduce((sum, payment) => sum + payment.amount, 0)),
  );
  cursor.summaryRow("Payment entries", String(data.collections.length));
  for (const collection of data.collections) {
    cursor.collection(collection);
  }

  cursor.section("Outstanding credit");
  if (data.credits.length === 0) {
    cursor.muted("No outstanding credit in this period.");
  } else {
    for (const credit of data.credits) {
      cursor.summaryRow(credit.customerName, money(credit.outstanding));
    }
  }

  // Add page numbers after the content is complete, without storing a PDF
  // anywhere. PDFKit's buffered pages let us annotate every generated page.
  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index += 1) {
    doc.switchToPage(pages.start + index);
    doc
      .fontSize(8)
      .fillColor("#64748b")
      .text(`Page ${index + 1} of ${pages.count}`, MARGIN, PAGE_HEIGHT - 24, {
        width: CONTENT_WIDTH,
        align: "right",
      });
  }

  doc.end();
  return result;
}

type ProductSummary = {
  productName: string;
  quantity: number;
  revenue: number;
};

function aggregateProducts(sales: ExportSale[]): ProductSummary[] {
  const products = new Map<string, ProductSummary>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const existing = products.get(item.productName) ?? {
        productName: item.productName,
        quantity: 0,
        revenue: 0,
      };

      existing.quantity += item.quantity;
      existing.revenue += item.revenue;
      products.set(item.productName, existing);
    }
  }

  return [...products.values()].sort((a, b) => b.revenue - a.revenue);
}

function money(value: number): string {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function displayDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "—";
}

class Cursor {
  constructor(private readonly doc: PDFKit.PDFDocument) {}

  title(
    shopName: string,
    period: string,
    from: string,
    to: string,
    generatedAt: Date,
  ) {
    this.doc.fontSize(18).fillColor("#0f172a").text("Sales report");
    this.doc.moveDown(0.25);
    this.doc.fontSize(12).text(shopName);
    this.doc.fontSize(10).fillColor("#475569").text(`${period}: ${from} to ${to}`);
    this.doc.text(`Generated: ${displayDate(generatedAt.toISOString())}`);
    this.doc.moveDown(0.8);
  }

  section(title: string) {
    this.ensure(36);
    this.doc.moveDown(0.55);
    this.doc.fontSize(12).fillColor("#0f172a").text(title, { underline: true });
    this.doc.moveDown(0.25);
  }

  summaryRow(label: string, value: string) {
    this.ensure(20);
    this.doc.fontSize(9).fillColor("#334155").text(label, MARGIN, this.doc.y, {
      width: CONTENT_WIDTH * 0.62,
    });
    this.doc.fontSize(9).fillColor("#0f172a").text(value, MARGIN + CONTENT_WIDTH * 0.62, this.doc.y - 10, {
      width: CONTENT_WIDTH * 0.38,
      align: "right",
    });
    this.doc.moveDown(0.2);
  }

  sale(sale: ExportSale) {
    this.ensure(110);
    this.doc.fontSize(10).fillColor("#0f172a").text(
      `${displayDate(sale.saleDate)} · Sale ${sale.id.slice(0, 8)}`,
    );
    this.doc.fontSize(9).fillColor("#475569").text(
      `Customer: ${sale.customerName ?? "Walk-in"} · Status: ${sale.paymentStatus} · Total: ${money(sale.total)}`,
    );
    this.doc.text(`Paid: ${money(sale.paid)} · Remaining: ${money(sale.outstanding)}`);
    for (const item of sale.items) {
      this.doc.text(
        `  ${item.productName} · ${item.quantity} × ${money(item.sellingPrice)} = ${money(item.revenue)}`,
        { indent: 8 },
      );
    }
    this.doc.moveDown(0.3);
  }

  tableHeader(first: string, second: string, third: string) {
    this.ensure(18);
    this.doc.fontSize(9).fillColor("#0f172a").text(`${first}    ${second}    ${third}`);
    this.doc.moveDown(0.15);
  }

  tableRow(first: string, second: string, third: string) {
    this.ensure(18);
    this.doc.fontSize(9).fillColor("#334155").text(`${first}    ${second}    ${third}`);
    this.doc.moveDown(0.12);
  }

  collection(payment: ExportCollection) {
    this.ensure(42);
    const earlier =
      payment.saleDate && dateKey(new Date(payment.saleDate)) !== dateKey(new Date(payment.collectedAt));
    this.doc.fontSize(9).fillColor("#334155").text(
      `${displayDate(payment.collectedAt)} · ${money(payment.amount)} · ${payment.customerName ?? "Walk-in"}`,
    );
    this.doc.text(`Against sale ${payment.saleId.slice(0, 8)} · Sale date: ${displayDate(payment.saleDate)}`);
    if (earlier) {
      this.doc.fillColor("#b45309").text("Earlier sale payment");
    }
    this.doc.moveDown(0.25);
  }

  muted(text: string) {
    this.ensure(18);
    this.doc.fontSize(9).fillColor("#64748b").text(text);
  }

  private ensure(height: number) {
    if (this.doc.y + height > PAGE_HEIGHT - MARGIN - 24) {
      this.doc.addPage();
    }
  }
}
