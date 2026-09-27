import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  PageOrientation,
} from "docx";

export type PageSize = "Letter" | "A4" | "Legal";
export type Orientation = "portrait" | "landscape";
export type FontChoice = "serif" | "sans" | "mono";

export type ExportSettings = {
  pageSize: PageSize;
  orientation: Orientation;
  margin: number; // inches
  fontSize: number; // pt
  font: FontChoice;
  lineHeight: number;
  includeTitle: boolean;
};

const SIZE_INCHES: Record<PageSize, [number, number]> = {
  Letter: [8.5, 11],
  A4: [8.27, 11.69],
  Legal: [8.5, 14],
};

function safeFilename(title: string) {
  const t = (title || "document").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return t || "document";
}

export function exportPdf(title: string, content: string, settings: ExportSettings) {
  const [w, h] = SIZE_INCHES[settings.pageSize];
  const pdf = new jsPDF({
    unit: "in",
    format: settings.pageSize === "A4" ? "a4" : settings.pageSize === "Legal" ? "legal" : "letter",
    orientation: settings.orientation,
  });

  const font = settings.font === "serif" ? "times" : settings.font === "mono" ? "courier" : "helvetica";
  pdf.setFont(font, "normal");

  const pageW = settings.orientation === "landscape" ? h : w;
  const pageH = settings.orientation === "landscape" ? w : h;
  const margin = settings.margin;
  const contentW = pageW - margin * 2;
  const lineH = (settings.fontSize * settings.lineHeight) / 72; // inches per line
  let y = margin;

  if (settings.includeTitle && title) {
    pdf.setFontSize(settings.fontSize + 6);
    pdf.setFont(font, "bold");
    const titleLines = pdf.splitTextToSize(title, contentW);
    pdf.text(titleLines, margin, y + lineH);
    y += lineH * titleLines.length + lineH * 0.8;
    pdf.setFont(font, "normal");
  }

  pdf.setFontSize(settings.fontSize);

  const paragraphs = content.split(/\n/);
  for (const para of paragraphs) {
    if (para.trim() === "") {
      y += lineH * 0.6;
      continue;
    }
    const lines = pdf.splitTextToSize(para, contentW) as string[];
    for (const line of lines) {
      if (y + lineH > pageH - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y + lineH);
      y += lineH;
    }
    y += lineH * 0.3;
  }

  pdf.save(`${safeFilename(title)}.pdf`);
}

export async function exportDocx(title: string, content: string, settings: ExportSettings) {
  const [w, h] = SIZE_INCHES[settings.pageSize];
  const widthDxa = Math.round(w * 1440);
  const heightDxa = Math.round(h * 1440);
  const marginDxa = Math.round(settings.margin * 1440);
  const halfPoint = settings.fontSize * 2;
  const fontName =
    settings.font === "serif" ? "Georgia" : settings.font === "mono" ? "Consolas" : "Calibri";

  const paragraphs: Paragraph[] = [];
  if (settings.includeTitle && title) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 200 },
        children: [
          new TextRun({ text: title, bold: true, size: halfPoint + 12, font: fontName }),
        ],
      }),
    );
  }
  for (const para of content.split(/\n/)) {
    paragraphs.push(
      new Paragraph({
        spacing: { line: Math.round(settings.lineHeight * 240), after: 120 },
        children: [new TextRun({ text: para, size: halfPoint, font: fontName })],
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: widthDxa,
              height: heightDxa,
              orientation:
                settings.orientation === "landscape"
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
            margin: { top: marginDxa, right: marginDxa, bottom: marginDxa, left: marginDxa },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFilename(title)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  pageSize: "Letter",
  orientation: "portrait",
  margin: 1,
  fontSize: 12,
  font: "serif",
  lineHeight: 1.5,
  includeTitle: true,
};
