/**
 * Minimal PDF writer: one JPEG image per page. Used for the printable
 * calendar export, including the three-page "all views" PDF.
 */
(function (TSB) {
  'use strict';

  const encoder = new TextEncoder();

  /**
   * @typedef {Object} PdfPage
   * @property {Uint8Array} jpeg   JPEG bytes
   * @property {number} width      image width in pixels
   * @property {number} height     image height in pixels
   * @property {number} [pageWidth]  page size in points; defaults to US Letter landscape
   * @property {number} [pageHeight]
   * @property {number} [margin]     space around the image, in points (default 24)
   */

  /**
   * @param {PdfPage[]} pages
   * @returns {Uint8Array} the PDF file
   */
  function buildPdf(pages) {
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

    // Objects: 1 catalog, 2 page tree, then three per page (page, image, drawing).
    const pageObject = (i) => 3 + i * 3;
    const objectCount = 2 + pages.length * 3;

    write('%PDF-1.4\n');
    object(1, () => write('<< /Type /Catalog /Pages 2 0 R >>'));
    object(2, () => write(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObject(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`));

    pages.forEach((page, i) => {
      const pageWidth = page.pageWidth || 792;
      const pageHeight = page.pageHeight || 612;
      const margin = page.margin ?? 24;
      const scale = Math.min((pageWidth - 2 * margin) / page.width, (pageHeight - 2 * margin) / page.height);
      const drawWidth = page.width * scale;
      const drawHeight = page.height * scale;
      const x = (pageWidth - drawWidth) / 2;
      const y = (pageHeight - drawHeight) / 2;
      const content = `q ${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
      const [pageNum, imageNum, contentNum] = [pageObject(i), pageObject(i) + 1, pageObject(i) + 2];

      object(pageNum, () => write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageNum} 0 R >> >> /Contents ${contentNum} 0 R >>`));
      object(imageNum, () => {
        write(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
        write(page.jpeg);
        write('\nendstream');
      });
      object(contentNum, () => write(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    });

    const xrefOffset = length;
    let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objectCount; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    write(`${xref}trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    const result = new Uint8Array(length);
    let position = 0;
    for (const chunk of chunks) {
      result.set(chunk, position);
      position += chunk.length;
    }
    return result;
  }

  /**
   * A one-page PDF.
   * @param {Uint8Array} jpegBytes
   * @param {number} imageWidth  pixels
   * @param {number} imageHeight pixels
   * @param {{pageWidth?: number, pageHeight?: number, margin?: number}} [options] points
   * @returns {Uint8Array}
   */
  function buildImagePdf(jpegBytes, imageWidth, imageHeight, options = {}) {
    return buildPdf([{ jpeg: jpegBytes, width: imageWidth, height: imageHeight, ...options }]);
  }

  TSB.pdf = Object.freeze({ buildPdf, buildImagePdf });
})(globalThis.TSB = globalThis.TSB || {});
