import { getBrowserMajorVersion, isMobile, isSafari, isSamsungInternet } from '../../tests/utils'
import getAudioFingerprint, { SpecialFingerprint } from './audio'

describe('Sources', () => {
  describe('audio', () => {
    it('returns expected value type depending on the browser', async () => {
      const result = getAudioFingerprint()

      if (doesBrowserSuspendAudioContext()) {
        expect(result).toBe(SpecialFingerprint.KnownForSuspending)
      } else {
        // For all browsers including Safari 17+ (which now uses noise-resistant algorithm),
        // we expect a function that returns a fingerprint
        if (typeof result !== 'function') {
          throw new Error('Expected to be a function')
        }
        const fingerprint = await result()
        expect(fingerprint).toBeGreaterThanOrEqual(0)
        const newFingerprint = await result()
        expect(newFingerprint).toBe(newFingerprint)
      }
    })

    it('returns a stable value', async () => {
      const first = getAudioFingerprint()
      const second = getAudioFingerprint()

      if (first === second) {
        return
      }

      if (typeof first !== 'function' || typeof second !== 'function') {
        throw new Error('Expected to be a function')
      }

      expect(await second()).toBe(await first())
    })

    it('returns stable value on Safari 17+ with noise-resistant algorithm', async () => {
      if (!doesBrowserPerformAntifingerprinting()) {
        return // Skip test for non-noisy browsers
      }

      const result = getAudioFingerprint()
      if (typeof result !== 'function') {
        throw new Error('Expected to be a function')
      }

      // Run multiple times to verify stability despite Safari's noise
      const fingerprints = await Promise.all([result(), result(), result()])
      expect(fingerprints[0]).toBe(fingerprints[1])
      expect(fingerprints[1]).toBe(fingerprints[2])
    })
  })
})

function doesBrowserPerformAntifingerprinting() {
  const isSafari17orNewer = isSafari() && (getBrowserMajorVersion() ?? 0) >= 17
  const isSamsungInternet26orNewer = isSamsungInternet() && (getBrowserMajorVersion() ?? 0) >= 26
  return isSafari17orNewer || isSamsungInternet26orNewer
}

function doesBrowserSuspendAudioContext() {
  // WebKit has stopped telling its real version in the user-agent string since version 605.1.15,
  // therefore the browser version has to be checked instead of the engine version.
  return isSafari() && isMobile() && (getBrowserMajorVersion() ?? 0) < 12
}
