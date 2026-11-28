/**
 * Saves a grid of frames from each Playwright video, so an agent can check a
 * recording it cannot play.
 *
 * Usage: node packages/e2e/scripts/video-contact-sheet.mjs <video.webm>... [--frames 9]
 * Writes <video>.contact.png beside each video.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const framesFlag = args.indexOf('--frames')
const frameCount = framesFlag === -1 ? 9 : Number(args[framesFlag + 1])
if (framesFlag !== -1) {
  args.splice(framesFlag, 2)
}
const videos = args
if (videos.length === 0 || !Number.isInteger(frameCount) || frameCount < 1) {
  // oxlint-disable-next-line no-console
  console.error('usage: video-contact-sheet.mjs <video.webm>... [--frames 9]')
  process.exit(1)
}
const missing = videos.filter((videoPath) => !existsSync(videoPath))
if (missing.length > 0) {
  // oxlint-disable-next-line no-console
  console.error(`video not found: ${missing.join(', ')}`)
  process.exit(1)
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
})
try {
  const page = await browser.newPage()
  for (const videoPath of videos) {
    const src = `data:video/webm;base64,${readFileSync(videoPath).toString('base64')}`
    const png = await page.evaluate(
      async ({ src, frameCount }) => {
        const video = document.createElement('video')
        video.muted = true
        video.src = src
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve
          video.onerror = () => reject(new Error('cannot decode the video'))
        })
        // IMPORTANT: Playwright writes webm without a duration header, so
        // seek past the end once to make the browser compute it.
        if (!Number.isFinite(video.duration)) {
          video.currentTime = Number.MAX_SAFE_INTEGER
          await new Promise((resolve) => (video.onseeked = resolve))
        }
        const columns = Math.ceil(Math.sqrt(frameCount))
        const rows = Math.ceil(frameCount / columns)
        const width = 480
        const height = Math.round(
          (width * video.videoHeight) / video.videoWidth,
        )
        const canvas = document.createElement('canvas')
        canvas.width = columns * width
        canvas.height = rows * height
        const context = canvas.getContext('2d')
        context.font = '16px sans-serif'
        for (let i = 0; i < frameCount; i++) {
          const time = (video.duration * (i + 0.5)) / frameCount
          video.currentTime = time
          await new Promise((resolve) => (video.onseeked = resolve))
          const x = (i % columns) * width
          const y = Math.floor(i / columns) * height
          context.drawImage(video, x, y, width, height)
          context.fillStyle = 'rgba(0, 0, 0, 0.7)'
          context.fillRect(x, y, 64, 24)
          context.fillStyle = '#fff'
          context.fillText(`${time.toFixed(1)}s`, x + 8, y + 17)
        }
        return canvas.toDataURL('image/png').split(',')[1]
      },
      { src, frameCount },
    )
    const out = videoPath.replace(/\.webm$/, '') + '.contact.png'
    writeFileSync(out, Buffer.from(png, 'base64'))
    // oxlint-disable-next-line no-console
    console.log(out)
  }
} finally {
  await browser.close()
}
