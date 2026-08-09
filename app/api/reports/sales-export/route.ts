import { requireRole } from "@/lib/auth/guards";
import {
  getSalesExportData,
  parseExportRange,
} from "@/lib/shop/report-export";
import { shopContextFor } from "@/lib/shop/context";
import { renderSalesReportPdf } from "@/lib/reports/sales-report-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await requireRole("OWNER", "ASSISTANT");
  const context = await shopContextFor(profile);
  const url = new URL(request.url);
  const range = parseExportRange(
    url.searchParams.get("period"),
    url.searchParams.get("date"),
  );

  if (!range) {
    return new Response("Choose a valid daily, weekly, or monthly report period.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const data = await getSalesExportData(context, range);
  const pdf = await renderSalesReportPdf(data, profile.shop_name ?? "StockFlow");
  const filename = `sales-report-${range.fromKey}-${range.toKey}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
