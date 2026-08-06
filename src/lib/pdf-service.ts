import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JsBarcode from "jsbarcode";
import { format, differenceInCalendarDays } from "date-fns";
import { Product, Load, Driver, Truck, Tenant, Expense, Quotation } from "@/app/lib/types";

/**
 * SERVICIO CENTRAL DE GENERACIÓN DE DOCUMENTOS PDF (LOGÍSTICA AR)
 * Implementa el Padrón A: Maquetación programática vectorial con jsPDF.
 */

const BLUE_LOGISTIC = [37, 99, 235]; 
const SLATE_DARK = [15, 23, 42]; 
const EMERALD_SALE = [5, 150, 105];
const AMBER_ACCENT = [217, 119, 6];
const SLATE_MUTED = [100, 116, 139];
const SLATE_BORDER = [226, 232, 240];

/**
 * Genera un código de barras (CODE128) como data URL PNG, para insertar con doc.addImage.
 * Corre únicamente en el navegador (requiere <canvas>), igual que el resto de este servicio.
 */
function getBarcodeDataUrl(value: string): string | null {
  if (!value || typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, value, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      height: 40,
      width: 2,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * FICHA TÉCNICA DE PRODUCTO (A4)
 */
export const generateProductPDF = async (product: Product, tenant?: Tenant) => {
  const doc = new jsPDF("p", "mm", "a4");
  const margin = 15;
  const pageWidth = 210;

  doc.setFillColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(tenant?.name || "LOGÍSTICA AR", margin, 20);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`CUIT: ${tenant?.settings?.cuit || "30-XXXXXXXX-X"}`, margin, 26);
  doc.text("FICHA TÉCNICA CERTIFICADA V3.0", margin, 30);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("DATA SHEET", pageWidth - 70, 25, { align: "right" });
  doc.setFontSize(28);
  doc.text(product.sku, pageWidth - margin, 34, { align: "right" });

  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.setFontSize(24);
  const nameLines = doc.splitTextToSize(product.name.toUpperCase(), pageWidth - (margin * 2));
  doc.text(nameLines, margin, 55);
  
  const brandY = 55 + (nameLines.length * 9);
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(14);
  doc.text(product.brand || "MARCA NO ESPECIFICADA", margin, brandY);

  const contentY = brandY + 12;
  
  let photoHeight = 0;
  if (product.photoUrl) {
    try {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(pageWidth - margin - 55, contentY, 55, 55);
      doc.addImage(product.photoUrl, 'JPEG', pageWidth - margin - 54, contentY + 1, 53, 53);
      photoHeight = 60;
    } catch (e) {
      console.warn("No se pudo añadir la foto al PDF:", e);
    }
  }

  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPCIÓN DEL ARTÍCULO", margin, contentY - 2);
  doc.line(margin, contentY, margin + 40, contentY);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  const descWidth = product.photoUrl ? pageWidth - (margin * 2) - 65 : pageWidth - (margin * 2);
  const descLines = doc.splitTextToSize(product.description || "Sin descripción técnica disponible.", descWidth);
  doc.text(descLines, margin, contentY + 8);

  const descTotalHeight = descLines.length * 6;
  const sectionSplitY = contentY + Math.max(descTotalHeight + 15, photoHeight);

  const gridY = sectionSplitY;
  const colW = (pageWidth - (margin * 2)) / 5;
  
  doc.setDrawColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.setLineWidth(0.5);
  doc.rect(margin, gridY, pageWidth - (margin * 2), 25);
  
  for (let i = 1; i < 5; i++) {
    doc.line(margin + (colW * i), gridY, margin + (colW * i), gridY + 25);
  }

  const labels = ["PESO BRUTO", "VOLUMEN", "U. POR CAJA", "U. POR PALLET", "EMBALAJE"];
  const values = [
    `${product.unitWeightKg} KG`,
    `${product.unitVolumeM3} M3`,
    `${product.unitsPerBox || 0}`,
    `${product.unitsPerPallet || 0}`,
    product.packagingType.toUpperCase()
  ];

  labels.forEach((l, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(l, margin + (colW * i) + 2, gridY + 6);
    doc.setFontSize(12);
    doc.text(values[i], margin + (colW * i) + 2, gridY + 18);
  });

  const tableY = gridY + 40;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("IDENTIFICACIÓN MERCOSUR / SEGURIDAD", margin, tableY - 5);
  doc.line(margin, tableY - 3, pageWidth - margin, tableY - 3);

  autoTable(doc, {
    startY: tableY,
    margin: { left: margin, right: margin },
    head: [["PARÁMETRO", "VALOR REGISTRADO"]],
    body: [
      ["POSICIÓN NCM", product.ncmCode || "NO DEFINIDA"],
      ["ORIGEN", product.origin.toUpperCase()],
      ["REQUISITO FRÍO", product.requiresReefer ? "SÍ (EQUIPO REEFER)" : "NO (CARGA SECA)"],
      ["NIVEL DE RIESGO", product.dangerLevel === 'none' ? "CARGA GENERAL" : `PELIGRO: ${product.dangerLevel.toUpperCase()}`],
      ["N° ONU", product.onuNumber || "N/A"]
    ],
    theme: "striped",
    headStyles: { fillColor: SLATE_DARK as any },
    styles: { fontSize: 9 }
  });

  let cursorY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.text("TRAZABILIDAD Y ALMACENAMIENTO", margin, cursorY - 5);
  doc.line(margin, cursorY - 3, pageWidth - margin, cursorY - 3);

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    head: [["PARÁMETRO", "VALOR REGISTRADO"]],
    body: [
      ["GTIN / CÓDIGO DE BARRAS", product.gtin || "NO ASIGNADO"],
      ["TIPO DE UNIDAD", product.unitType.toUpperCase()],
      ["DIMENSIONES (L x A x H)", product.dimensions ? `${product.dimensions.l} x ${product.dimensions.w} x ${product.dimensions.h} CM` : "NO REGISTRADAS"],
      ["CONTROL POR LOTE", product.isLotTracked ? "SÍ" : "NO"],
      ["CONTROL POR N° DE SERIE", product.isSerialTracked ? "SÍ" : "NO"],
      ["CONTROL DE VENCIMIENTO", product.expiryControl ? "SÍ" : "NO"],
      ...(product.requiresReefer && product.tempRange ? [["RANGO DE TEMPERATURA", `${product.tempRange.min}°C A ${product.tempRange.max}°C`]] : [])
    ],
    theme: "striped",
    headStyles: { fillColor: BLUE_LOGISTIC as any },
    styles: { fontSize: 9 }
  });

  cursorY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DISTRIBUCIÓN EN DEPÓSITO (LOTE / UBICACIÓN)", margin, cursorY - 5);
  doc.line(margin, cursorY - 3, pageWidth - margin, cursorY - 3);

  if (product.warehouses && product.warehouses.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [["SEDE", "UBICACIÓN RACK", "N° LOTE", "INGRESO", "STOCK"]],
      body: product.warehouses.map((w) => [
        w.hubName || "S/D",
        w.location || "SIN POSICIÓN",
        w.lotNumber || "S/D",
        w.entryDate || "S/D",
        `${w.stockQuantity} ${product.unitType.toUpperCase()}${w.stockQuantity === 1 ? "" : "S"}`
      ]),
      theme: "grid",
      headStyles: { fillColor: SLATE_DARK as any },
      styles: { fontSize: 8 }
    });
    cursorY = (doc as any).lastAutoTable.finalY + 15;
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150);
    doc.text("Sin ubicaciones de depósito configuradas para este producto.", margin, cursorY + 3);
    doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
    cursorY += 15;
  }

  let footerY = Math.max(cursorY, 250);
  if (footerY > 260) {
    doc.addPage();
    footerY = 240;
  }

  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.rect(pageWidth - 60, footerY, 45, 25);
  doc.setFontSize(10);
  doc.text("APROBADO OK", pageWidth - 57, footerY + 10);
  doc.setFontSize(7);
  doc.text("AUDITORÍA CENTRAL", pageWidth - 57, footerY + 18);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Documento generado automáticamente el ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, Math.min(footerY + 35, 290));

  doc.save(`Ficha_${product.sku}.pdf`);
};

/**
 * HOJA DE RUTA / ORDEN DE TRANSPORTE (A4)
 * Ahora incluye las firmas digitales capturadas en ruta.
 */
export const generateLoadOrderPDF = async (load: Load, driver?: Driver | null, truck?: Truck | null, tenant?: Tenant) => {
  const doc = new jsPDF("p", "mm", "a4");
  const margin = 15;
  const pageWidth = 210;

  doc.setFillColor(BLUE_LOGISTIC[0], BLUE_LOGISTIC[1], BLUE_LOGISTIC[2]);
  doc.rect(0, 0, pageWidth, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(tenant?.name || "LOGÍSTICA AR", margin, 15);
  doc.setFontSize(9);
  doc.text("HOJA DE RUTA / MANIFIESTO DE CARGA", margin, 22);

  doc.setFontSize(24);
  doc.text(load.orderNumber, pageWidth - margin, 22, { align: "right" });

  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text("1. ASIGNACIÓN DE RECURSOS", margin, 50);
  doc.line(margin, 52, pageWidth - margin, 52);

  doc.setFontSize(9);
  doc.text(`CONDUCTOR: ${driver ? `${driver.lastName}, ${driver.firstName}` : "SIN ASIGNAR"}`, margin, 60);
  doc.text(`DNI: ${driver?.dni || "---"}`, margin, 65);
  doc.text(`DOMINIO: ${truck?.plate || "---"}`, pageWidth / 2, 60);
  doc.text(`UNIDAD: ${truck?.brand || ""} ${truck?.model || ""}`, pageWidth / 2, 65);

  doc.setFontSize(10);
  doc.text("2. SECUENCIA DE ENTREGAS", margin, 80);
  
  const stopsBody = load.outboundStops.map((s, i) => [
    (i + 1).toString(),
    s.name.toUpperCase(),
    s.address,
    `${s.weightKg} KG`,
    s.deliveredAt ? "ENTREGADO" : "PENDIENTE"
  ]);

  autoTable(doc, {
    startY: 85,
    head: [["POS", "DESTINATARIO", "DIRECCIÓN", "PESO", "ESTADO"]],
    body: stopsBody,
    theme: "grid",
    headStyles: { fillColor: BLUE_LOGISTIC as any },
    styles: { fontSize: 8 }
  });

  // SECCIÓN DE FIRMAS DIGITALES (Si existen)
  const finalY = Math.max((doc as any).lastAutoTable.finalY + 30, 240);
  
  // Buscar la última parada con firma para representarla como certificación del viaje
  const lastPod = load.outboundStops.reverse().find(s => s.proofOfDelivery?.receiverSignatureUrl)?.proofOfDelivery;

  if (lastPod?.driverSignatureUrl) {
    try {
        doc.addImage(lastPod.driverSignatureUrl, 'PNG', margin, finalY - 20, 50, 20);
    } catch (e) {}
  }
  doc.line(margin, finalY, 70, finalY);
  doc.setFontSize(8);
  doc.text("FIRMA DIGITAL CHOFER", margin + 10, finalY + 5);

  if (lastPod?.receiverSignatureUrl) {
    try {
        doc.addImage(lastPod.receiverSignatureUrl, 'PNG', pageWidth - 70, finalY - 20, 50, 20);
    } catch (e) {}
  }
  doc.line(pageWidth - 70, finalY, pageWidth - margin, finalY);
  doc.text("FIRMA DIGITAL RECEPTOR", pageWidth - 60, finalY + 5);

  doc.save(`HojaRuta_${load.orderNumber}.pdf`);
};

/**
 * RENDICIÓN DE GASTOS / AUDITORÍA OPERATIVA (A4)
 */
export const generateLoadWalletPDF = async (load: Load, expenses: Expense[], driver?: Driver | null, truck?: Truck | null, tenant?: Tenant) => {
  const doc = new jsPDF("p", "mm", "a4");
  const margin = 15;
  const pageWidth = 210;

  doc.setFillColor(30, 41, 59); 
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.text("RENDICIÓN CONTABLE DE GASTOS", margin, 20);
  doc.setFontSize(10);
  doc.text(`ORDEN DE TRABAJO: ${load.orderNumber}`, margin, 28);
  
  doc.setFontSize(14);
  doc.text("AUDIT REPORT", pageWidth - margin, 25, { align: "right" });

  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("I. RESUMEN OPERATIVO DEL VIAJE", margin, 52);
  doc.line(margin, 54, pageWidth - margin, 54);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const infoY = 62;
  const col2 = pageWidth / 2;

  doc.text(`CHOFER: ${driver ? `${driver.lastName}, ${driver.firstName}` : "---"}`, margin, infoY);
  doc.text(`DNI: ${driver?.dni || "---"}`, margin, infoY + 5);
  doc.text(`CAMIÓN: ${truck?.plate || "---"} (${truck?.brand || ""} ${truck?.model || ""})`, margin, infoY + 10);

  const totalDeliveredWeight = load.outboundStops.reduce((acc, s) => acc + (s.deliveredAt ? s.weightKg : 0), 0);
  doc.text(`DISTANCIA RECORRIDA: ${Math.round(load.tracking?.distanceTraveledKm || 0)} KM`, col2, infoY);
  doc.text(`TIEMPO EN RUTA: ${load.tracking?.timeOnRouteMinutes || 0} MIN`, col2, infoY + 5);
  doc.text(`CARGA ENTREGADA: ${totalDeliveredWeight.toLocaleString()} KG`, col2, infoY + 10);

  doc.setFont("helvetica", "bold");
  doc.text(`ITINERARIO: ${load.origin.name} -> ${load.outboundStops.length} Paradas -> ${load.isRoundTrip ? 'Retorno' : 'Directo'}`, margin, infoY + 18);

  doc.setFontSize(10);
  doc.text("II. DETALLE DE COMPROBANTES REGISTRADOS", margin, infoY + 30);
  
  const expenseRows = expenses.map(e => [
    e.createdAt?.toDate ? format(e.createdAt.toDate(), "dd/MM/yy") : "---",
    e.category.toUpperCase(),
    e.location,
    `$${e.amount.toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: infoY + 32,
    head: [["FECHA", "CONCEPTO", "LUGAR", "MONTO"]],
    body: expenseRows,
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 8 },
    margin: { left: margin, right: margin }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 12;
  const totalExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const advance = load.budget?.initialAdvance || 0;
  const balance = advance - totalExpenses;

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, finalY - 5, pageWidth - (margin * 2), 30, "F");

  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Anticipo Otorgado: $${advance.toLocaleString()}`, pageWidth - margin - 5, finalY + 2, { align: "right" });
  doc.text(`Total Gastos Auditados: $${totalExpenses.toLocaleString()}`, pageWidth - margin - 5, finalY + 9, { align: "right" });
  
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(balance >= 0 ? 22 : 185, balance >= 0 ? 101 : 28, balance >= 0 ? 52 : 28);
  const balanceLabel = balance >= 0 ? '(A FAVOR CIA)' : '(REINTEGRO)';
  doc.text(`SALDO FINAL: $${Math.abs(balance).toLocaleString()} ${balanceLabel}`, pageWidth - margin - 5, finalY + 18, { align: "right" });

  doc.save(`Rendicion_${load.orderNumber}.pdf`);
};

/**
 * PRESUPUESTO DE VENTA PROFESIONAL ERP (A4)
 */
export const generateQuotationPDF = async (quote: Quotation, tenant?: Tenant) => {
    const doc = new jsPDF("p", "mm", "a4");
    const margin = 15;
    const pageWidth = 210;
    const pageHeight = 297;
    const contentWidth = pageWidth - margin * 2;

    // Marca de agua diagonal sutil, se dibuja primero para quedar detrás de todo el contenido.
    doc.saveGraphicsState();
    (doc as any).setGState(new (doc as any).GState({ opacity: 0.05 }));
    doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(90);
    doc.text("PRESUPUESTO", pageWidth / 2, 180, { align: "center", angle: 35 });
    doc.restoreGraphicsState();

    // ===== HEADER =====
    doc.setFillColor(EMERALD_SALE[0], EMERALD_SALE[1], EMERALD_SALE[2]);
    doc.rect(0, 0, pageWidth, 30, "F");

    if (tenant?.settings?.logoUrl) {
      try {
        doc.addImage(tenant.settings.logoUrl, "JPEG", margin, 6, 18, 18);
      } catch {}
    }

    doc.setTextColor(255);
    doc.setFontSize(17);
    doc.setFont("helvetica", "bold");
    doc.text(tenant?.name || "LOGÍSTICA AR", tenant?.settings?.logoUrl ? margin + 22 : margin, 14);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    const legalX = tenant?.settings?.logoUrl ? margin + 22 : margin;
    doc.text(`CUIT ${tenant?.settings?.cuit || "30-XXXXXXXX-X"} · ${tenant?.settings?.legalAddress || ""}`, legalX, 20);
    doc.text(`${tenant?.settings?.legalCityState || ""}${tenant?.settings?.country ? " · " + tenant.settings.country : ""}`, legalX, 24.5);

    // Tarjeta flotante con el estado del documento (protagonista sobre el header).
    const cardW = 65;
    const cardX = pageWidth - margin - cardW;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cardX, 8, cardW, 24, 2, 2, "F");

    const daysToExpiry = differenceInCalendarDays(new Date(quote.expiryDate), new Date());
    const isExpired = daysToExpiry < 0;
    const statusLabel = isExpired ? "VENCIDO" : daysToExpiry <= 3 ? `VENCE EN ${daysToExpiry}D` : "VIGENTE";
    const statusColor = isExpired ? [220, 38, 38] : daysToExpiry <= 3 ? AMBER_ACCENT : EMERALD_SALE;

    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2]);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("PRESUPUESTO COMERCIAL N°", cardX + 4, 13.5);
    doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
    doc.setFontSize(15);
    doc.text(quote.number, cardX + 4, 20.5);

    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(cardX + 4, 23, cardW - 8, 6, 1, 1, "F");
    doc.setTextColor(255);
    doc.setFontSize(7);
    doc.text(`${statusLabel}  ·  ${quote.currency} T.C $${quote.exchangeRate}`, cardX + cardW / 2, 27, { align: "center" });

    // ===== TARJETAS: CLIENTE Y CONDICIONES =====
    const cardsY = 38;
    const cardHalfW = (contentWidth - 6) / 2;

    const drawInfoCard = (x: number, title: string) => {
      doc.setDrawColor(SLATE_BORDER[0], SLATE_BORDER[1], SLATE_BORDER[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, cardsY, cardHalfW, 42, 1.5, 1.5, "S");
      doc.setFillColor(EMERALD_SALE[0], EMERALD_SALE[1], EMERALD_SALE[2]);
      doc.rect(x, cardsY, 1.4, 42, "F");
      doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2]);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(title, x + 6, cardsY + 7);
    };

    drawInfoCard(margin, "INFORMACIÓN DEL CLIENTE");
    doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
    doc.setFontSize(11.5);
    doc.setFont("helvetica", "bold");
    doc.text(quote.clientName.toUpperCase(), margin + 6, cardsY + 15);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2]);
    doc.text(`CUIT: ${quote.clientCuit}  ·  IVA: ${quote.ivaCondition}`, margin + 6, cardsY + 22);
    const addressLines = doc.splitTextToSize(`Entrega: ${quote.deliveryAddress || "A coordinar"}`, cardHalfW - 12);
    doc.text(addressLines, margin + 6, cardsY + 29);

    const rightCardX = margin + cardHalfW + 6;
    drawInfoCard(rightCardX, "EMISIÓN Y CONTROL");
    doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Emisión: ${quote.date}`, rightCardX + 6, cardsY + 15);
    doc.text(`Vencimiento: ${quote.expiryDate}`, rightCardX + 6, cardsY + 21);
    doc.text(`Ejecutivo: ${quote.sellerName || "Administración"}`, rightCardX + 6, cardsY + 27);
    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2]);
    doc.setFontSize(6.5);
    doc.text("Sistema ERP Fluxion · Documento con validez comercial", rightCardX + 6, cardsY + 35);

    // ===== TABLA DE ÍTEMS CON IMÁGENES Y CÓDIGO DE BARRAS =====
    const itemRows = quote.items.map(item => [
      "",
      "",
      item.name.toUpperCase(),
      `${item.quantity} ${item.unit}`,
      `$${item.unitPrice.toLocaleString()}`,
      `${item.discountPercent}%`,
      `$${item.subtotal.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: cardsY + 48,
      head: [["FOTO", "CÓD. BARRA / SKU", "DETALLE DEL ARTÍCULO", "CANT", "P. UNIT", "DESC", "SUBTOTAL"]],
      body: itemRows,
      headStyles: { fillColor: SLATE_DARK as any, textColor: 255, fontSize: 7.5, cellPadding: 3 },
      styles: { fontSize: 8.5, valign: 'middle', cellPadding: 3, minCellHeight: 16, lineColor: SLATE_BORDER as any },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 30 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 13, halign: 'right', textColor: AMBER_ACCENT as any },
        6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
      },
      didDrawCell: (data) => {
        if (data.section !== 'body') return;
        const item = quote.items[data.row.index];
        if (data.column.index === 0 && item.photoUrl) {
          try {
            doc.addImage(item.photoUrl, 'JPEG', data.cell.x + 2, data.cell.y + 1, 12, 12);
          } catch {}
        }
        if (data.column.index === 1) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
          doc.text(item.sku, data.cell.x + 2, data.cell.y + 5);
          const barcodeUrl = getBarcodeDataUrl(item.sku);
          if (barcodeUrl) {
            try {
              doc.addImage(barcodeUrl, 'PNG', data.cell.x + 2, data.cell.y + 7, 26, 7);
            } catch {}
          }
        }
      }
    });

    // ===== CONDICIONES COMERCIALES Y TOTALES =====
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    if (finalY > pageHeight - 90) {
      doc.addPage();
      finalY = 20;
    }

    doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("CONDICIONES COMERCIALES Y LOGÍSTICA", margin, finalY);
    doc.setDrawColor(EMERALD_SALE[0], EMERALD_SALE[1], EMERALD_SALE[2]);
    doc.line(margin, finalY + 2, margin + 90, finalY + 2);

    const conditionChips = [
      `PAGO: ${quote.paymentMethod}`,
      `PLAZO: ${quote.paymentTerm}`,
      `ENTREGA: ${quote.deliveryTimeDays} días hábiles (${quote.deliveryType})`,
      `LOGÍSTICA: ${quote.includeTransport ? "Incluida en total" : "A cargo del cliente"}`,
      `GARANTÍA: ${quote.warrantyInfo}`,
    ];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let chipY = finalY + 9;
    conditionChips.forEach((chip) => {
      doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2]);
      const lines = doc.splitTextToSize(chip, 95);
      doc.text(lines, margin, chipY);
      chipY += 5 * lines.length;
    });

    // Bloque de totales en cascada
    const totalsX = 120;
    const totalsW = pageWidth - totalsX - margin;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(SLATE_BORDER[0], SLATE_BORDER[1], SLATE_BORDER[2]);
    doc.roundedRect(totalsX, finalY - 5, totalsW, 46, 1.5, 1.5, "FD");

    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Suma neta:", totalsX + 4, finalY + 2);
    doc.text(`$${quote.subtotal.toLocaleString()}`, pageWidth - margin - 4, finalY + 2, { align: "right" });

    doc.text("Desc. comercial:", totalsX + 4, finalY + 8);
    doc.text(`-$${quote.commercialDiscount.toLocaleString()}`, pageWidth - margin - 4, finalY + 8, { align: "right" });

    doc.text("Recargo logístico:", totalsX + 4, finalY + 14);
    doc.text(`+$${quote.logisticSurcharge.toLocaleString()}`, pageWidth - margin - 4, finalY + 14, { align: "right" });

    doc.text("IVA liquidado:", totalsX + 4, finalY + 20);
    doc.text(`$${quote.taxTotal.toLocaleString()}`, pageWidth - margin - 4, finalY + 20, { align: "right" });

    doc.setFillColor(EMERALD_SALE[0], EMERALD_SALE[1], EMERALD_SALE[2]);
    doc.roundedRect(totalsX + 2, finalY + 24, totalsW - 4, 15, 1.5, 1.5, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`TOTAL (${quote.currency})`, totalsX + 6, finalY + 30);
    doc.setFontSize(15);
    doc.text(`${quote.currency === 'ARS' ? '$' : quote.currency} ${quote.totalAmount.toLocaleString()}`, pageWidth - margin - 4, finalY + 35, { align: "right" });

    // ===== NOTAS =====
    let notesY = finalY + 50;
    if (quote.notes) {
      doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2]);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "italic");
      const noteLines = doc.splitTextToSize(`Cláusulas: ${quote.notes}`, contentWidth);
      doc.text(noteLines, margin, notesY);
      notesY += noteLines.length * 4 + 4;
    }

    // ===== BLOQUE DE FIRMA =====
    const signatureY = Math.max(notesY + 10, pageHeight - 45);
    doc.setDrawColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, signatureY, margin + 70, signatureY);
    doc.line(pageWidth - margin - 70, signatureY, pageWidth - margin, signatureY);
    doc.setFontSize(7);
    doc.setTextColor(SLATE_MUTED[0], SLATE_MUTED[1], SLATE_MUTED[2]);
    doc.setFont("helvetica", "normal");
    doc.text("Firma y aclaración", margin, signatureY + 5);
    doc.text("Fecha de aceptación", pageWidth - margin - 70, signatureY + 5);

    // ===== FOOTER DE MARCA =====
    doc.setFillColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
    doc.rect(0, pageHeight - 12, pageWidth, 12, "F");
    doc.setTextColor(255);
    doc.setFontSize(7);
    doc.text(`${tenant?.name || "LOGÍSTICA AR"} · ERP Fluxion`, margin, pageHeight - 5);
    doc.text(`ID ${quote.id}`, pageWidth - margin, pageHeight - 5, { align: "right" });

    doc.save(`Presupuesto_${quote.number}.pdf`);
};
