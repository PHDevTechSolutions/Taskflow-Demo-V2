import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

// Decode common HTML entities
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

// Parse description string (HTML or plain text) into [label, value] rows
function parseDescriptionToRows(description: string): string[][] {
  let clean = description
    .replace(/\|\|/g, "\n") // treat || as new row
    .replace(/<br\s*\/?>/gi, "\n") // convert <br> to newline
    .replace(/<\/?[^>]+(>|$)/g, ""); // strip all HTML tags

  clean = decodeEntities(clean);

  const lines = clean.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);

  const rows: string[][] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const label = lines[i];
    const value = lines[i + 1] || "";
    rows.push([label, value]);
  }
  return rows;
}

function clearBordersAndSetWhiteFill(sheet: ExcelJS.Worksheet, rowNumber: number, startCol = 1, endCol = 6) {
  const row = sheet.getRow(rowNumber);
  for (let col = startCol; col <= endCol; col++) {
    const cell = row.getCell(col);
    cell.border = {};
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFFF" }, // white background
    };
  }
}

// Helper to add footer rows with merged cells from col 3 to 6
function addFooterRow(
  sheet: ExcelJS.Worksheet,
  content: string | ExcelJS.RichText[],
  rowHeight: number = 30   // ✅ default row height = 30
) {
  // Insert a row with empty col 1 and 2, content in col 3
  const row = sheet.addRow(["", "", ""]);

  // Merge col 3 to 6 on this row
  sheet.mergeCells(row.number, 3, row.number, 6);

  const cell = row.getCell(3);

  if (typeof content === "string") {
    cell.value = content;
  } else if (Array.isArray(content)) {
    cell.value = { richText: content };
  } else {
    cell.value = String(content);
  }

  cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };

  // ✅ Apply row height (always at least 30)
  row.height = rowHeight;
}

function setBorderForRow(sheet: ExcelJS.Worksheet, rowNumber: number, startCol = 1, endCol = 6) {
  const borderStyle: ExcelJS.BorderStyle = "thin";
  const borderColor = { argb: "FF000000" };
  const row = sheet.getRow(rowNumber);
  for (let col = startCol; col <= endCol; col++) {
    const cell = row.getCell(col);
    cell.border = {
      top: { style: borderStyle, color: borderColor },
      left: { style: borderStyle, color: borderColor },
      bottom: { style: borderStyle, color: borderColor },
      right: { style: borderStyle, color: borderColor },
    };
  }
}

export async function POST(req: Request) {
  const data = await req.json();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Quotation");

  const imagePath = path.resolve("./public/ecoshift-banner.png");
  const imageBuffer = fs.readFileSync(imagePath);

  // Add image to workbook
  const imageId = workbook.addImage({
    buffer: imageBuffer.buffer,
    extension: "png",
  });

  // Add an empty row for spacing (optional)
  addFooterRow(sheet, "");

  // Place image spanning columns 1 to 6, with explicit size to fit row height 80
  sheet.addImage(imageId, {
    tl: { col: 0, row: 0 } as any,
    ext: { width: 900, height: 90 },
  });

  // Set the height of row 1 to fit the image height
  sheet.getRow(1).height = 90;

  // Clear borders and set white background fill on row 1 only
  clearBordersAndSetWhiteFill(sheet, 1);

  const refRow = sheet.addRow([""]);
  sheet.mergeCells(refRow.number, 1, refRow.number, 6);  // merge entire row
  const refCell = refRow.getCell(1);
  refCell.value = {
    richText: [
      { text: "Reference No: ", font: { bold: true } },
      { text: data.referenceNo.toUpperCase() }
    ]
  };
  refCell.alignment = { horizontal: "right", vertical: "middle" };
  clearBordersAndSetWhiteFill(sheet, refRow.number);

  // Date
  const dateRow = sheet.addRow([""]);
  sheet.mergeCells(dateRow.number, 1, dateRow.number, 6);  // merge entire row
  const dateCell = dateRow.getCell(1);
  dateCell.value = {
    richText: [
      { text: "Date: ", font: { bold: true } },
      { text: data.date }
    ]
  };

  dateCell.alignment = { horizontal: "right", vertical: "middle" };
  clearBordersAndSetWhiteFill(sheet, dateRow.number);

  addFooterRow(sheet, "");

  const companyInfo = [
    { label: "COMPANY NAME: ", value: data.companyName },
    { label: "ADDRESS: ", value: data.address },
    { label: "TEL NO: ", value: data.telNo },
    { label: "EMAIL ADDRESS: ", value: data.email },
    { label: "ATTENTION: ", value: data.attention },
    { label: "SUBJECT: ", value: data.subject },
  ];

  companyInfo.forEach(({ label, value }, index) => {
    const row = sheet.addRow([
      {
        richText: [
          { text: label, font: { bold: true } },
          { text: value },
        ],
      },
    ]);
    sheet.mergeCells(row.number, 1, row.number, 6);

    const cell = row.getCell(1);
    cell.alignment = {
      vertical: "top",
      horizontal: "left",
      wrapText: true,
    };

    // Set row height for padding
    row.height = 30;

    // Define border style and color
    const borderStyle: ExcelJS.BorderStyle = "thin";
    const borderColor = { argb: "FF000000" };

    // Borders object, default no border
    let border = {};

    // Add top border only for first row (COMPANY NAME)
    if (index === 0) {
      border = {
        top: { style: borderStyle, color: borderColor },
      };
    }

    // Add bottom border for EMAIL ADDRESS (index 3) and SUBJECT (index 5)
    if (index === 3 || index === 5) {
      border = {
        ...border,
        bottom: { style: borderStyle, color: borderColor },
      };
    }

    // Apply border to all cells in the row (cols 1 to 6)
    for (let col = 1; col <= 6; col++) {
      row.getCell(col).border = border;
    }
  });

  addFooterRowFullWidth(sheet, "We are pleased to offer you the following products for consideration:");
  // Table header
  const headerRow = sheet.addRow([
    "ITEM NO",
    "QTY",
    "REFERENCE PHOTO",
    "PRODUCT DESCRIPTION",
    "DISCOUNTED UNIT PRICE",
    "TOTAL AMOUNT",
  ]);

  // Set header row height to 30
  headerRow.height = 30;

  // Center-align all header cells and set bold font
  headerRow.eachCell((cell) => {
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.font = { bold: true };
  });

  setBorderForRow(sheet, headerRow.number);

  // Items with images + description table
  for (const item of data.items) {
    const row = sheet.addRow([
      item.itemNo,
      item.qty,
      "", // placeholder for image
      "", // description placeholder
      item.unitPrice,
      item.totalAmount,
    ]);

    // Description processing (same as before)
    const descriptionRows = parseDescriptionToRows(item.description);
    const combined = descriptionRows.map(r => r.join(": ")).join("\n");
    const descCell = sheet.getRow(row.number).getCell(4);
    descCell.value = combined;
    descCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };

    const minHeight = 15;
    const lineHeight = 15;
    const lineCount = combined.split("\n").length;
    row.height = Math.max(minHeight, lineCount * lineHeight);

    // Image handling with dynamic width
    try {
      const res = await fetch(item.referencePhoto);
      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      const imageId = workbook.addImage({
        base64: `data:image/png;base64,${base64}`,
        extension: "png",
      });

      const columnWidthInChars = sheet.getColumn(3).width || 20; // col 3 is index 3 (1-based)
      const estimatedPixelWidth = columnWidthInChars * 7;

      // Adjust aspect ratio if you know the original size, else keep fixed height
      const originalImageWidth = 100;
      const originalImageHeight = 100;
      const aspectRatio = originalImageHeight / originalImageWidth;
      const imageWidth = estimatedPixelWidth;
      const imageHeight = imageWidth * aspectRatio;

      sheet.addImage(imageId, {
        tl: { col: 2, row: row.number - 1 },
        ext: { width: imageWidth, height: imageHeight },
      });

      // Adjust row height to fit image and description
      row.height = Math.max(row.height || 0, imageHeight / 1.33);
    } catch (err) {
      console.error(`Failed to load image for item ${item.itemNo}:`, err);
    }

    setBorderForRow(sheet, row.number);
  }

  const vatOptions = ["VAT Inc", "VAT Exe", "Zero-Rated"];

  const vatRowValues = vatOptions.map(option => {
    return option === data.vatType ? "● " + option : "○ " + option;
  });

  const vatAndTotalRow = sheet.addRow([
    "", // col 1
    "", // col 2
    "", // placeholder for col 3 richText
    vatRowValues.join("    "), // col 4
    {
      richText: [
        { text: "Total Price: ", font: { bold: true } },
        { text: `${data.totalPrice.toFixed(2)}` }
      ]
    }, // col 5
    "" // col 6 placeholder for merge
  ]);

  // Set richText with bold and red font to col 3 cell
  vatAndTotalRow.getCell(3).value = {
    richText: [
      {
        text: "Choose One:",
        font: { bold: true, color: { argb: "FFFF0000" } }, // red and bold
      },
    ],
  };

  sheet.mergeCells(vatAndTotalRow.number, 5, vatAndTotalRow.number, 6);

  vatAndTotalRow.getCell(3).alignment = { horizontal: "left", vertical: "middle" };
  vatAndTotalRow.getCell(4).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  vatAndTotalRow.getCell(5).alignment = { horizontal: "right", vertical: "middle" };

  // Set height to 30
  vatAndTotalRow.height = 30;

  // Add bottom border to all cells
  const borderStyle: ExcelJS.BorderStyle = "thin";
  const borderColor = { argb: "FF000000" };

  for (let col = 1; col <= 6; col++) {
    const cell = vatAndTotalRow.getCell(col);
    const existingBorder = cell.border || {};
    cell.border = {
      ...existingBorder,
      bottom: { style: borderStyle, color: borderColor },
    };
  }

  // Modified helper: merge from col 1 to 6 instead of 3 to 6
  function addFooterRowFullWidth(
    sheet: ExcelJS.Worksheet,
    content: string,
    rowHeight: number = 30
  ) {
    const row = sheet.addRow([""]);
    sheet.mergeCells(row.number, 1, row.number, 6);

    const cell = row.getCell(1);
    cell.value = content;
    cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };

    row.height = rowHeight;

    // ✅ ONLY THIS SPECIFIC TEXT GETS TOP BORDER
    if (content.startsWith("Thank you for allowing us to service your requirements")) {
      cell.border = {
        top: { style: "thick", color: { argb: "FF0070C0" } } // 🔵 BLUE + THICK BORDER
      };
    }

  }

  addFooterRow(sheet, "");

  // Add all footer rows with rich text support
  addFooterRow(sheet, [{ text: "Included:", font: { bold: true } }]);
  addFooterRow(sheet, "- Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000.");
  addFooterRow(sheet, "- Orders outside Metro Manila Free delivery is available for a minimum sales transaction of:");
  addFooterRow(sheet, "  ₱10,000 in Rizal,");
  addFooterRow(sheet, "  ₱15,000 in Bulacan and Cavite,");
  addFooterRow(sheet, "  ₱25,000 in Laguna, Pampanga, and Batangas.");

  addFooterRow(sheet, [{ text: "Excluded:", font: { bold: true } }]);
  addFooterRow(sheet, "- All lamp poles are subject to a delivery charge.");
  addFooterRow(sheet, "- Installation and all hardware/accessories not indicated above.");
  addFooterRow(sheet, "- Freight charges, arrastre, and other processing fees.");

  addFooterRow(sheet, [{ text: "Notes:", font: { bold: true } }]);
  addFooterRow(sheet, "- Deliveries are up to the vehicle unloading point only.");
  addFooterRow(sheet, "- Additional shipping fee applies for other areas not mentioned above.");
  addFooterRow(sheet, "- Subject to confirmation upon getting the actual weight and dimensions of the items.");
  addFooterRow(sheet, "- In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges.");

  addFooterRow(sheet, [{ text: "TERMS AND CONDITIONS:", font: { bold: true } }]);
  addFooterRow(sheet, [{ text: "AVAILABILITY:", font: { bold: true } }]);
  addFooterRow(sheet, "*5-7 days if on stock upon receipt of approved PO.");
  addFooterRow(sheet, "*For items not on stock/indent order, an estimate of 45-60 days upon receipt of approved PO & down payment. ");
  addFooterRow(sheet, "Barring any delay in shipping and customs clearance beyond Ecoshift's control.");
  addFooterRow(sheet, "*In the event of a conflict or inconsistency in estimated days under Availability");
  addFooterRow(sheet, "and another estimate indicated elsewhere in this quotation, ");
  addFooterRow(sheet, "the latter will prevail.");

  addFooterRow(sheet, [{ text: "WARRANTY:", font: { bold: true } }]);
  addFooterRow(sheet, "One (1) year from the time of delivery for all busted lights except the damaged fixture.");
  addFooterRow(sheet, "The warranty will be VOID under the following circumstances:");
  addFooterRow(sheet, "*If the unit is being tampered with.");
  addFooterRow(sheet, "*If the item(s) is/are altered in any way by unauthorized technicians.");
  addFooterRow(sheet, "*If it has been subjected to misuse, mishandling, neglect, or accident.");
  addFooterRow(sheet, "*If damaged due to spillage of liquids, tear corrosion, rusting, or stains.");
  addFooterRow(sheet, "*This warranty does not cover loss of product accessories such as remote control, adaptor, battery, screws, etc.");
  addFooterRow(sheet, "*Shipping costs for warranty claims are for customers' account.");
  addFooterRow(sheet, "*If the product purchased is already phased out when the warranty is claimed, ");
  addFooterRow(sheet, "the latest model or closest product SKU will be given as a replacement.");

  addFooterRow(sheet, [{ text: "SO VALIDITY:", font: { bold: true } }]);
  addFooterRow(sheet, [
    { text: "Sales order has validity period of " },
    { text: "14 working days", font: { bold: true, color: { argb: "FFFF0000" } } },
    { text: "(excluding holidays and Sundays) from the date of issuance." },
  ]);

  addFooterRow(sheet, [
    { text: "Any sales order not confirmed and no verified payment within this " },
    { text: "14-day period", font: { bold: true, color: { argb: "FFFF0000" } } },
    { text: "will be automatically cancelled." },
  ]);

  addFooterRow(sheet, [{ text: "STORAGE:", font: { bold: true } }]);
  addFooterRow(sheet, [{ text: "Orders with confirmation/verified payment but undelivered after 14 working days " }]);
  addFooterRow(sheet, [{ text: "(excluding holidays and Sundays starting from picking date)" }]);
  addFooterRow(sheet, [{ text: "due to clients’ request or shortcomings will be charged a storage fee of 10% of the value of the orders per month " }]);
  addFooterRow(sheet, [{ text: "(10% / 30 days =  0.33% per day)", font: { bold: true, color: { argb: "FFFF0000" } } }]);

  addFooterRow(sheet, [{ text: "RETURN:", font: { bold: true } }]);
  addFooterRow(sheet, [{ text: "7 days return policy", font: { bold: true, color: { argb: "FFFF0000" } } }]);
  addFooterRow(sheet, [{ text: "- if the product received is defective, damaged, or incomplete. This must be communicated to Ecoshift, " }]);
  addFooterRow(sheet, [{ text: "and Ecoshift has duly acknowledged communication as received within a maximum of 7 days to qualify for replacement.", font: { bold: false } }]);

  addFooterRow(sheet, [{ text: "PAYMENT:", font: { bold: true } }]);
  addFooterRow(sheet, "Cash on Delivery (COD)");
  addFooterRow(sheet, "NOTE: Orders below 10,000 pesos can be paid in cash at the time of delivery.");
  addFooterRow(sheet, [
    { text: "Exceeding 10,000 pesos should be transacted through bank deposit or mobile electronic transactions.", font: { bold: true } }
  ]);
  addFooterRow(sheet, [
    { text: "For special items,  Seventy Percent (70%) down payment, 30% upon delivery.", font: { bold: true } }
  ]);

  addFooterRow(sheet, [{ text: "BANK DETAILS", font: { bold: true } }]);
  addFooterRow(sheet, [{ text: "Payee to: ECOSHIFT CORPORATION", font: { bold: true } }]);

  addFooterRow(sheet, [{ text: "Bank: Metrobank", font: { bold: true } }]);
  addFooterRow(sheet, "Account Name: Ecoshift Corporation.");
  addFooterRow(sheet, "Account number: 243-7-243805100");

  addFooterRow(sheet, [{ text: "Bank: BDO", font: { bold: true } }]);
  addFooterRow(sheet, "Account Name: Ecoshift Corporation");
  addFooterRow(sheet, "Account number:  0021-8801-7271");

  addFooterRow(sheet, [{ text: "DELIVERY", font: { bold: true } }]);
  addFooterRow(sheet, "Delivery/Pick up is subject to confirmation.");
  addFooterRow(sheet, "");
  addFooterRow(sheet, [{ text: "VALIDITY", font: { bold: true } }]);
  addFooterRow(sheet, [
    {
      text: "Thirty (30) calendar days from the date of this offer.",
      font: { bold: true, color: { argb: "FFFF0000" } }
    }
  ]);
  addFooterRow(sheet, [
    {
      text: "For special items, Seventy Percent (70%) down payment, 30% upon delivery.",
      font: { bold: true }
    }
  ]);
  addFooterRow(sheet, "In the event of changes in prevailing market conditions, duties, taxes,");
  addFooterRow(sheet, "and all other importation charges, quoted prices are subject to change.");

  addFooterRow(sheet, [{ text: "CANCELLATION:", font: { bold: true } }]);
  addFooterRow(sheet, "1. Above quoted items are non-cancellable.");
  addFooterRow(sheet, "2. If the customer cancels the order under any circumstances, the client");
  addFooterRow(sheet, "shall be responsible for 100% cost incurred by Ecoshift, including freight and delivery charges.");
  addFooterRow(sheet, "3. Downpayment for items not in stock/indent and order/special items are non-refundable");
  addFooterRow(sheet, "and will be forfeited if the order is canceled.");
  addFooterRow(sheet, "4. COD transaction payments should be ready upon delivery.");
  addFooterRow(sheet, "If the payment is not ready within seven (7) days from the date of order, ");
  addFooterRow(sheet, "the transaction is automatically canceled.");
  addFooterRow(sheet, "5. Cancellation for Special Projects (SPF) are not allowed and will be subject to a 100% charge.");

  addFooterRowFullWidth(sheet, "Thank you for allowing us to service your requirements. We hope that the above offer merits your acceptance.");
  addFooterRowFullWidth(sheet, "Unless otherwise indicated in your Approved Purchase Order, you are deemed to have accepted the Terms and Conditions of this Quotation.");


  // === Ecoshift Corporation Inc Footer ===
  addFooterRowFullWidth(sheet, "Ecoshift Corporation");
  addFooterRow(sheet, "");

  // ==================================================================
  // === Sales Representative (LEFT)  +  Company Authorized Rep (RIGHT)
  // ==================================================================

  // 1. Underline Row (left + right in SAME row)
  const rowUnderlineBoth = sheet.addRow([]);

  // LEFT underline
  sheet.mergeCells(rowUnderlineBoth.number, 1, rowUnderlineBoth.number, 3);
  rowUnderlineBoth.getCell(1).value = "_________________________";
  rowUnderlineBoth.getCell(1).alignment = { horizontal: "left" };

  // RIGHT underline
  sheet.mergeCells(rowUnderlineBoth.number, 5, rowUnderlineBoth.number, 6);
  rowUnderlineBoth.getCell(5).value = "_________________________";
  rowUnderlineBoth.getCell(5).alignment = { horizontal: "right" };

  clearBordersAndSetWhiteFill(sheet, rowUnderlineBoth.number);

  // 2. Titles Row (left + right)
  const rowTitleBoth = sheet.addRow([]);

  // LEFT title
  sheet.mergeCells(rowTitleBoth.number, 1, rowTitleBoth.number, 3);
  rowTitleBoth.getCell(1).value = data.salesRepresentative || "";
  rowTitleBoth.getCell(1).alignment = { horizontal: "left" };

  // RIGHT title
  sheet.mergeCells(rowTitleBoth.number, 5, rowTitleBoth.number, 6);
  rowTitleBoth.getCell(5).value = "Company Authorized Representative";
  rowTitleBoth.getCell(5).alignment = { horizontal: "right" };

  clearBordersAndSetWhiteFill(sheet, rowTitleBoth.number);

  // 3. Right-side Note Row (left blank)
  const rowNoteRight = sheet.addRow([]);

  // LEFT blank
  sheet.mergeCells(rowNoteRight.number, 1, rowNoteRight.number, 3);
  rowNoteRight.getCell(1).value = "";

  // RIGHT note
  sheet.mergeCells(rowNoteRight.number, 5, rowNoteRight.number, 6);
  rowNoteRight.getCell(5).value = "(Please Sign Over Printed Name)";
  rowNoteRight.getCell(5).alignment = { horizontal: "right" };

  clearBordersAndSetWhiteFill(sheet, rowNoteRight.number);

  // ==================================================================
  // === Sales Rep Contact Details (UNDER the Sales Representative side)
  // ==================================================================

  // Row: Sales Rep Name
  const rowSalesName = sheet.addRow([]);
  sheet.mergeCells(rowSalesName.number, 1, rowSalesName.number, 3);
  rowSalesName.getCell(1).value = "Sales Representative";
  rowSalesName.getCell(1).alignment = { horizontal: "left" };
  sheet.mergeCells(rowSalesName.number, 5, rowSalesName.number, 6);
  rowSalesName.getCell(5).value = "";
  clearBordersAndSetWhiteFill(sheet, rowSalesName.number);

  // Row: Mobile
  const rowSalesMobile = sheet.addRow([]);
  sheet.mergeCells(rowSalesMobile.number, 1, rowSalesMobile.number, 3);
  rowSalesMobile.getCell(1).value = `Mobile: ${data.salescontact || ""}`;
  rowSalesMobile.getCell(1).alignment = { horizontal: "left" };
  sheet.mergeCells(rowSalesMobile.number, 5, rowSalesMobile.number, 6);
  rowSalesMobile.getCell(5).value = "";
  clearBordersAndSetWhiteFill(sheet, rowSalesMobile.number);

  // Row: Email
  const rowSalesEmail = sheet.addRow([]);
  sheet.mergeCells(rowSalesEmail.number, 1, rowSalesEmail.number, 3);
  rowSalesEmail.getCell(1).value = `Email: ${data.salesemail || ""}`;
  rowSalesEmail.getCell(1).alignment = { horizontal: "left" };
  sheet.mergeCells(rowSalesEmail.number, 5, rowSalesEmail.number, 6);
  rowSalesEmail.getCell(5).value = "";
  clearBordersAndSetWhiteFill(sheet, rowSalesEmail.number);

  addFooterRow(sheet, "");

  // ==================================================================
  // === Approve By & Payment Release Date =============================
  // ==================================================================

  // Underline Row
  const rowUnderline2 = sheet.addRow([]);
  sheet.mergeCells(rowUnderline2.number, 1, rowUnderline2.number, 3);
  sheet.mergeCells(rowUnderline2.number, 5, rowUnderline2.number, 6);
  rowUnderline2.getCell(1).value = "_________________________";
  rowUnderline2.getCell(1).alignment = { horizontal: "left" };
  rowUnderline2.getCell(5).value = "_________________________";
  rowUnderline2.getCell(5).alignment = { horizontal: "right" };
  clearBordersAndSetWhiteFill(sheet, rowUnderline2.number);

  // Title Labels
  const rowApprovePayment = sheet.addRow([]);
  sheet.mergeCells(rowApprovePayment.number, 1, rowApprovePayment.number, 3);
  sheet.mergeCells(rowApprovePayment.number, 5, rowApprovePayment.number, 6);
  rowApprovePayment.getCell(1).value = data.salestsmname || "";
  rowApprovePayment.getCell(1).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };
  rowApprovePayment.getCell(5).value = "Payment Release Date";
  rowApprovePayment.getCell(5).alignment = { horizontal: "right" };
  clearBordersAndSetWhiteFill(sheet, rowApprovePayment.number);

  // Row: TSM Name
  const rowTSMName = sheet.addRow([]);
  sheet.mergeCells(rowTSMName.number, 1, rowTSMName.number, 3);
  rowTSMName.getCell(1).value = "Territory Sales Manager";
  rowTSMName.getCell(1).alignment = { horizontal: "left" };
  sheet.mergeCells(rowTSMName.number, 5, rowTSMName.number, 6);
  rowTSMName.getCell(5).value = "";
  clearBordersAndSetWhiteFill(sheet, rowTSMName.number);
  
  // Sales Manager Contact
  const rowManagerMobile = sheet.addRow([]);
  sheet.mergeCells(rowManagerMobile.number, 1, rowManagerMobile.number, 3);
  rowManagerMobile.getCell(1).value = `Mobile: ${data.salesManagerContact || ""}`;
  rowManagerMobile.getCell(1).alignment = { horizontal: "left" };
  sheet.mergeCells(rowManagerMobile.number, 5, rowManagerMobile.number, 6);
  rowManagerMobile.getCell(5).value = "";
  clearBordersAndSetWhiteFill(sheet, rowManagerMobile.number);

  const rowManagerEmail = sheet.addRow([]);
  sheet.mergeCells(rowManagerEmail.number, 1, rowManagerEmail.number, 3);
  rowManagerEmail.getCell(1).value = `Email: ${data.salesManagerEmail || ""}`;
  rowManagerEmail.getCell(1).alignment = { horizontal: "left" };
  sheet.mergeCells(rowManagerEmail.number, 5, rowManagerEmail.number, 6);
  rowManagerEmail.getCell(5).value = "";
  clearBordersAndSetWhiteFill(sheet, rowManagerEmail.number);

  addFooterRow(sheet, "");

  // === Underline Row 3 ===
  const rowUnderline3 = sheet.addRow([]);
  sheet.mergeCells(rowUnderline3.number, 1, rowUnderline3.number, 3);
  sheet.mergeCells(rowUnderline3.number, 5, rowUnderline3.number, 6);
  rowUnderline3.getCell(1).value = "_________________________";
  rowUnderline3.getCell(1).alignment = { horizontal: "left" };
  rowUnderline3.getCell(5).value = "_________________________";
  rowUnderline3.getCell(5).alignment = { horizontal: "right" };
  clearBordersAndSetWhiteFill(sheet, rowUnderline3.number);

  // Labels Row
  const rowHeadPosition = sheet.addRow([]);
  sheet.mergeCells(rowHeadPosition.number, 1, rowHeadPosition.number, 3);
  sheet.mergeCells(rowHeadPosition.number, 5, rowHeadPosition.number, 6);
  rowHeadPosition.getCell(1).value = `Sales-B2B: ${data.salesmanagername || ""}`;
  rowHeadPosition.getCell(1).alignment = { horizontal: "left" };
  rowHeadPosition.getCell(5).value = "Position in the Company";
  rowHeadPosition.getCell(5).alignment = { horizontal: "right" };
  clearBordersAndSetWhiteFill(sheet, rowHeadPosition.number);

  addFooterRow(sheet, "");
  addFooterRow(sheet, "");
  // Set column widths
  sheet.columns = [
    { width: 10 },
    { width: 10 },
    { width: 20 }, // image column
    { width: 50 }, // description column
    { width: 15 },
    { width: 20 },
  ];

  // Remove all borders and set background fill to white for all cells
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      // Set fill background color to white
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" }, // White color
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=Quotation_${data.referenceNo}.xlsx`,
    },
  });
}
