import { getBrowserMajorVersion, isSafari, isSamsungInternet } from '../../tests/utils'
import getCanvasFingerprint, { ImageStatus } from './canvas'

describe('Sources', () => {
  describe('canvas', () => {
    it('returns expected value', async () => {
      const { winding, text, geometry } = await getCanvasFingerprint()

      expect(winding).toBeTrue()

      if (shouldBeUnstable()) {
        expect(text).toBe(ImageStatus.Unstable)
        expect(geometry).toBe(ImageStatus.Unstable)
      } else {
        // Both regular browsers and Safari 17+ (with denoising exploit) return data URLs
        expect(isDataURL(geometry)).toBeTrue()
        expect(isDataURL(text)).toBeTrue()

        expect(geometry.length).toBeGreaterThan(1000)
        expect(text.length).toBeGreaterThan(1000)
      }
    })

    it('returns stable values', async () => {
      const first = await getCanvasFingerprint()
      const second = await getCanvasFingerprint()
      expect(second).toEqual(first)
    })

    it('returns stable values on Safari 17+ with canvas denoising exploit', async () => {
      if (!usesDenoisingExploit()) {
        return // Skip test for non-Safari 17+ browsers
      }

      // Run multiple times to verify stability despite Safari's noise
      // The scaling exploit should completely remove the noise
      const results = [await getCanvasFingerprint(), await getCanvasFingerprint(), await getCanvasFingerprint()]

      expect(results[0].geometry).toBe(results[1].geometry)
      expect(results[1].geometry).toBe(results[2].geometry)
      expect(results[0].text).toBe(results[1].text)
      expect(results[1].text).toBe(results[2].text)
    })
  })
})

function usesDenoisingExploit() {
  return isSafari() && (getBrowserMajorVersion() ?? 0) >= 17
}

function shouldBeUnstable() {
  return isSamsungInternet() && (getBrowserMajorVersion() ?? 0) < 28
}

function isDataURL(url: string) {
  return /^data:image\/png;base64,([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/.test(url)
}
