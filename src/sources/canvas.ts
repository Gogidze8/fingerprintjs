import { isSafariWebKit, isWebKit, isWebKit616OrNewer } from '../utils/browser'

export interface CanvasFingerprint {
  winding: boolean
  geometry: string
  text: string
}

export const enum ImageStatus {
  Unsupported = 'unsupported',
  Skipped = 'skipped',
  Unstable = 'unstable',
}

/**
 * @see https://www.browserleaks.com/canvas#how-does-it-work
 *
 * A version of the entropy source with stabilization to make it suitable for static fingerprinting.
 * For Safari 17+ which adds noise, we use multi-sample majority voting to extract stable pixels.
 */
export default function getCanvasFingerprint(): CanvasFingerprint {
  if (doesBrowserPerformAntifingerprinting()) {
    return getNoiseResistantCanvasFingerprint()
  }
  return getUnstableCanvasFingerprint(false)
}

/**
 * A version of the entropy source without stabilization.
 *
 * Warning for package users:
 * This function is out of Semantic Versioning, i.e. can change unexpectedly. Usage is at your own risk.
 */
export function getUnstableCanvasFingerprint(skipImages?: boolean): CanvasFingerprint {
  let winding = false
  let geometry: string
  let text: string

  const [canvas, context] = makeCanvasContext()
  if (!isSupported(canvas, context)) {
    geometry = text = ImageStatus.Unsupported
  } else {
    winding = doesSupportWinding(context)

    if (skipImages) {
      geometry = text = ImageStatus.Skipped
    } else {
      ;[geometry, text] = renderImages(canvas, context)
    }
  }

  return { winding, geometry, text }
}

function makeCanvasContext() {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return [canvas, canvas.getContext('2d')] as const
}

function isSupported(
  canvas: HTMLCanvasElement,
  context?: CanvasRenderingContext2D | null,
): context is CanvasRenderingContext2D {
  return !!(context && canvas.toDataURL)
}

function doesSupportWinding(context: CanvasRenderingContext2D) {
  // https://web.archive.org/web/20170825024655/http://blogs.adobe.com/webplatform/2013/01/30/winding-rules-in-canvas/
  // https://github.com/Modernizr/Modernizr/blob/master/feature-detects/canvas/winding.js
  context.rect(0, 0, 10, 10)
  context.rect(2, 2, 6, 6)
  return !context.isPointInPath(5, 5, 'evenodd')
}

function renderImages(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): [geometry: string, text: string] {
  renderTextImage(canvas, context)
  const textImage1 = canvasToString(canvas)
  const textImage2 = canvasToString(canvas) // It's slightly faster to double-encode the text image

  // Some browsers add a noise to the canvas: https://github.com/fingerprintjs/fingerprintjs/issues/791
  // The canvas is excluded from the fingerprint in this case
  if (textImage1 !== textImage2) {
    return [ImageStatus.Unstable, ImageStatus.Unstable]
  }

  // Text is unstable:
  // https://github.com/fingerprintjs/fingerprintjs/issues/583
  // https://github.com/fingerprintjs/fingerprintjs/issues/103
  // Therefore it's extracted into a separate image.
  renderGeometryImage(canvas, context)
  const geometryImage = canvasToString(canvas)
  return [geometryImage, textImage1]
}

function renderTextImage(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  // Resizing the canvas cleans it
  canvas.width = 240
  canvas.height = 60

  context.textBaseline = 'alphabetic'
  context.fillStyle = '#f60'
  context.fillRect(100, 1, 62, 20)

  context.fillStyle = '#069'
  // It's important to use explicit built-in fonts in order to exclude the affect of font preferences
  // (there is a separate entropy source for them).
  context.font = '11pt "Times New Roman"'
  // The choice of emojis has a gigantic impact on rendering performance (especially in FF).
  // Some newer emojis cause it to slow down 50-200 times.
  // There must be no text to the right of the emoji, see https://github.com/fingerprintjs/fingerprintjs/issues/574
  // A bare emoji shouldn't be used because the canvas will change depending on the script encoding:
  // https://github.com/fingerprintjs/fingerprintjs/issues/66
  // Escape sequence shouldn't be used too because Terser will turn it into a bare unicode.
  const printedText = `Cwm fjordbank gly ${String.fromCharCode(55357, 56835) /* 😃 */}`
  context.fillText(printedText, 2, 15)
  context.fillStyle = 'rgba(102, 204, 0, 0.2)'
  context.font = '18pt Arial'
  context.fillText(printedText, 4, 45)
}

function renderGeometryImage(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  // Resizing the canvas cleans it
  canvas.width = 122
  canvas.height = 110

  // Canvas blending
  // https://web.archive.org/web/20170826194121/http://blogs.adobe.com/webplatform/2013/01/28/blending-features-in-canvas/
  // http://jsfiddle.net/NDYV8/16/
  context.globalCompositeOperation = 'multiply'
  for (const [color, x, y] of [
    ['#f2f', 40, 40],
    ['#2ff', 80, 40],
    ['#ff2', 60, 80],
  ] as const) {
    context.fillStyle = color
    context.beginPath()
    context.arc(x, y, 40, 0, Math.PI * 2, true)
    context.closePath()
    context.fill()
  }

  // Canvas winding
  // https://web.archive.org/web/20130913061632/http://blogs.adobe.com/webplatform/2013/01/30/winding-rules-in-canvas/
  // http://jsfiddle.net/NDYV8/19/
  context.fillStyle = '#f9c'
  context.arc(60, 60, 60, 0, Math.PI * 2, true)
  context.arc(60, 60, 20, 0, Math.PI * 2, true)
  context.fill('evenodd')
}

function canvasToString(canvas: HTMLCanvasElement) {
  return canvas.toDataURL()
}

/**
 * Checks if the current browser is known for applying anti-fingerprinting measures in all or some critical modes
 */
function doesBrowserPerformAntifingerprinting() {
  // Safari 17
  return isWebKit() && isWebKit616OrNewer() && isSafariWebKit()
}

/**
 * Scale factor for canvas denoising.
 * WebKit's noise is clamped based on neighboring pixels.
 * By scaling 3x3, the center pixel of each block has 8 identical neighbors,
 * forcing the noise to clamp to the original value.
 *
 * @see https://github.com/google/security-research/security/advisories/GHSA-24cm-69m9-fpw3
 */
const DENOISE_SCALE = 3

/**
 * Noise-resistant canvas fingerprinting for Safari 17+.
 *
 * Safari 17 adds noise to canvas readback, but the noise is clamped based on
 * neighboring pixel colors. If all 8 neighbors have the same color, the noise
 * is clamped to that color (effectively no noise).
 *
 * This exploit works by:
 * 1. Drawing the fingerprintable content on canvas c1
 * 2. Scaling c1 to c2 at 3x3 with imageSmoothingEnabled=false
 * 3. Reading pixel data from c2 (noise is applied here)
 * 4. For each original pixel, read the CENTER of its 3x3 block
 * 5. The center pixel has 8 identical neighbors, so noise is clamped away
 *
 * @see https://github.com/google/security-research/security/advisories/GHSA-24cm-69m9-fpw3
 */
function getNoiseResistantCanvasFingerprint(): CanvasFingerprint {
  const [canvas, context] = makeCanvasContext()
  if (!isSupported(canvas, context)) {
    return { winding: false, geometry: ImageStatus.Unsupported, text: ImageStatus.Unsupported }
  }

  const winding = doesSupportWinding(context)

  // Get denoised geometry image
  const geometry = getDenoisedCanvasData(canvas, context, renderGeometryImage)

  // Get denoised text image
  const text = getDenoisedCanvasData(canvas, context, renderTextImage)

  return { winding, geometry, text }
}

/**
 * Renders content and extracts denoised pixel data using the scaling exploit.
 *
 * WebKit's canvas noise algorithm clamps noise based on neighboring pixels.
 * By scaling the canvas 3x3 without smoothing, each original pixel becomes
 * a 3x3 block of identical pixels. When we read the center pixel, it has
 * 8 identical neighbors, so the noise is clamped to the original color.
 */
function getDenoisedCanvasData(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  renderFn: (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => void,
): string {
  // Step 1: Render the content on the source canvas
  renderFn(canvas, context)
  const originalWidth = canvas.width
  const originalHeight = canvas.height

  // Step 2: Create a scaled canvas (3x3)
  const scaledCanvas = document.createElement('canvas')
  scaledCanvas.width = originalWidth * DENOISE_SCALE
  scaledCanvas.height = originalHeight * DENOISE_SCALE
  const scaledContext = scaledCanvas.getContext('2d')

  if (!scaledContext) {
    // Fallback to regular toDataURL if we can't create scaled context
    return canvas.toDataURL()
  }

  // Step 3: Disable image smoothing - this is critical!
  // Without this, the scaling would interpolate and we'd lose the exploit
  scaledContext.imageSmoothingEnabled = false

  // Step 4: Draw the source canvas scaled up
  // The drawImage itself doesn't trigger noise - only getImageData/toDataURL does
  scaledContext.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height)

  // Step 5: Read the scaled pixel data (noise is applied here)
  const scaledImageData = scaledContext.getImageData(0, 0, scaledCanvas.width, scaledCanvas.height)

  // Step 6: Extract the center pixel of each 3x3 block to get denoised values
  const denoisedData = new Uint8ClampedArray(originalWidth * originalHeight * 4)

  for (let y = 0; y < originalHeight; y++) {
    for (let x = 0; x < originalWidth; x++) {
      // Calculate the center pixel position in the scaled image
      // For a 3x3 block, the center is at offset (1,1) from the block's top-left
      const scaledX = x * DENOISE_SCALE + Math.floor(DENOISE_SCALE / 2)
      const scaledY = y * DENOISE_SCALE + Math.floor(DENOISE_SCALE / 2)

      const scaledIdx = (scaledY * scaledCanvas.width + scaledX) * 4
      const originalIdx = (y * originalWidth + x) * 4

      // Copy RGBA values from center pixel
      denoisedData[originalIdx] = scaledImageData.data[scaledIdx] // R
      denoisedData[originalIdx + 1] = scaledImageData.data[scaledIdx + 1] // G
      denoisedData[originalIdx + 2] = scaledImageData.data[scaledIdx + 2] // B
      denoisedData[originalIdx + 3] = scaledImageData.data[scaledIdx + 3] // A
    }
  }

  // Step 7: Create a canvas with denoised data and convert to data URL
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = originalWidth
  outputCanvas.height = originalHeight
  const outputContext = outputCanvas.getContext('2d')

  if (!outputContext) {
    return canvas.toDataURL()
  }

  const outputImageData = outputContext.createImageData(originalWidth, originalHeight)
  outputImageData.data.set(denoisedData)
  outputContext.putImageData(outputImageData, 0, 0)

  return outputCanvas.toDataURL()
}
