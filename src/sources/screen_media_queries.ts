/**
 * Screen characteristics detection using CSS media queries.
 *
 * Safari 17+ hides exact screen dimensions in private mode, but CSS media queries
 * still work and can probe for screen characteristics. This provides entropy
 * even when window.screen values are unreliable.
 *
 * Uses binary search with matchMedia to find approximate screen dimensions.
 */

export interface ScreenMediaQueries {
  /** Detected viewport width range */
  viewportWidth: [number, number]
  /** Detected viewport height range */
  viewportHeight: [number, number]
  /** Device pixel ratio from media query */
  pixelRatio: number
  /** Color depth from media query */
  colorBits: number
  /** Orientation */
  orientation: 'portrait' | 'landscape' | undefined
  /** Display mode */
  displayMode: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser' | undefined
  /** Pointer type */
  pointer: 'none' | 'coarse' | 'fine' | undefined
  /** Hover capability */
  hover: 'none' | 'hover' | undefined
  /** Any pointer type */
  anyPointer: 'none' | 'coarse' | 'fine' | undefined
  /** Any hover capability */
  anyHover: 'none' | 'hover' | undefined
  /** Overflow block */
  overflowBlock: 'none' | 'scroll' | 'paged' | undefined
  /** Overflow inline */
  overflowInline: 'none' | 'scroll' | undefined
  /** Update frequency */
  update: 'none' | 'slow' | 'fast' | undefined
  /** Scripting enabled */
  scripting: 'none' | 'initial-only' | 'enabled' | undefined
}

/**
 * Detects screen characteristics using CSS media queries.
 * This is more reliable than window.screen in Safari 17+ private mode.
 */
export default function getScreenMediaQueries(): ScreenMediaQueries {
  return {
    viewportWidth: detectDimensionRange('width'),
    viewportHeight: detectDimensionRange('height'),
    pixelRatio: detectPixelRatio(),
    colorBits: detectColorBits(),
    orientation: detectOrientation(),
    displayMode: detectDisplayMode(),
    pointer: detectPointer(),
    hover: detectHover(),
    anyPointer: detectAnyPointer(),
    anyHover: detectAnyHover(),
    overflowBlock: detectOverflowBlock(),
    overflowInline: detectOverflowInline(),
    update: detectUpdate(),
    scripting: detectScripting(),
  }
}

/**
 * Uses binary search with matchMedia to find viewport dimension range.
 * Returns [min, max] range where the actual value lies.
 */
function detectDimensionRange(dimension: 'width' | 'height'): [number, number] {
  const minQuery = dimension === 'width' ? 'min-width' : 'min-height'
  const maxQuery = dimension === 'width' ? 'max-width' : 'max-height'

  // Binary search for lower bound
  let low = 0
  let high = 8192 // Max reasonable screen dimension

  // Find the minimum value that matches
  while (high - low > 10) {
    const mid = Math.floor((low + high) / 2)
    if (matchMedia(`(${minQuery}: ${mid}px)`).matches) {
      low = mid
    } else {
      high = mid
    }
  }
  const minValue = low

  // Find the maximum value that matches
  low = 0
  high = 8192
  while (high - low > 10) {
    const mid = Math.floor((low + high) / 2)
    if (matchMedia(`(${maxQuery}: ${mid}px)`).matches) {
      high = mid
    } else {
      low = mid
    }
  }
  const maxValue = high

  return [minValue, maxValue]
}

/**
 * Detects device pixel ratio using media queries.
 */
function detectPixelRatio(): number {
  // Check common pixel ratios
  const ratios = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4]

  for (let i = ratios.length - 1; i >= 0; i--) {
    if (matchMedia(`(min-resolution: ${ratios[i]}dppx)`).matches) {
      return ratios[i]
    }
  }

  // Fallback to window.devicePixelRatio
  return window.devicePixelRatio || 1
}

/**
 * Detects color depth using media queries.
 */
function detectColorBits(): number {
  const depths = [1, 4, 8, 12, 16, 24, 30, 48]

  for (let i = depths.length - 1; i >= 0; i--) {
    if (matchMedia(`(min-color: ${depths[i]})`).matches) {
      return depths[i]
    }
  }

  return 0
}

/**
 * Detects screen orientation.
 */
function detectOrientation(): 'portrait' | 'landscape' | undefined {
  if (matchMedia('(orientation: portrait)').matches) {
    return 'portrait'
  }
  if (matchMedia('(orientation: landscape)').matches) {
    return 'landscape'
  }
  return undefined
}

/**
 * Detects display mode (PWA/fullscreen).
 */
function detectDisplayMode(): 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser' | undefined {
  if (matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen'
  }
  if (matchMedia('(display-mode: standalone)').matches) {
    return 'standalone'
  }
  if (matchMedia('(display-mode: minimal-ui)').matches) {
    return 'minimal-ui'
  }
  if (matchMedia('(display-mode: browser)').matches) {
    return 'browser'
  }
  return undefined
}

/**
 * Detects primary pointer type.
 */
function detectPointer(): 'none' | 'coarse' | 'fine' | undefined {
  if (matchMedia('(pointer: none)').matches) {
    return 'none'
  }
  if (matchMedia('(pointer: coarse)').matches) {
    return 'coarse'
  }
  if (matchMedia('(pointer: fine)').matches) {
    return 'fine'
  }
  return undefined
}

/**
 * Detects primary hover capability.
 */
function detectHover(): 'none' | 'hover' | undefined {
  if (matchMedia('(hover: none)').matches) {
    return 'none'
  }
  if (matchMedia('(hover: hover)').matches) {
    return 'hover'
  }
  return undefined
}

/**
 * Detects any pointer type available.
 */
function detectAnyPointer(): 'none' | 'coarse' | 'fine' | undefined {
  if (matchMedia('(any-pointer: fine)').matches) {
    return 'fine'
  }
  if (matchMedia('(any-pointer: coarse)').matches) {
    return 'coarse'
  }
  if (matchMedia('(any-pointer: none)').matches) {
    return 'none'
  }
  return undefined
}

/**
 * Detects any hover capability.
 */
function detectAnyHover(): 'none' | 'hover' | undefined {
  if (matchMedia('(any-hover: hover)').matches) {
    return 'hover'
  }
  if (matchMedia('(any-hover: none)').matches) {
    return 'none'
  }
  return undefined
}

/**
 * Detects overflow-block behavior.
 */
function detectOverflowBlock(): 'none' | 'scroll' | 'paged' | undefined {
  if (matchMedia('(overflow-block: none)').matches) {
    return 'none'
  }
  if (matchMedia('(overflow-block: scroll)').matches) {
    return 'scroll'
  }
  if (matchMedia('(overflow-block: paged)').matches) {
    return 'paged'
  }
  return undefined
}

/**
 * Detects overflow-inline behavior.
 */
function detectOverflowInline(): 'none' | 'scroll' | undefined {
  if (matchMedia('(overflow-inline: none)').matches) {
    return 'none'
  }
  if (matchMedia('(overflow-inline: scroll)').matches) {
    return 'scroll'
  }
  return undefined
}

/**
 * Detects screen update frequency.
 */
function detectUpdate(): 'none' | 'slow' | 'fast' | undefined {
  if (matchMedia('(update: none)').matches) {
    return 'none'
  }
  if (matchMedia('(update: slow)').matches) {
    return 'slow'
  }
  if (matchMedia('(update: fast)').matches) {
    return 'fast'
  }
  return undefined
}

/**
 * Detects scripting capability.
 */
function detectScripting(): 'none' | 'initial-only' | 'enabled' | undefined {
  if (matchMedia('(scripting: none)').matches) {
    return 'none'
  }
  if (matchMedia('(scripting: initial-only)').matches) {
    return 'initial-only'
  }
  if (matchMedia('(scripting: enabled)').matches) {
    return 'enabled'
  }
  return undefined
}
