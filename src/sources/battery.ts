/**
 * Battery Status API fingerprinting.
 *
 * The Battery API provides information about the device's battery status.
 * While privacy-restricted in some browsers, it still provides entropy when available.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API
 */

export interface BatteryInfo {
  /** Whether the battery is currently charging */
  charging: boolean | undefined
  /** Battery level as a percentage (0-1) */
  level: number | undefined
  /** Time in seconds until battery is fully charged */
  chargingTime: number | undefined
  /** Time in seconds until battery is fully discharged */
  dischargingTime: number | undefined
}

interface BatteryManager {
  charging: boolean
  level: number
  chargingTime: number
  dischargingTime: number
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>
}

/**
 * Gets battery information from the Battery Status API.
 * This API has been removed from Firefox and restricted in some browsers
 * due to privacy concerns, but still works in Chrome/Edge.
 */
export default async function getBatteryInfo(): Promise<BatteryInfo> {
  const nav = navigator as NavigatorWithBattery

  if (!nav.getBattery) {
    return {
      charging: undefined,
      level: undefined,
      chargingTime: undefined,
      dischargingTime: undefined,
    }
  }

  try {
    const battery = await nav.getBattery()
    return {
      charging: battery.charging,
      // Round level to reduce entropy leakage while maintaining uniqueness
      level: roundBatteryLevel(battery.level),
      chargingTime: normalizeTime(battery.chargingTime),
      dischargingTime: normalizeTime(battery.dischargingTime),
    }
  } catch {
    return {
      charging: undefined,
      level: undefined,
      chargingTime: undefined,
      dischargingTime: undefined,
    }
  }
}

/**
 * Round battery level to nearest 5% to reduce noise while maintaining entropy.
 */
function roundBatteryLevel(level: number): number {
  return Math.round(level * 20) / 20
}

/**
 * Normalize time values - Infinity and NaN are common for charging/discharging times.
 */
function normalizeTime(time: number): number | undefined {
  if (!isFinite(time) || isNaN(time)) {
    return undefined
  }
  // Round to nearest minute to reduce noise
  return Math.round(time / 60) * 60
}
