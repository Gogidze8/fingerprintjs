/**
 * WebRTC-based local IP address detection.
 *
 * WebRTC can reveal local IP addresses through ICE candidate gathering.
 * This is often blocked by privacy extensions, but provides entropy when available.
 *
 * Note: This is increasingly blocked by browsers for privacy reasons.
 * Safari blocks this, and Chrome/Firefox have restrictions.
 */

export interface WebRTCIPs {
  /** Local IPv4 addresses found */
  localIPv4: string[]
  /** Local IPv6 addresses found */
  localIPv6: string[]
  /** Whether WebRTC is supported */
  supported: boolean
}

// Type for prefixed RTCPeerConnection
type RTCPeerConnectionType = typeof RTCPeerConnection

interface WindowWithRTC {
  RTCPeerConnection?: RTCPeerConnectionType
  webkitRTCPeerConnection?: RTCPeerConnectionType
  mozRTCPeerConnection?: RTCPeerConnectionType
}

/**
 * Attempts to gather local IP addresses via WebRTC ICE candidates.
 * Returns quickly with whatever IPs are found within the timeout.
 */
export default function getWebRTCIPs(): Promise<WebRTCIPs> {
  return new Promise((resolve) => {
    const result: WebRTCIPs = {
      localIPv4: [],
      localIPv6: [],
      supported: false,
    }

    // Check for WebRTC support
    const windowWithRTC = window as unknown as WindowWithRTC
    const PeerConnection =
      windowWithRTC.RTCPeerConnection || windowWithRTC.webkitRTCPeerConnection || windowWithRTC.mozRTCPeerConnection

    if (!PeerConnection) {
      resolve(result)
      return
    }

    result.supported = true

    const seenIPs = new Set<string>()
    let resolved = false

    const finish = () => {
      if (!resolved) {
        resolved = true
        resolve(result)
      }
    }

    // Timeout after 1 second - ICE gathering should be fast for local IPs
    const timeout = setTimeout(finish, 1000)

    try {
      const pc = new PeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })

      pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (!event.candidate) {
          // ICE gathering complete
          clearTimeout(timeout)
          pc.close()
          finish()
          return
        }

        const candidate = event.candidate.candidate
        const ipMatch = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/i)

        if (ipMatch) {
          const ip = ipMatch[1]

          // Skip already seen IPs
          if (seenIPs.has(ip)) return
          seenIPs.add(ip)

          // Skip mDNS addresses (.local)
          if (ip.endsWith('.local')) return

          // Classify IPv4 vs IPv6
          if (ip.includes(':')) {
            // IPv6
            if (!isLinkLocalIPv6(ip)) {
              result.localIPv6.push(ip)
            }
          } else {
            // IPv4
            if (isPrivateIPv4(ip)) {
              result.localIPv4.push(ip)
            }
          }
        }
      }

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout)
          pc.close()
          finish()
        }
      }

      // Create a data channel to trigger ICE gathering
      pc.createDataChannel('')

      pc.createOffer()
        .then((offer: RTCSessionDescriptionInit) => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timeout)
          finish()
        })
    } catch {
      clearTimeout(timeout)
      finish()
    }
  })
}

/**
 * Check if an IPv4 address is in private ranges.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return false

  // 10.0.0.0/8
  if (parts[0] === 10) return true

  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true

  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true

  // 169.254.0.0/16 (link-local)
  if (parts[0] === 169 && parts[1] === 254) return true

  return false
}

/**
 * Check if an IPv6 address is link-local (fe80::/10).
 */
function isLinkLocalIPv6(ip: string): boolean {
  return ip.toLowerCase().startsWith('fe80:')
}
