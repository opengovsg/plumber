import { describe, expect, it } from 'vitest'

import { containsSecretKey } from '../helpers'

// A real base64 encoding of a random 32-byte value — FormSG secret key shape.
const SAMPLE_FORMSG_KEY = 'qCRJMYOtgLI3QWdNWwK52u8LTfPQCvRXU/Vm/O7DY/E='
// A 16-byte value — same charset, wrong decoded length.
const SAMPLE_16_BYTE_BASE64 = 'VlWnOLhEVbPHTWd4ufTlEg=='
// GatherSG encryptionKey shape: 12-20 chars, digit + uppercase + special char.
const SAMPLE_GATHERSG_KEY = 'K3y!secret99'
// LetterSG / Postman-SMS / PaySG API key shapes.
const SAMPLE_LETTERSG_KEY = 'live_a1b2c3d4e5f6g7h8'
const SAMPLE_POSTMAN_SMS_KEY = 'key_test_a1b2c3d4e5f6g7h8'
const SAMPLE_PAYSG_KEY = 'paysg_live_a1b2c3d4e5f6g7h8'
// Telegram bot token shape: numeric bot id, colon, 35-char alphanumeric string.
const SAMPLE_TELEGRAM_TOKEN = '123456789:AAAAAAAAAABBBBBBBBBBCCCCCCCCCCDDDDD'

describe('containsSecretKey', () => {
  describe('FormSG secret key', () => {
    it('detects a message that is nothing but the key', () => {
      expect(containsSecretKey(SAMPLE_FORMSG_KEY)).toBe(true)
    })

    it('detects the key pasted alongside other text on the same line', () => {
      expect(containsSecretKey(`here's my key: ${SAMPLE_FORMSG_KEY}`)).toBe(
        true,
      )
    })

    it('detects the key on its own line within a longer message', () => {
      expect(
        containsSecretKey(
          `Can you help me set this up?\n${SAMPLE_FORMSG_KEY}\nThanks!`,
        ),
      ).toBe(true)
    })

    it('returns false for a base64-charset string that decodes to the wrong byte length', () => {
      expect(containsSecretKey(SAMPLE_16_BYTE_BASE64)).toBe(false)
    })
  })

  describe('GatherSG encryption key', () => {
    it('detects a key with a digit, an uppercase letter, and a special character', () => {
      expect(containsSecretKey(SAMPLE_GATHERSG_KEY)).toBe(true)
    })

    it('returns false when shorter than 12 characters', () => {
      expect(containsSecretKey('K3y!x')).toBe(false)
    })

    it('returns false when missing a special character', () => {
      expect(containsSecretKey('Key3secret9x')).toBe(false)
    })
  })

  describe('LetterSG / Postman-SMS / PaySG API keys', () => {
    it('detects a LetterSG-shaped key (live_ prefix)', () => {
      expect(containsSecretKey(SAMPLE_LETTERSG_KEY)).toBe(true)
    })

    it('detects a Postman-SMS-shaped key (key_test_ prefix)', () => {
      expect(containsSecretKey(SAMPLE_POSTMAN_SMS_KEY)).toBe(true)
    })

    it('detects a PaySG-shaped key (paysg_live_ prefix)', () => {
      expect(containsSecretKey(SAMPLE_PAYSG_KEY)).toBe(true)
    })

    it('detects a short key, since none of these apps enforce a minimum length (real LetterSG test fixture shape)', () => {
      expect(containsSecretKey('test_v1_123456')).toBe(true)
    })

    it('also matches an ordinary word sharing the same prefix — accepted false positive, since this is a soft warning', () => {
      expect(containsSecretKey('test_case')).toBe(true)
    })

    it('returns false for the bare prefix with nothing after it', () => {
      expect(containsSecretKey('test_')).toBe(false)
    })
  })

  describe('Telegram bot token', () => {
    it('detects a bot-id:35-char-token pair', () => {
      expect(containsSecretKey(SAMPLE_TELEGRAM_TOKEN)).toBe(true)
    })

    it('returns false when the suffix is not exactly 35 characters', () => {
      expect(containsSecretKey('123456789:tooshort')).toBe(false)
    })

    it('returns false for an unrelated colon-separated pair', () => {
      expect(containsSecretKey('Q: what time works?')).toBe(false)
    })
  })

  it('returns false for ordinary chat text', () => {
    expect(
      containsSecretKey('Suggest workflows I can build with this form.'),
    ).toBe(false)
  })

  it('returns false for a form/connection id', () => {
    expect(containsSecretKey('654ab1234abc1a012345f1e0')).toBe(false)
  })

  it('returns false for an empty or whitespace-only message', () => {
    expect(containsSecretKey('')).toBe(false)
    expect(containsSecretKey('   ')).toBe(false)
  })
})
