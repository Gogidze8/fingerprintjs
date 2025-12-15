/**
 * TLS Fingerprint integration (Server-Side Required).
 *
 * TLS fingerprinting (JA3/JA4) cannot be done client-side because browsers
 * don't expose TLS-level APIs to JavaScript. The TLS handshake happens
 * before JavaScript runs.
 *
 * This source provides infrastructure for integrating with a server-side
 * TLS fingerprint endpoint. Users must deploy their own server that captures
 * the TLS ClientHello and returns the fingerprint.
 *
 * Example server endpoints:
 * - https://ja3.zone/check (public test endpoint)
 * - Custom server using ja3 library: https://github.com/salesforce/ja3
 *
 * @see https://engineering.salesforce.com/tls-fingerprinting-with-ja3-and-ja3s-247362855967/
 */

export interface TLSFingerprint {
  /** JA3 fingerprint hash */
  ja3: string | undefined
  /** JA3 full string (before hashing) */
  ja3Full: string | undefined
  /** JA4 fingerprint (newer, more robust) */
  ja4: string | undefined
  /** Whether the fetch succeeded */
  success: boolean
  /** Error message if failed */
  error: string | undefined
}

export interface TLSFingerprintOptions {
  /**
   * URL of your TLS fingerprint endpoint.
   * The endpoint should return JSON with ja3, ja3Full, and/or ja4 fields.
   *
   * Example response:
   * {
   *   "ja3": "771,4866-4867-4865-49199-49200...",
   *   "ja3_hash": "cd08e31494f9531f560d64c695473da9",
   *   "ja4": "t13d1517h2_8daaf6152771_b186095e22b6"
   * }
   */
  endpoint?: string
  /** Request timeout in milliseconds (default: 3000) */
  timeout?: number
}

/**
 * Default configuration - no endpoint means this source is disabled.
 */
const defaultOptions: TLSFingerprintOptions = {
  endpoint: undefined,
  timeout: 3000,
}

let configuredOptions: TLSFingerprintOptions = { ...defaultOptions }

/**
 * Configure the TLS fingerprint source with your server endpoint.
 *
 * Call this before loading the fingerprint agent:
 * ```
 * import { configureTLSFingerprint } from '@fingerprintjs/fingerprintjs'
 * configureTLSFingerprint({ endpoint: 'https://your-server.com/tls-fingerprint' })
 * ```
 */
export function configureTLSFingerprint(options: TLSFingerprintOptions): void {
  configuredOptions = { ...defaultOptions, ...options }
}

/**
 * Fetches TLS fingerprint from configured server endpoint.
 *
 * This source requires a server-side component to work.
 * If no endpoint is configured, returns undefined values.
 */
export default async function getTLSFingerprint(): Promise<TLSFingerprint> {
  const { endpoint, timeout } = configuredOptions

  // No endpoint configured - return empty result
  if (!endpoint) {
    return {
      ja3: undefined,
      ja3Full: undefined,
      ja4: undefined,
      success: false,
      error: 'No TLS fingerprint endpoint configured',
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout || 3000)

    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      credentials: 'omit', // Don't send cookies
      cache: 'no-store',
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        ja3: undefined,
        ja3Full: undefined,
        ja4: undefined,
        success: false,
        error: `HTTP ${response.status}`,
      }
    }

    const data = await response.json()

    return {
      ja3: data.ja3_hash || data.ja3Hash || data.ja3 || undefined,
      ja3Full: data.ja3_full || data.ja3Full || data.ja3_string || undefined,
      ja4: data.ja4 || undefined,
      success: true,
      error: undefined,
    }
  } catch (error) {
    return {
      ja3: undefined,
      ja3Full: undefined,
      ja4: undefined,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
