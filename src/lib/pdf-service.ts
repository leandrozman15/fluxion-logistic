
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Product, Load, Driver, Truck, Tenant, Expense } from "@/app/lib/types";

/**
 * SERVICIO CENTRAL DE GENERACIÓN DE DOCUMENTOS PDF (LOGÍSTICA AR)
 * Implementa el Padrón A: Maquetación programática vectorial con jsPDF.
 * Garantiza descarga automática y calidad de imprenta.
 */

const BLUE_LOGISTIC = [37, 99, 235]; // #2563eb
const SLATE_DARK = [15, 23, 42]; // #0f172a

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
  doc.text(product.sku, pageWidth - margin, 28, { align: "right" });

  // 2. CUERPO - NOMBRE Y MARCA (BLOQUE IZQUIERDO)
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.setFontSize(24);
  doc.text(product.name.toUpperCase(), margin, 55);
  
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(14);
  doc.text(product.brand || "MARCA NO ESPECIFICADA", margin, 62);

  // 3. FOTO DEL PRODUCTO (LADO DERECHO)
  if (product.photoUrl) {
    try {
      // Dibujamos un marco para la foto
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(pageWidth - margin - 45, 50, 45, 45);
      
      // Insertar imagen (jsPDF maneja base64 directamente)
      doc.addImage(product.photoUrl, 'JPEG', pageWidth - margin - 44, 51, 43, 43);
    } catch (e) {
      console.warn("No se pudo añadir la foto al PDF:", e);
    }
  }

  // 4. DESCRIPCIÓN (Ajuste de ancho para no chocar con la foto si es muy larga)
  doc.setTextColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DESCRIPCIÓN DEL ARTÍCULO", margin, 75);
  doc.line(margin, 77, pageWidth - margin - 55, 77); // Línea más corta para dejar aire a la foto

  doc.setFont("helvetica", "italic");
  const descWidth = product.photoUrl ? pageWidth - (margin * 2) - 55 : pageWidth - (margin * 2);
  const descLines = doc.splitTextToSize(product.description || "Sin descripción técnica disponible.", descWidth);
  doc.text(descLines, margin, 83);

  // 5. GRILLA TÉCNICA (MANUAL)
  const gridY = 110;
  const colW = (pageWidth - (margin * 2)) / 5;
  
  doc.setDrawColor(SLATE_DARK[0], SLATE_DARK[1], SLATE_DARK[2]);
  doc.setLineWidth(0.5);
  doc.rect(margin, gridY, pageWidth - (margin * 2), 25);
  
  // Líneas divisorias grilla
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

  // 6. SECCIÓN COMEX Y SEGURIDAD
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("IDENTIFICACIÓN MERCOSUR / SEGURIDAD", margin, 150);
  doc.line(margin, 152, pageWidth - margin, 152);

  autoTable(doc, {
    startY: 155,
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

  // 7. SELLO DE VALIDACIÓN
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

  // DESCARGA DIRECTA (Padrón A)
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

  // FIRMAS
  const finalY = (doc as any).lastAutoTable.finalY + 30;
  doc.line(margin, finalY, 70, finalY);
  doc.text("FIRMA CHOFER", margin + 15, finalY + 5);

  doc.line(pageWidth - 70, finalY, pageWidth - margin, finalY);
  doc.text("RECEPCIÓN CLIENTE", pageWidth - 55, finalY + 5);

  doc.save(`HojaRuta_${load.orderNumber}.pdf`);
};

/**
 * RENDICIÓN DE GASTOS / AUDITORÍA (A4)
 */
export const generateLoadWalletPDF = async (load: Load, expenses: Expense[], driver?: Driver | null, truck?: Truck | null, tenant?: Tenant) => {
  const doc = new jsPDF("p", "mm", "a4");
  const margin = 15;
  const pageWidth = 210;

  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.text("RENDICIÓN CONTABLE DE GASTOS", margin, 20);
  doc.setFontSize(10);
  doc.text(`ORDEN DE TRABAJO: ${load.orderNumber}`, margin, 28);
  
  doc.setFontSize(14);
  doc.text("AUDIT REPORT", pageWidth - margin, 25, { align: "right" });

  const body = expenses.map(e => [
    e.createdAt?.toDate ? format(e.createdAt.toDate(), "dd/MM/yy") : "---",
    e.category.toUpperCase(),
    e.location,
    `$${e.amount.toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: 50,
    head: [["FECHA", "CONCEPTO", "LUGAR", "MONTO"]],
    body: body,
    headStyles: { fillColor: [30, 41, 59] }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const totalExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const advance = load.budget?.initialAdvance || 0;
  const balance = advance - totalExpenses;

  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text(`Anticipo Otorgado: $${advance.toLocaleString()}`, pageWidth - margin, finalY, { align: "right" });
  doc.text(`Total Gastos Auditados: $${totalExpenses.toLocaleString()}`, pageWidth - margin, finalY + 7, { align: "right" });
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(balance >= 0 ? 22 : 185, balance >= 0 ? 101 : 28, balance >= 0 ? 52 : 28);
  doc.text(`SALDO FINAL: $${Math.abs(balance).toLocaleString()} ${balance >= 0 ? '(A FAVOR CIA)' : '(REINTEGRO)'}`, pageWidth - margin, finalY + 15, { align: "right" });

  doc.save(`Rendicion_${load.orderNumber}.pdf`);
};
