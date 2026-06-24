import validator from 'email-validator'
import { Router } from 'express'
import { z } from 'zod'

import logger from '@/helpers/logger'
import EmailSuppressionEntry from '@/models/email-suppression-entry'

const router = Router()

const whitelistRequestSchema = z.object({
  emails: z
    .array(z.string(), {
      required_error: 'emails is required',
      invalid_type_error: 'emails must be an array of strings',
    })
    .transform((emails) => emails.map((e) => e.trim()).filter(Boolean))
    .superRefine((emails, ctx) => {
      if (emails.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'emails must contain at least one non-empty value',
        })
        return
      }
      // Reject the whole request if any address is malformed, and name which.
      const invalid = emails.filter((email) => !validator.validate(email))
      if (invalid.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid email(s): ${invalid.join(', ')}`,
        })
      }
    }),
})

/**
 * Middleware to ensure only plumber admins can access admin routes.
 */
router.use((req, res, next) => {
  if (!req.context?.isAdminOperation) {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
})

/**
 * POST /api/admin/email-suppression/whitelist
 * Body: { "emails": ["a@x.com", "b+1@x.com"] }
 *
 * Whitelists one or more emails from the suppression list.
 * Requires x-plumber-admin-token header.
 */
router.post('/email-suppression/whitelist', async (req, res) => {
  const result = whitelistRequestSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({
      error: 'Invalid request body',
      details: result.error.issues,
    })
    return
  }

  const { emails } = result.data
  const whitelisted = await EmailSuppressionEntry.whitelistEmails(emails)

  logger.info('Admin whitelisted emails from suppression list', {
    event: 'admin-email-suppression-whitelist',
    adminEmail: req.context?.currentUser?.email ?? 'unknown',
    requested: emails,
    whitelisted,
  })

  res.json({
    whitelisted,
    count: whitelisted.length,
  })
})

export default router
