// ============================================================
// SIRA PLATFORM v4 - PDF Voucher Generation Service
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as bwipjs from 'bwip-js';
import { Readable } from 'stream';

export interface VoucherCardData {
  code: string;
  profileName: string;
  batchName: string;
  companyName: string;
  expiresAt?: string;
  wifiSsid?: string;
}

@Injectable()
export class VoucherPdfService {
  private readonly logger = new Logger(VoucherPdfService.name);

  // Layout constants (points, 1pt = 1/72 inch)
  private readonly PAGE_WIDTH = 595.28; // A4
  private readonly PAGE_HEIGHT = 841.89; // A4
  private readonly CARD_WIDTH = 170;
  private readonly CARD_HEIGHT = 105;
  private readonly COLS = 3;
  private readonly ROWS = 7;
  private readonly MARGIN_X = (this.PAGE_WIDTH - this.COLS * this.CARD_WIDTH) / 2;
  private readonly MARGIN_Y = 30;
  private readonly GAP_X = 5;
  private readonly GAP_Y = 5;

  /**
   * Generates a professional A4 PDF sheet with hotspot voucher cards.
   * Each card includes: QR code, barcode, code text, profile info, branding.
   */
  async generateVoucherPdf(
    voucherData: VoucherCardData[],
    options?: {
      title?: string;
      logoBase64?: string;
      primaryColor?: string;
    },
  ): Promise<Buffer> {
    return new Promise<Buffer>(async (resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'A4',
          margin: 0,
          info: {
            Title: options?.title || 'بطاقات الإنترنت - Sira Platform',
            Author: 'Sira Platform v4',
            Subject: 'Hotspot Vouchers',
          },
        });

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const primaryColor = options?.primaryColor || '#1a56db';
        const cardsPerPage = this.COLS * this.ROWS;

        for (let i = 0; i < voucherData.length; i++) {
          if (i > 0 && i % cardsPerPage === 0) {
            doc.addPage();
          }

          const posOnPage = i % cardsPerPage;
          const col = posOnPage % this.COLS;
          const row = Math.floor(posOnPage / this.COLS);

          const x =
            this.MARGIN_X + col * (this.CARD_WIDTH + this.GAP_X);
          const y =
            this.MARGIN_Y + row * (this.CARD_HEIGHT + this.GAP_Y);

          await this.drawVoucherCard(doc, voucherData[i], x, y, primaryColor);
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private async drawVoucherCard(
    doc: PDFKit.PDFDocument,
    card: VoucherCardData,
    x: number,
    y: number,
    primaryColor: string,
  ): Promise<void> {
    const W = this.CARD_WIDTH;
    const H = this.CARD_HEIGHT;

    // Card background
    doc
      .save()
      .roundedRect(x, y, W, H, 6)
      .fillAndStroke('#ffffff', '#e5e7eb');

    // Header bar
    doc
      .fillColor(primaryColor)
      .roundedRect(x, y, W, 22, 6)
      .fill()
      // Fix bottom corners of header
      .rect(x, y + 10, W, 12)
      .fill();

    // Company name in header
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(card.companyName, x + 5, y + 7, {
        width: W - 10,
        align: 'left',
      });

    // Profile badge
    doc
      .fillColor('#f3f4f6')
      .roundedRect(x + W - 60, y + 25, 55, 13, 3)
      .fill()
      .fillColor(primaryColor)
      .font('Helvetica')
      .fontSize(7)
      .text(card.profileName, x + W - 58, y + 28, { width: 51, align: 'center' });

    // WiFi SSID if provided
    if (card.wifiSsid) {
      doc
        .fillColor('#374151')
        .font('Helvetica')
        .fontSize(7)
        .text(`WiFi: ${card.wifiSsid}`, x + 5, y + 28, { width: W - 70 });
    }

    // Generate QR code
    try {
      const qrDataUrl = await QRCode.toDataURL(card.code, {
        errorCorrectionLevel: 'M',
        width: 70,
        margin: 1,
        color: { dark: '#1f2937', light: '#ffffff' },
      });
      const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
      const qrBuffer = Buffer.from(qrBase64, 'base64');

      doc.image(qrBuffer, x + 5, y + 43, { width: 52, height: 52 });
    } catch (err) {
      this.logger.warn(`QR generation failed for ${card.code}: ${err.message}`);
    }

    // Code display (large, clear)
    doc
      .fillColor('#111827')
      .font('Courier-Bold')
      .fontSize(11)
      .text(card.code, x + 62, y + 43, { width: W - 68, align: 'center' });

    // Batch name
    doc
      .fillColor('#6b7280')
      .font('Helvetica')
      .fontSize(6.5)
      .text(card.batchName, x + 62, y + 58, {
        width: W - 68,
        align: 'center',
      });

    // Generate barcode
    try {
      const barcodeBuffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text: card.code,
        scale: 1.5,
        height: 8,
        includetext: false,
        backgroundcolor: 'ffffff',
      });
      doc.image(barcodeBuffer, x + 5, y + H - 22, {
        width: W - 10,
        height: 16,
      });
    } catch (err) {
      this.logger.warn(`Barcode generation failed for ${card.code}: ${err.message}`);
    }

    // Expiry (if set)
    if (card.expiresAt) {
      doc
        .fillColor('#9ca3af')
        .font('Helvetica')
        .fontSize(6)
        .text(`تنتهي: ${card.expiresAt}`, x + 5, y + H - 27, {
          width: W - 10,
          align: 'right',
        });
    }

    doc.restore();
  }

  /**
   * Generates a single-voucher receipt (for printing one at a time).
   */
  async generateVoucherReceipt(card: VoucherCardData): Promise<Buffer> {
    return new Promise<Buffer>(async (resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: [226, 340], margin: 10 }); // 80mm receipt

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fillColor('#1a56db').font('Helvetica-Bold').fontSize(14).text('Sira Platform', {
        align: 'center',
      });
      doc.fillColor('#374151').font('Helvetica').fontSize(10).text(card.companyName, {
        align: 'center',
      });
      doc.moveDown(0.5);

      // Divider
      doc.strokeColor('#e5e7eb').moveTo(10, doc.y).lineTo(216, doc.y).stroke();
      doc.moveDown(0.5);

      // QR code
      const qrDataUrl = await QRCode.toDataURL(card.code, { width: 150, margin: 1 });
      const qrBuffer = Buffer.from(
        qrDataUrl.replace(/^data:image\/png;base64,/, ''),
        'base64',
      );
      doc.image(qrBuffer, 38, doc.y, { width: 150 });
      doc.moveDown(0.5);

      // Code
      doc
        .fillColor('#111827')
        .font('Courier-Bold')
        .fontSize(16)
        .text(card.code, { align: 'center' });

      doc.fillColor('#6b7280').font('Helvetica').fontSize(9).text(card.profileName, {
        align: 'center',
      });

      doc.end();
    });
  }
}
