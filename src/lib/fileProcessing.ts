/**
 * Client-side file processing, validation, and conversion helpers
 */

export interface ProcessedFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  data: string; // base64 string
  thumb?: string; // small thumbnail data URL for photos
  isImage: boolean;
}

/**
 * Remove path characters and limit to 120 characters
 */
export function sanitizeFileName(name: string): string {
  if (!name) return 'file';
  // Remove path separators and reserved file system characters
  const clean = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return clean.slice(0, 120) || 'file';
}

/**
 * Format bytes to readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Maps extension / mime to exact permitted Firestore rules MIME types
 */
export function getDocumentMimeType(fileName: string, mime?: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'csv') return 'text/csv';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

  if (mime === 'application/pdf') return 'application/pdf';
  if (mime === 'text/plain') return 'text/plain';
  if (mime === 'text/csv') return 'text/csv';
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return mime;
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return mime;
  if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return mime;

  return 'application/pdf';
}

/**
 * Validates allowed files
 * Allowed:
 * Photo: image/png, image/jpeg, image/webp, image/gif
 * Document: PDF, TXT, CSV, DOCX, XLSX, PPTX
 * Everything else blocked with error "This file type isn't supported"
 */
export function validateSelectedFile(file: File): {
  valid: boolean;
  isPhoto: boolean;
  error?: string;
} {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop() || '';

  // Explicitly blocked extensions and types
  const blocked = [
    'svg',
    'html',
    'htm',
    'js',
    'mjs',
    'exe',
    'zip',
    'tar',
    'gz',
    'rar',
    '7z',
    'bat',
    'cmd',
    'sh',
    'php',
    'bin',
  ];
  if (
    blocked.includes(ext) ||
    file.type === 'image/svg+xml' ||
    file.type.includes('html') ||
    file.type.includes('javascript') ||
    file.type === 'application/zip'
  ) {
    return { valid: false, isPhoto: false, error: "This file type isn't supported" };
  }

  // Check photos
  const photoExts = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
  const photoMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (photoExts.includes(ext) || photoMimes.includes(file.type)) {
    return { valid: true, isPhoto: true };
  }

  // Check documents
  const docExts = ['pdf', 'txt', 'csv', 'docx', 'xlsx', 'pptx'];
  if (docExts.includes(ext)) {
    // Document limit: 500 KB
    if (file.size > 500 * 1024) {
      return {
        valid: false,
        isPhoto: false,
        error: 'Documents can be up to 500 KB in this version',
      };
    }
    return { valid: true, isPhoto: false };
  }

  return { valid: false, isPhoto: false, error: "This file type isn't supported" };
}

/**
 * Check if canvas image has any transparent pixels
 */
function checkTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const imgData = ctx.getImageData(0, 0, width, height).data;
    // Step by 16 pixels (4 * 4 channels) for fast scanning
    for (let i = 3; i < imgData.length; i += 16) {
      if (imgData[i] < 250) {
        return true;
      }
    }
  } catch (_) {}
  return false;
}

/**
 * Photos:
 * 1. Draw to canvas, scale longest side <= 1280px
 * 2. Export JPEG at quality 0.75 (keep PNG only if image has transparency and is small < 450 KB)
 * 3. Lower quality in steps down to 0.5 until result is under 450 KB
 * 4. If still too large, reduce longest side to 960px
 * 5. Create small thumbnail (longest side 240px, JPEG quality 0.6, under 15 KB)
 */
export async function processPhotoFile(file: File): Promise<ProcessedFile> {
  const sanitizedName = sanitizeFileName(file.name);
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = objectUrl;
  });
  URL.revokeObjectURL(objectUrl);

  const origWidth = img.naturalWidth || img.width || 100;
  const origHeight = img.naturalHeight || img.height || 100;

  const renderToCanvas = (maxDim: number) => {
    let w = origWidth;
    let h = origHeight;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, w);
    canvas.height = Math.max(1, h);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
    }
    return { canvas, ctx, width: w, height: h };
  };

  // Step 1: Initial scale: longest side at most 1280px
  let { canvas, ctx, width, height } = renderToCanvas(1280);
  const hasTransparency = ctx ? checkTransparency(ctx, width, height) : false;

  let exportType = 'image/jpeg';
  let dataUrl = '';

  // Keep PNG only if transparency exists and result is small (< 450 KB)
  if (file.type === 'image/png' && hasTransparency) {
    const pngData = canvas.toDataURL('image/png');
    const approxSize = Math.round((pngData.length - pngData.indexOf(',') - 1) * 0.75);
    if (approxSize < 450 * 1024) {
      exportType = 'image/png';
      dataUrl = pngData;
    }
  }

  // If not kept as PNG, export as JPEG
  if (!dataUrl) {
    exportType = 'image/jpeg';
    let quality = 0.75;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    let size = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

    // Lower quality down to 0.5 in steps
    const steps = [0.7, 0.65, 0.6, 0.55, 0.5];
    for (const q of steps) {
      if (size < 450 * 1024) break;
      quality = q;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      size = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
    }

    // If still >= 450 KB, reduce longest side to 960px
    if (size >= 450 * 1024) {
      const scaled = renderToCanvas(960);
      canvas = scaled.canvas;
      quality = 0.75;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      size = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

      for (const q of steps) {
        if (size < 450 * 1024) break;
        quality = q;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        size = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
      }
    }
  }

  const base64Data = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const finalSize = Math.round(base64Data.length * 0.75);

  // Step 5: Create small thumbnail (longest side 240px, JPEG quality 0.6, under 15 KB)
  const thumbScaled = renderToCanvas(240);
  let thumbQuality = 0.6;
  let thumbDataUrl = thumbScaled.canvas.toDataURL('image/jpeg', thumbQuality);
  let thumbSize = Math.round((thumbDataUrl.length - thumbDataUrl.indexOf(',') - 1) * 0.75);

  if (thumbSize >= 15 * 1024) {
    for (const tq of [0.5, 0.4, 0.3]) {
      thumbQuality = tq;
      thumbDataUrl = thumbScaled.canvas.toDataURL('image/jpeg', thumbQuality);
      thumbSize = Math.round((thumbDataUrl.length - thumbDataUrl.indexOf(',') - 1) * 0.75);
      if (thumbSize < 15 * 1024) break;
    }
  }

  return {
    fileName: sanitizedName,
    fileType: exportType,
    fileSize: finalSize,
    data: base64Data,
    thumb: thumbDataUrl,
    isImage: true,
  };
}

/**
 * Documents: read as base64 using FileReader
 */
export async function processDocumentFile(file: File): Promise<ProcessedFile> {
  const sanitizedName = sanitizeFileName(file.name);
  const mimeType = getDocumentMimeType(file.name, file.type);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.slice(result.indexOf(',') + 1);
      resolve({
        fileName: sanitizedName,
        fileType: mimeType,
        fileSize: file.size,
        data: base64Data,
        isImage: false,
      });
    };
    reader.onerror = () => reject(new Error('Failed to read document'));
    reader.readAsDataURL(file);
  });
}

/**
 * Build Blob from base64 string and start client-side download
 * Never renders documents inside page, never opens file data as a page
 */
export function downloadFileFromBase64(fileName: string, fileType: string, base64Data: string) {
  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: fileType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
