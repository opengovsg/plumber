import { Router } from 'express'

import logger from '@/helpers/logger'
import EmailSuppressionEntry from '@/models/email-suppression-entry'

const router = Router()

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
 * GET /api/admin/email-suppression/whitelist?emails=a@x.com,b+1@x.com
 *
 * Whitelists one or more emails from the suppression list.
 * Requires x-plumber-admin-token header.
 */
router.get('/email-suppression/whitelist', async (req, res) => {
  const emailsParam = req.query.emails as string
  if (!emailsParam) {
    res.status(400).json({ error: 'emails query parameter is required' })
    return
  }

  // `+` in query strings is decoded to a space; restore it since spaces
  // are not valid in email addresses. This lets callers paste URLs with
  // unencoded `+` characters directly.
  const emails = emailsParam
    .split(',')
    .map((e) => e.trim().replace(/ /g, '+'))
    .filter(Boolean)
  if (emails.length === 0) {
    res.status(400).json({ error: 'emails must not be empty' })
    return
  }

  const whitelisted = await EmailSuppressionEntry.whitelistEmails(emails)

  logger.info('Admin whitelisted emails from suppression list', {
    event: 'admin-email-suppression-whitelist',
    requested: emails,
    whitelisted,
  })

  res.json({
    whitelisted,
    count: whitelisted.length,
  })
})

export default router
