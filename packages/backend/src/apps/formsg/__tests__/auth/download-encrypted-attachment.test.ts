import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import logger from '@/helpers/logger'

import { downloadEncryptedAttachment } from '../../auth/download-encrypted-attachment'

const axiosGet = vi.fn()
const consoleError = vi.fn()
const consoleWarn = vi.fn()

function axiosErrorWithStatus(status: number) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status },
  }
}

const URL = 'https://s3.ap-southeast-1.amazonaws.com/attachments.form.gov.sg/a'

/**
 * Freezes the clock and hands back a knob to wind it forward, so tests can
 * spend the download budget without waiting out real seconds.
 */
function useSimulatedClock() {
  let now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  return (ms: number) => {
    now += ms
  }
}

describe('downloadEncryptedAttachment', () => {
  beforeEach(() => {
    vi.spyOn(axios, 'get').mockImplementation(axiosGet)
    vi.spyOn(axios, 'isAxiosError').mockImplementation(
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        (error as { isAxiosError?: boolean }).isAxiosError === true,
    )
    vi.spyOn(logger, 'error').mockImplementation(consoleError)
    vi.spyOn(logger, 'warn').mockImplementation(consoleWarn)
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  it.each([429, 500, 502, 503, 504])(
    'retries a %i and returns the payload from the successful attempt',
    async (status) => {
      axiosGet
        .mockRejectedValueOnce(axiosErrorWithStatus(status))
        .mockResolvedValueOnce({ data: { encryptedFile: 'payload' } })

      const result = await downloadEncryptedAttachment(URL)

      expect(result).toEqual({ encryptedFile: 'payload' })
      expect(axiosGet).toHaveBeenCalledTimes(2)
    },
  )

  it.each([404, 409, 501, 505])('does not retry a %i', async (status) => {
    axiosGet.mockRejectedValue(axiosErrorWithStatus(status))

    await expect(downloadEncryptedAttachment(URL)).rejects.toThrow(
      `Attachment download failed with status ${status}`,
    )

    expect(axiosGet).toHaveBeenCalledTimes(1)
  })

  it('does not retry an error that did not come from axios', async () => {
    axiosGet.mockRejectedValue(new TypeError('Download failed'))

    await expect(downloadEncryptedAttachment(URL)).rejects.toThrow(
      'Attachment download failed with TypeError: Download failed',
    )

    expect(axiosGet).toHaveBeenCalledTimes(1)
  })

  it('gives up after 3 attempts when the 503 persists', async () => {
    axiosGet.mockRejectedValue(axiosErrorWithStatus(503))

    await expect(downloadEncryptedAttachment(URL)).rejects.toThrow(
      'Attachment download failed with status 503',
    )

    expect(axiosGet).toHaveBeenCalledTimes(3)
  })

  it('throws a fresh error, so axios never carries the presigned URL or request headers into the logs', async () => {
    axiosGet.mockRejectedValue({
      isAxiosError: true,
      message: 'Request failed with status code 404',
      config: {
        url: `${URL}?X-Amz-Signature=secretsignature`,
        headers: { authorization: 'secrettoken' },
      },
      response: { status: 404, headers: { 'x-amz-id-2': 'secretid' } },
    })

    const error = await downloadEncryptedAttachment(URL).catch((err) => err)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe(
      'Attachment download failed with status 404: Request failed with status code 404',
    )
    expect(error.cause).toBeUndefined()
    expect(error).not.toHaveProperty('config')
    expect(error).not.toHaveProperty('response')
  })

  it('says so when the request never got a response', async () => {
    axiosGet.mockRejectedValue({
      isAxiosError: true,
      message: 'timeout of 2000ms exceeded',
      code: 'ECONNABORTED',
    })

    await expect(downloadEncryptedAttachment(URL)).rejects.toThrow(
      'Attachment download failed with no response: timeout of 2000ms exceeded',
    )
  })

  it('names the type when what was thrown is not an error', async () => {
    axiosGet.mockRejectedValue('a string holding who knows what')

    await expect(downloadEncryptedAttachment(URL)).rejects.toThrow(
      'Attachment download failed with a thrown string',
    )
  })

  it('bounds each attempt with a per-attempt timeout', async () => {
    axiosGet.mockResolvedValue({ data: {} })

    await downloadEncryptedAttachment(URL)

    expect(axiosGet).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({ timeout: 2000 }),
    )
  })

  it('clamps the last attempt to the budget left before the deadline', async () => {
    const advanceClock = useSimulatedClock()
    axiosGet.mockImplementation(async () => {
      advanceClock(2000) // Each attempt burns its full per-attempt timeout.
      throw axiosErrorWithStatus(503)
    })

    await expect(downloadEncryptedAttachment(URL)).rejects.toThrow(
      'Attachment download failed with status 503',
    )

    const timeouts = axiosGet.mock.calls.map(([, config]) => config.timeout)
    expect(timeouts).toEqual([2000, 2000, 1000])
  })

  it('stops retrying once the budget is spent, before hitting the attempt cap', async () => {
    const advanceClock = useSimulatedClock()
    axiosGet.mockImplementation(async () => {
      advanceClock(2600) // Timeout plus connection overhead.
      throw axiosErrorWithStatus(503)
    })

    await expect(downloadEncryptedAttachment(URL)).rejects.toThrow(
      'Attachment download failed with status 503',
    )

    expect(axiosGet).toHaveBeenCalledTimes(2)
  })

  it('logs each retry so the retries are visible in Datadog', async () => {
    axiosGet
      .mockRejectedValueOnce(axiosErrorWithStatus(503))
      .mockResolvedValueOnce({ data: {} })

    await downloadEncryptedAttachment(URL)

    expect(consoleWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'formsg-attachment-download-retry',
        attempt: 1,
        status: 503,
      }),
    )
  })
})
