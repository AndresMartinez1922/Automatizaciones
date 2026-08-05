import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page, TestInfo } from '@playwright/test';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from 'docx';

type EvidenceStatus = 'Exitoso' | 'Fallido';

type EvidenceStep = {
  title: string;
  description: string;
  expected: string;
  actual: string;
  screenshotPath?: string;
  section?: boolean;
};

type EvidenceCaptureStep = Omit<EvidenceStep, 'screenshotPath' | 'section'> & {
  highlight?: Locator | Locator[];
};

type EvidenceReportOptions = {
  caseId: string;
  description: string;
  analyst: string;
  expectedResult: string;
  query?: string;
};

const pageWidthDxa = 9360;
const labelColumnWidthDxa = 2600;
const valueColumnWidthDxa = pageWidthDxa - labelColumnWidthDxa;
const executiveInnerWidthDxa = pageWidthDxa - 320;
const executiveLabelWidthDxa = 2300;
const executiveValueWidthDxa = executiveInnerWidthDxa - executiveLabelWidthDxa;
const borderColor = 'B7C9DC';
const headerFill = 'E8EEF5';

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function fileTimestamp(date = new Date()): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

function displayTimestamp(date = new Date()): string {
  return date.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function sanitizeFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function tableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    left: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    right: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: borderColor }
  };
}

function evidenceTableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    left: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    right: { style: BorderStyle.SINGLE, size: 1, color: borderColor }
  };
}

function textParagraph(text: string, bold = false): Paragraph {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text,
        bold,
        font: 'Calibri',
        size: 22,
        color: '1F2937'
      })
    ]
  });
}

function cell(text: string, options: { bold?: boolean; fill?: string; width?: number } = {}): TableCell {
  return new TableCell({
    width: { size: options.width ?? valueColumnWidthDxa, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: options.fill ? { fill: options.fill } : undefined,
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [textParagraph(text, options.bold)]
  });
}

function metadataTable(rows: Array<[string, string]>): Table {
  return new Table({
    width: { size: pageWidthDxa, type: WidthType.DXA },
    columnWidths: [labelColumnWidthDxa, valueColumnWidthDxa],
    layout: TableLayoutType.FIXED,
    borders: tableBorders(),
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            cell(label, { bold: true, fill: headerFill, width: labelColumnWidthDxa }),
            cell(value, { width: valueColumnWidthDxa })
          ]
        })
    )
  });
}

function getPngSize(path: string): { width: number; height: number } | undefined {
  const buffer = readFileSync(path);

  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    return undefined;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function imageParagraph(path: string, title: string): Paragraph {
  const image = readFileSync(path);
  const size = getPngSize(path);
  const maxWidth = 620;
  const maxHeight = 430;
  const scale = size ? Math.min(maxWidth / size.width, maxHeight / size.height, 1) : 1;
  const width = size ? Math.round(size.width * scale) : 600;
  const height = size ? Math.round(size.height * scale) : 360;

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 240 },
    children: [
      new ImageRun({
        type: 'png',
        data: image,
        transformation: { width, height },
        altText: {
          title,
          description: `Pantallazo de evidencia: ${title}`,
          name: title
        }
      })
    ]
  });
}

function evidenceTitleParagraph(step: EvidenceStep, index: number): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 80 },
    children: [
      new TextRun({
        text: `${index + 1}. ${step.title}`,
        bold: true,
        font: 'Calibri',
        size: 24,
        color: '0B2545'
      })
    ]
  });
}

function evidenceSectionTitleParagraph(step: EvidenceStep): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 100 },
    children: [
      new TextRun({
        text: step.title,
        bold: true,
        font: 'Calibri',
        size: 34,
        color: 'FFFFFF'
      })
    ]
  });
}

function evidenceSectionDetailParagraph(label: string, value: string, color = '0B2545'): Paragraph {
  return new Paragraph({
    spacing: { before: 40, after: 60 },
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        font: 'Calibri',
        size: 22,
        color
      }),
      new TextRun({
        text: value,
        font: 'Calibri',
        size: 22,
        color: '1F2937'
      })
    ]
  });
}

function evidenceSectionLabelParagraph(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 20, after: 20 },
    children: [
      new TextRun({
        text: label.toUpperCase(),
        bold: true,
        font: 'Calibri',
        size: 18,
        color: '2563EB'
      })
    ]
  });
}

function evidenceSectionValueParagraph(value: string, options: { bold?: boolean; color?: string } = {}): Paragraph {
  return new Paragraph({
    spacing: { before: 10, after: 30 },
    children: [
      new TextRun({
        text: value,
        bold: options.bold,
        font: 'Calibri',
        size: 21,
        color: options.color ?? '111827'
      })
    ]
  });
}

function executiveInfoCell(label: string, value: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: { fill: 'F8FBFF' },
    margins: { top: 140, bottom: 140, left: 160, right: 160 },
    children: [evidenceSectionLabelParagraph(label), evidenceSectionValueParagraph(value, { bold: true })]
  });
}

function executiveLabelCell(label: string): TableCell {
  return new TableCell({
    width: { size: executiveLabelWidthDxa, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: { fill: 'E8F0FE' },
    margins: { top: 130, bottom: 130, left: 160, right: 160 },
    children: [evidenceSectionValueParagraph(label.toUpperCase(), { bold: true, color: '0B2545' })]
  });
}

function executiveValueCell(value: string, fill = 'F8FBFF'): TableCell {
  return new TableCell({
    width: { size: executiveValueWidthDxa, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: { fill },
    margins: { top: 130, bottom: 130, left: 180, right: 180 },
    children: [evidenceSectionValueParagraph(value)]
  });
}

function executiveMetadataRow(label: string, value: string, fill?: string): TableRow {
  return new TableRow({
    children: [executiveLabelCell(label), executiveValueCell(value, fill)]
  });
}

function executiveDetailCell(label: string, value: string, fill: string): TableCell {
  return new TableCell({
    width: { size: pageWidthDxa, type: WidthType.DXA },
    shading: { fill },
    margins: { top: 160, bottom: 160, left: 220, right: 220 },
    children: [evidenceSectionLabelParagraph(label), evidenceSectionValueParagraph(value)]
  });
}

function testNumberFromSectionTitle(title: string): string {
  return title.match(/TEST\s+(\d+)/i)?.[1] ?? 'N/A';
}

function testScopeFromSectionTitle(title: string): string {
  const [, scope] = title.split(/\s+-\s+/, 2);
  return scope?.trim() || title;
}

function evidenceDescriptionParagraph(step: EvidenceStep): Paragraph {
  return new Paragraph({
    spacing: { before: 40, after: 80 },
    children: [
      new TextRun({
        text: step.description,
        font: 'Calibri',
        size: 22,
        color: '1F2937'
      })
    ]
  });
}

function evidenceResultParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { before: 20, after: 60 },
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        font: 'Calibri',
        size: 22,
        color: '0B2545'
      }),
      new TextRun({
        text: value,
        font: 'Calibri',
        size: 22,
        color: '1F2937'
      })
    ]
  });
}

function stepChildren(step: EvidenceStep, index: number): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = [evidenceTitleParagraph(step, index)];

  if (step.screenshotPath && existsSync(step.screenshotPath)) {
    children.push(imageParagraph(step.screenshotPath, step.title));
  }

  children.push(evidenceDescriptionParagraph(step));
  children.push(evidenceResultParagraph('Resultado esperado', step.expected));
  children.push(evidenceResultParagraph('Resultado obtenido', step.actual));

  return children;
}

function evidenceCaseTable(section: EvidenceStep, steps: EvidenceStep[]): Table {
  const bodyChildren = steps.flatMap((step, index) => stepChildren(step, index));
  const testNumber = testNumberFromSectionTitle(section.title);
  const testScope = testScopeFromSectionTitle(section.title);

  return new Table({
    width: { size: pageWidthDxa, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: evidenceTableBorders(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: pageWidthDxa, type: WidthType.DXA },
            shading: { fill: '0B2545' },
            margins: { top: 260, bottom: 260, left: 280, right: 280 },
            children: [evidenceSectionTitleParagraph(section)]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: pageWidthDxa, type: WidthType.DXA },
            shading: { fill: 'EEF5FF' },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Table({
                width: { size: executiveInnerWidthDxa, type: WidthType.DXA },
                columnWidths: [executiveLabelWidthDxa, executiveValueWidthDxa],
                layout: TableLayoutType.FIXED,
                borders: tableBorders(),
                rows: [
                  executiveMetadataRow('Numero de test', testNumber),
                  executiveMetadataRow('Apartado evaluado', testScope, 'FFFFFF'),
                  executiveMetadataRow('Estado', section.actual),
                  executiveMetadataRow('Objetivo del test', section.description, 'FFFFFF'),
                  executiveMetadataRow('Criterio esperado', section.expected)
                ]
              })
            ]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: pageWidthDxa, type: WidthType.DXA },
            margins: { top: 220, bottom: 260, left: 240, right: 240 },
            children: bodyChildren.length ? bodyChildren : [textParagraph('No se registraron pasos para este test.')]
          })
        ]
      })
    ]
  });
}

function evidenceStepsContent(steps: EvidenceStep[]): Array<Paragraph | Table> {
  if (!steps.length) {
    return [textParagraph('No se registraron evidencias para este caso.')];
  }

  const content: Array<Paragraph | Table> = [];
  let currentSection: EvidenceStep | undefined;
  let currentSteps: EvidenceStep[] = [];

  const flushSection = () => {
    if (!currentSection) {
      return;
    }

    if (content.length > 0) {
      content.push(new Paragraph({ spacing: { before: 260, after: 260 }, children: [] }));
    }

    content.push(evidenceCaseTable(currentSection, currentSteps));
  };

  for (const step of steps) {
    if (step.section) {
      flushSection();
      currentSection = step;
      currentSteps = [];
      continue;
    }

    if (!currentSection) {
      currentSection = {
        title: 'TEST SIN ENCABEZADO',
        description: 'Pasos registrados sin encabezado de test.',
        expected: 'No aplica.',
        actual: 'No aplica.',
        section: true
      };
    }

    currentSteps.push(step);
  }

  flushSection();

  return content;
}

export class EvidenceReport {
  private readonly createdAt = new Date();
  private readonly steps: EvidenceStep[] = [];
  private readonly evidenceDir: string;
  readonly docxPath: string;

  constructor(
    private readonly testInfo: TestInfo,
    private readonly options: EvidenceReportOptions
  ) {
    const reportName = `${sanitizeFileName(options.caseId)}-${fileTimestamp(this.createdAt)}`;
    this.evidenceDir = join(process.cwd(), 'output', 'evidencias', reportName);
    this.docxPath = join(this.evidenceDir, `${reportName}.docx`);
    ensureDir(this.evidenceDir);
  }

  addStep(step: Omit<EvidenceStep, 'screenshotPath'>): void {
    this.steps.push({ ...step, section: true });
  }

  async capture(page: Page, step: EvidenceCaptureStep): Promise<void> {
    const screenshotPath = join(this.evidenceDir, `${pad(this.steps.length + 1)}-${sanitizeFileName(step.title)}.png`);
    const restoreHighlights = await this.applyHighlights(step.highlight);

    try {
      await page.screenshot({ path: screenshotPath, fullPage: false });
    } finally {
      await restoreHighlights();
    }

    this.steps.push({
      title: step.title,
      description: step.description,
      expected: step.expected,
      actual: step.actual,
      screenshotPath
    });
  }

  private async applyHighlights(highlight?: Locator | Locator[]): Promise<() => Promise<void>> {
    const locators = highlight ? (Array.isArray(highlight) ? highlight : [highlight]) : [];
    const restorers: Array<() => Promise<void>> = [];

    for (const locator of locators) {
      const target = locator.first();
      const isVisible = await target.isVisible().catch(() => false);

      if (!isVisible) {
        continue;
      }

      await target.scrollIntoViewIfNeeded().catch(() => {});

      const previousStyles = await target
        .evaluate((element) => {
          const htmlElement = element as HTMLElement;

          const previous = {
            outline: htmlElement.style.outline,
            outlineOffset: htmlElement.style.outlineOffset,
            boxShadow: htmlElement.style.boxShadow,
            borderRadius: htmlElement.style.borderRadius
          };

          htmlElement.style.outline = '5px solid #00B050';
          htmlElement.style.outlineOffset = '4px';
          htmlElement.style.boxShadow = '0 0 0 4px rgba(0, 176, 80, 0.25)';
          htmlElement.style.borderRadius = htmlElement.style.borderRadius || '4px';

          return previous;
        })
        .catch(() => undefined);

      if (!previousStyles) {
        continue;
      }

      restorers.push(async () => {
        await target
          .evaluate((element, previous) => {
            const htmlElement = element as HTMLElement;

            htmlElement.style.outline = previous.outline;
            htmlElement.style.outlineOffset = previous.outlineOffset;
            htmlElement.style.boxShadow = previous.boxShadow;
            htmlElement.style.borderRadius = previous.borderRadius;
          }, previousStyles)
          .catch(() => {});
      });
    }

    return async () => {
      for (const restore of restorers.reverse()) {
        await restore();
      }
    };
  }

  async finalize(page: Page, error?: unknown): Promise<void> {
    const status: EvidenceStatus = error ? 'Fallido' : 'Exitoso';

    if (error) {
      await this.capture(page, {
        title: 'Estado final fallido',
        description: 'Se captura el estado visible de la aplicacion al fallar la ejecucion automatizada.',
        expected: 'La evidencia debe mostrar el estado en el que fallo la prueba.',
        actual: this.errorMessage(error)
      }).catch(() => undefined);
    }

    await this.writeDocument(status);
    await this.testInfo.attach('Documento de evidencias', {
      path: this.docxPath,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private async writeDocument(status: EvidenceStatus): Promise<void> {
    const children: Array<Paragraph | Table> = [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: 'Evidencias de ejecucion automatizada',
            bold: true,
            color: '0B2545',
            size: 34
          })
        ]
      }),
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: this.options.description,
            color: '475569',
            size: 24
          })
        ]
      }),
      metadataTable([
        ['ID CASO DE PRUEBA', this.options.caseId],
        ['DESCRIPCION', this.options.description],
        ['ANALISTA', this.options.analyst],
        ['RESULTADO ESPERADO', this.options.expectedResult],
        ['RESULTADO OBTENIDO', status],
        ['FECHA EJECUCION', displayTimestamp(this.createdAt)],
        ['QUERY EJECUTADA', this.options.query ?? 'No aplica']
      ]),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 160 },
        children: [
          new TextRun({
            text: 'EVIDENCIAS DE LA EJECUCION',
            bold: true,
            color: '2E74B5',
            size: 28
          })
        ]
      })
    ];

    children.push(...evidenceStepsContent(this.steps));

    const document = new Document({
      creator: 'Playwright',
      title: 'Evidencias de ejecucion automatizada',
      description: 'Documento generado automaticamente por Playwright con pantallazos por paso.',
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
            }
          },
          children
        }
      ]
    });

    const buffer = await Packer.toBuffer(document);
    writeFileSync(this.docxPath, buffer);
  }
}
