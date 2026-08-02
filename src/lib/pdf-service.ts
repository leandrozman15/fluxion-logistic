
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Product, Load, Driver, Truck, Tenant, Expense, Quotation } from "@/app/lib/types";

/**
 * SERVICIO CENTRAL DE GENERACIÓN DE DOCUMENTOS PDF (LOGÍSTICA AR)
 * Implementa el Padrón A: Maquetación programática vectorial con jsPDF.
 * Garantiza descarga automática y calidad de imprenta.
 */

const BLUE_LOGISTIC = [37, 99, 235]; // #2563eb
const SLATE_DARK = [15, 23, 42]; // #0f172a
const EMERALD_SALE = [5, 150, 105]; // #059669

/**
 * FICHA TÉCNICA DE PRODUCTO (A4)
 */
export const generateProductPDF = async (product: Product, tenant?: Tenant) => {
  const doc = new jsPDF("p", "mm", "a4");
  const margin = 15;
  const pageWidth = 210;

  // 1. CABECERA CORPORATIVA
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

  // 2. TÍTULO Y MARCA
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.setFontSize(24);
  const nameLines = doc.splitTextToSize(product.name.toUpperCase(), pageWidth - (margin * 2));
  doc.text(nameLines, margin, 55);
  
  const brandY = 55 + (nameLines.length * 9);
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(14);
  doc.text(product.brand || "MARCA NO ESPECIFICADA", margin, brandY);

  // 3. DESCRIPCIÓN E IMAGEN (SECCIÓN SUPERIOR)
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

  // 4. GRILLA TÉCNICA (SECCIÓN INFERIOR)
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

  // 5. SECCIÓN COMEX Y SEGURIDAD
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
    headStyles: { fillColor: SLATE_DARK },
    styles: { fontSize: 9 }
  });

  // 6. SELLO DE VALIDACIÓN
  const footerY = 250;
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.rect(pageWidth - 60, footerY, 45, 25);
  doc.setFontSize(10);
  doc.text("APROBADO OK", pageWidth - 57, footerY + 10);
  doc.setFontSize(7);
  doc.text("AUDITORÍA CENTRAL", pageWidth - 57, footerY + 18);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Documento generado automáticamente el ${format(new Date(), "dd/MM/yyyy HH:mm")}`, margin, 285);

  doc.save(`Ficha_${product.sku}.pdf`);
};

/**
 * HOJA DE RUTA / ORDEN DE TRANSPORTE (A4)
 */
export const generateLoadOrderPDF = async (load: Load, driver?: Driver | null, truck?: Truck | null, tenant?: Tenant) => {
  const doc = new jsPDF("p", "mm", "a4");
  const margin = 15;
  const pageWidth = 210;

  // HEADER
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

  // RECURSOS
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text("1. ASIGNACIÓN DE RECURSOS", margin, 50);
  doc.line(margin, 52, pageWidth - margin, 52);

  doc.setFontSize(9);
  doc.text(`CONDUCTOR: ${driver ? `${driver.lastName}, ${driver.firstName}` : "SIN ASIGNAR"}`, margin, 60);
  doc.text(`DNI: ${driver?.dni || "---"}`, margin, 65);
  doc.text(`DOMINIO: ${truck?.plate || "---"}`, pageWidth / 2, 60);
  doc.text(`UNIDAD: ${truck?.brand || ""} ${truck?.model || ""}`, pageWidth / 2, 65);

  // ITINERARIO
  doc.setFontSize(10);
  doc.text("2. SECUENCIA DE ENTREGAS", margin, 80);
  
  const stopsBody = load.outboundStops.map((s, i) => [
    (i + 1).toString(),
    s.name.toUpperCase(),
    s.address,
    `${s.weightKg} KG`
  ]);

  autoTable(doc, {
    startY: 85,
    head: [["POS", "DESTINATARIO", "DIRECCIÓN", "PESO"]],
    body: stopsBody,
    theme: "grid",
    headStyles: { fillColor: BLUE_LOGISTIC },
    styles: { fontSize: 8 }
  });

  const finalY = Math.max((doc as any).lastAutoTable.finalY + 30, 240);
  doc.line(margin, finalY, 70, finalY);
  doc.text("FIRMA CHOFER", margin + 15, finalY + 5);

  doc.line(pageWidth - 70, finalY, pageWidth - margin, finalY);
  doc.text("RECEPCIÓN CLIENTE", pageWidth - 55, finalY + 5);

  doc.save(`HojaRuta_${load.orderNumber}.pdf`);
};

/**
 * RENDICIÓN DE GASTOS / AUDITORÍA OPERATIVA (A4)
 */
export const generateLoadWalletPDF = async (load: Load, expenses: Expense[], driver?: Driver | null, truck?: Truck | null, tenant?: Tenant) => {
  const doc = new jsPDF("p", "mm", "a4");
  const margin = 15;
  const pageWidth = 210;

  // HEADER
  doc.setFillColor(30, 41, 59); // Slate 800
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
 * PRESUPUESTO DE VENTA (A4)
 */
export const generateQuotationPDF = async (quote: Quotation, tenant?: Tenant) => {
    const doc = new jsPDF("p", "mm", "a4");
    const margin = 15;
    const pageWidth = 210;
  
    // HEADER
    doc.setFillColor(EMERALD_SALE[0], EMERALD_SALE[1], EMERALD_SALE[2]);
    doc.rect(0, 0, pageWidth, 40, "F");
    
    doc.setTextColor(255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(tenant?.name || "LOGÍSTICA AR", margin, 18);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`CUIT: ${tenant?.settings?.cuit || "30-XXXXXXXX-X"}`, margin, 24);
    doc.text(tenant?.settings?.legalAddress || "", margin, 28);
  
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PRESUPUESTO", pageWidth - margin, 20, { align: "right" });
    doc.setFontSize(24);
    doc.text(quote.number, pageWidth - margin, 32, { align: "right" });
  
    // CLIENTE
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text("DATOS DEL CLIENTE", margin, 55);
    doc.line(margin, 57, pageWidth - margin, 57);
  
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(quote.clientName.toUpperCase(), margin, 65);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`CUIT: ${quote.clientCuit}`, margin, 70);
  
    doc.setFontSize(9);
    doc.text(`Fecha de Emisión: ${quote.date}`, pageWidth - margin, 65, { align: "right" });
    doc.setTextColor(200, 0, 0);
    doc.text(`Válido hasta: ${quote.expiryDate}`, pageWidth - margin, 70, { align: "right" });
  
    // TABLA DE ITEMS
    const itemRows = quote.items.map(item => [
      item.sku,
      item.name.toUpperCase(),
      item.quantity.toString(),
      `$${item.unitPrice.toLocaleString()}`,
      `${item.ivaRate}%`,
      `$${(item.quantity * item.unitPrice).toLocaleString()}`
    ]);
  
    autoTable(doc, {
      startY: 80,
      head: [["SKU", "DESCRIPCIÓN", "CANT", "P. UNIT", "IVA", "SUBTOTAL"]],
      body: itemRows,
      headStyles: { fillColor: EMERALD_SALE },
      styles: { fontSize: 8 },
      margin: { left: margin, right: margin }
    });
  
    // TOTALES
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFillColor(248, 250, 252);
    doc.rect(pageWidth - 95, finalY, 80, 35, "F");
  
    doc.setTextColor(100);
    doc.setFontSize(10);
    doc.text(`Subtotal Neto:`, pageWidth - 90, finalY + 8);
    doc.text(`$${quote.subtotal.toLocaleString()}`, pageWidth - margin - 5, finalY + 8, { align: "right" });
    
    doc.text(`IVA Total:`, pageWidth - 90, finalY + 15);
    doc.text(`$${quote.taxTotal.toLocaleString()}`, pageWidth - margin - 5, finalY + 15, { align: "right" });
  
    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL ARS:`, pageWidth - 90, finalY + 28);
    doc.text(`$${quote.totalAmount.toLocaleString()}`, pageWidth - margin - 5, finalY + 28, { align: "right" });
  
    // NOTAS
    if (quote.notes) {
      doc.setTextColor(150);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text("Notas y condiciones:", margin, 250);
      const noteLines = doc.splitTextToSize(quote.notes, pageWidth - (margin * 2));
      doc.text(noteLines, margin, 254);
    }
  
    doc.save(`Presupuesto_${quote.number}.pdf`);
  };
