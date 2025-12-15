/**
 * Network Information API fingerprinting.
 *
 * The Network Information API provides information about the system's connection type
 * (e.g., 'wifi', 'cellular'). This can be used as an entropy source for fingerprinting.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
 */

export interface NetworkInformation {
  /** Connection type (wifi, cellular, ethernet, etc.) */
  type: string | undefined
  /** Effective connection type (4g, 3g, 2g, slow-2g) */
  effectiveType: string | undefined
  /** Downlink speed in Mbps */
  downlink: number | undefined
  /** Maximum downlink speed in Mbps */
  downlinkMax: number | undefined
  /** Round-trip time in ms */
  rtt: number | undefined
  /** Data saver mode enabled */
  saveData: boolean | undefined
}

// Network connection info type
interface NetworkConnectionInfo {
  type?: string
  effectiveType?: string
  downlink?: number
  downlinkMax?: number
  rtt?: number
  saveData?: boolean
}

// Navigator with Network Information API
interface NavigatorNetworkInfo {
  connection?: NetworkConnectionInfo
  mozConnection?: NetworkConnectionInfo
  webkitConnection?: NetworkConnectionInfo
}

/**
 * Gets network information from the Network Information API.
 * This API is available in Chrome, Edge, Opera, and some mobile browsers.
 * Not available in Safari or Firefox desktop.
 */
export default function getNetworkInformation(): NetworkInformation {
  const nav = navigator as unknown as NavigatorNetworkInfo
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection

  if (!connection) {
    return {
      type: undefined,
      effectiveType: undefined,
      downlink: undefined,
      downlinkMax: undefined,
      rtt: undefined,
      saveData: undefined,
    }
  }

  return {
    type: connection.type,
    effectiveType: connection.effectiveType,
    downlink: connection.downlink,
    downlinkMax: connection.downlinkMax,
    rtt: roundRtt(connection.rtt),
    saveData: connection.saveData,
  }
}

/**
 * Round RTT to reduce noise and improve stability.
 * RTT can fluctuate slightly, so we round to nearest 25ms.
 */
function roundRtt(rtt: number | undefined): number | undefined {
  if (rtt === undefined) return undefined
  return Math.round(rtt / 25) * 25
}
