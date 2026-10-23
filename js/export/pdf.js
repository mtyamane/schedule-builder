/**
 * Minimal one-page PDF writer that places a single JPEG image on a page.
 * Used for the printable calendar export.
 */
(function (TSB) {
  'use strict';

  const encoder = new TextEncoder();

  /**
   * @param {Uint8Array} jpegBytes
   * @param {number} imageWidth  pixels
   * @param {number} imageHeight pixels
   * @param {{pageWidth?: number, pageHeight?: number, margin?: number}} [options] points; defaults to US Letter landscape
   * @returns {Uint8Array} the PDF file
   */
  function buildImagePdf(jpegBytes, imageWidth, imageHeight, options = {}) {
    const pageWidth = options.pageWidth || 792;
    const pageHeight = options.pageHeight || 612;
    const margin = options.margin ?? 24;

    const scale = Math.min((pageWidth - 2 * margin) / imageWidth, (pageHeight - 2 * margin) / imageHeight);
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;
    const content = `q ${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;

    const chunks = [];
    const offsets = [];
    let length = 0;
    const write = (part) => {
      const bytes = typeof part === 'string' ? encoder.encode(part) : part;
      chunks.push(bytes);
      length += bytes.length;
    };
    const object = (number, writeBody) => {
      offsets[number] = length;
      write(`${number} 0 obj\n`);
      writeBody();
      write('\nendobj\n');
    };

    write('%PDF-1.4\n');
    object(1, () => write('<< /Type /Catalog /Pages 2 0 R >>'));
    object(2, () => write('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
    object(3, () => write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
    object(4, () => {
      write(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
      write(jpegBytes);
      write('\nendstream');
    });
    object(5, () => write(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));

    const xrefOffset = length;
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    write(`${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    const result = new Uint8Array(length);
    let position = 0;
    for (const chunk of chunks) {
      result.set(chunk, position);
      position += chunk.length;
    }
    return result;
  }

  TSB.pdf = Object.freeze({ buildImagePdf });
})(globalThis.TSB = globalThis.TSB || {});
