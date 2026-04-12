'use strict';

// Day 1 — image loading only.
// Rendering engine (renderASCII, edge detection, braille, dithering)
// is added in Day 2 and beyond.

/**
 * Reads a File object and returns a Promise<HTMLCanvasElement>
 * containing the decoded image at its natural resolution.
 */
function fileToCanvas(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file: ' + file.name));
    reader.onload  = e => {
      const img = new Image();
      img.onerror = () => reject(new Error('Not a valid image: ' + file.name));
      img.onload  = () => {
        const canvas   = document.createElement('canvas');
        canvas.width   = img.naturalWidth;
        canvas.height  = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
