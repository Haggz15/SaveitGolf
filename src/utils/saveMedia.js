import { Platform } from 'react-native';

// Shared by saveMediaToDevice and the watermarked-save flow (Fix 3): both
// end up with a local file URI (the latter via <MediaWatermarker>'s
// off-screen capture) that just needs permission to write into the camera
// roll.
export async function saveLocalUriToLibrary(uri) {
  // Required lazily: this native module isn't available on web and throws
  // at import time if loaded statically there.
  const MediaLibrary = require('expo-media-library');

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('PERMISSION_DENIED');
  }
  await MediaLibrary.saveToLibraryAsync(uri);
}

function downloadBlobWeb(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

// Downloads a post's media and saves it to the device's camera roll (native)
// or triggers a real file download (web) — used by the Feed's bookmark
// button. Web needs a blob: URL rather than the bare media_url so the
// browser downloads the file instead of just navigating to it.
export async function saveMediaToDevice(mediaUrl) {
  if (Platform.OS === 'web') {
    const response = await fetch(mediaUrl);
    const blob = await response.blob();
    const filename = mediaUrl.split('/').pop()?.split('?')[0] || 'saveitgolf-media';
    downloadBlobWeb(blob, filename);
    return;
  }

  // Required lazily: this native module isn't available on web and throws
  // at import time if loaded statically there.
  const { File, Paths, Directory } = require('expo-file-system');

  // saveToLibraryAsync needs a local file, not a remote URL, so download it
  // into the cache directory first.
  const downloaded = await File.downloadFileAsync(mediaUrl, new Directory(Paths.cache), {
    idempotent: true,
  });
  await saveLocalUriToLibrary(downloaded.uri);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

// Web half of the watermarked save (Fix 3): composites the SaveitGolf mark
// ("Save it" white / "Golf" red, dark pill, top-right) onto the image with a
// plain <canvas> — cheap on web and keeps the original resolution, unlike
// the native ViewShot route. Falls back to a plain, unwatermarked download
// if the image can't be read back off the canvas (e.g. blocked by CORS).
export async function saveImageWithWatermarkWeb(mediaUrl) {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = mediaUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const padding = 20;
    const fontSize = Math.max(24, img.naturalWidth * 0.04);
    ctx.font = `bold ${fontSize}px "Dancing Script", cursive`;
    ctx.textBaseline = 'alphabetic';

    const label1 = 'Save it';
    const label2 = ' Golf';
    const pillHeight = fontSize + 16;
    const pillWidth = ctx.measureText(label1 + label2).width + 32;
    const pillX = img.naturalWidth - pillWidth - padding;
    const pillY = padding;

    ctx.fillStyle = 'rgba(13,31,60,0.7)';
    drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
    ctx.fill();

    const textX = pillX + 16;
    const textY = pillY + pillHeight / 2 + fontSize * 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label1, textX, textY);
    ctx.fillStyle = '#c0001a';
    ctx.fillText(label2, textX + ctx.measureText(label1).width, textY);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('CANVAS_TAINTED'))), 'image/jpeg', 0.95);
    });
    downloadBlobWeb(blob, `SaveitGolf-${Date.now()}.jpg`);
  } catch (err) {
    console.error('Failed to watermark image, saving without watermark:', err);
    const response = await fetch(mediaUrl);
    const blob = await response.blob();
    downloadBlobWeb(blob, `SaveitGolf-${Date.now()}.jpg`);
  }
}
