import { formatMoney } from "@/lib/format";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const PRIMARY = "#ee161f";

interface InvoiceLineItem {
  name: string;
  rate: number;
  quantity: number;
}

interface InvoiceData {
  customerName?: string;
  customerPhone?: string | null;
  items: InvoiceLineItem[];
  totalAmount: number;
}

function invoiceItemRow(item: InvoiceLineItem, index: number): string {
  const lineTotal = item.rate * item.quantity;
  return `
    <tr>
      <td class="qty">${index + 1}</td>
      <td class="name">${escapeHtml(item.name)}</td>
      <td class="num">${item.quantity} × ${formatMoney(item.rate).replace(/[^\d.,]/g, "")}</td>
      <td class="num">${formatMoney(lineTotal).replace(/[^\d.,]/g, "")}</td>
    </tr>`;
}

function buildInvoiceHtml(data: InvoiceData): string {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const rows = data.items.map(invoiceItemRow).join("");
  const customerMeta = data.customerName
    ? `<p class="cust">Billed To: <strong>${escapeHtml(data.customerName)}</strong>${
        data.customerPhone
          ? ` <span class="muted">(${escapeHtml(data.customerPhone)})</span>`
          : ""
      }</p>`
    : "";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #1f2937;
        margin: 0;
        padding: 32px;
        font-size: 13px;
        line-height: 1.5;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 3px solid ${PRIMARY};
        padding-bottom: 16px;
      }
      .brand { color: ${PRIMARY}; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
      .brand-sub { color: #6b7280; font-size: 11px; margin-top: 2px; text-transform: uppercase; letter-spacing: 1px; }
      .doc-title { text-align: right; }
      .doc-title h1 { margin: 0; font-size: 20px; color: #111827; }
      .doc-title p { margin: 4px 0 0; color: #6b7280; font-size: 12px; }
      .meta { margin: 18px 0 22px; }
      .cust { margin: 0; font-size: 13px; }
      .muted { color: #6b7280; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      th {
        text-align: left;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #6b7280;
        border-bottom: 2px solid #e5e7eb;
        padding: 8px 6px;
      }
      td { padding: 10px 6px; border-bottom: 1px solid #f1f1f4; vertical-align: top; }
      td.num, th.num { text-align: right; }
      td.name { font-weight: 600; }
      td.qty { color: #6b7280; width: 28px; }
      .totals {
        margin-top: 18px;
        display: flex;
        justify-content: flex-end;
      }
      .totals-box {
        min-width: 240px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        overflow: hidden;
      }
      .totals-row { display: flex; justify-content: space-between; padding: 10px 14px; }
      .totals-row.grand {
        background: ${PRIMARY};
        color: #fff;
        font-weight: 800;
        font-size: 15px;
      }
      .totals-row span:last-child { font-variant-numeric: tabular-nums; }
      .footer {
        margin-top: 28px;
        text-align: center;
        color: #9ca3af;
        font-size: 11px;
        border-top: 1px solid #f1f1f4;
        padding-top: 14px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="brand">HalKhata</div>
        <div class="brand-sub">Digital Ledger</div>
      </div>
      <div class="doc-title">
        <h1>INVOICE</h1>
        <p>Date: ${today}</p>
      </div>
    </div>

    <div class="meta">${customerMeta}</div>

    <table>
      <thead>
        <tr>
          <th class="qty">#</th>
          <th>Item</th>
          <th class="num">Rate</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="totals-row grand">
          <span>Total Amount</span>
          <span>${formatMoney(data.totalAmount).replace(/[^\d.,]/g, "")}</span>
        </div>
      </div>
    </div>

    <div class="footer">Thank you for your business!</div>
  </body>
</html>`;
}

function buildReminderHtml(params: {
  customerName: string;
  customerPhone?: string | null;
  balance: number;
}): string {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const phoneLine = params.customerPhone
    ? `<p class="muted">Contact: ${escapeHtml(params.customerPhone)}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #1f2937;
        margin: 0;
        padding: 32px;
        font-size: 13px;
        line-height: 1.6;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 3px solid ${PRIMARY};
        padding-bottom: 16px;
      }
      .brand { color: ${PRIMARY}; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
      .brand-sub { color: #6b7280; font-size: 11px; margin-top: 2px; text-transform: uppercase; letter-spacing: 1px; }
      .badge {
        background: ${PRIMARY};
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 6px 12px;
        border-radius: 999px;
      }
      .body { margin-top: 24px; }
      p { margin: 0 0 12px; }
      .muted { color: #6b7280; font-size: 12px; }
      .amount-card {
        margin: 22px 0;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 12px;
        padding: 18px 20px;
      }
      .amount-label { color: #b91c1c; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
      .amount-value { color: ${PRIMARY}; font-size: 30px; font-weight: 800; margin-top: 4px; font-variant-numeric: tabular-nums; }
      .footer {
        margin-top: 28px;
        text-align: center;
        color: #9ca3af;
        font-size: 11px;
        border-top: 1px solid #f1f1f4;
        padding-top: 14px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="brand">HalKhata</div>
        <div class="brand-sub">Reminder</div>
      </div>
      <div class="badge">Due</div>
    </div>

    <div class="body">
      <p>Dear <strong>${escapeHtml(params.customerName)}</strong>,</p>
      <p>This is a gentle reminder that the following amount is pending on your account with us.</p>

      <div class="amount-card">
        <div class="amount-label">Pending Balance</div>
        <div class="amount-value">${formatMoney(params.balance)}</div>
      </div>

      <p>Please clear the outstanding balance at your earliest convenience. We appreciate your continued trust in us.</p>
      ${phoneLine}
      <p class="muted">Issued on ${today}</p>
    </div>

    <div class="footer">Thank you — HalKhata</div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function printAndShare(html: string, filename: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: filename,
    UTI: "com.adobe.pdf",
  });
}

export async function shareInvoicePdf(data: InvoiceData): Promise<void> {
  const html = buildInvoiceHtml(data);
  await printAndShare(html, "HalKhata Invoice.pdf");
}

export async function shareReminderPdf(params: {
  customerName: string;
  customerPhone?: string | null;
  balance: number;
}): Promise<void> {
  const html = buildReminderHtml(params);
  await printAndShare(html, `Reminder - ${params.customerName}.pdf`);
}
