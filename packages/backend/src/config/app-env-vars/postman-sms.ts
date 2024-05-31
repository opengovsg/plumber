export const postmanSmsConfig = Object.freeze({
  defaultCampaignId: process.env.POSTMAN_SMS_DEFAULT_CAMPAIGN_ID,
  defaultApiKey: process.env.POSTMAN_SMS_DEFAULT_API_KEY,
  qpsLimitPerCampaign: Number(process.env.POSTMAN_SMS_QPS_LIMIT_PER_CAMPAIGN),
})

if (!postmanSmsConfig.defaultCampaignId) {
  throw new Error('POSTMAN_SMS_DEFAULT_CAMPAIGN_ID env var needs to be set')
}

if (!postmanSmsConfig.defaultApiKey) {
  throw new Error('POSTMAN_SMS_DEFAULT_API_KEY env var needs to be set')
}

if (
  !Number.isInteger(postmanSmsConfig.qpsLimitPerCampaign) ||
  postmanSmsConfig.qpsLimitPerCampaign <= 0
) {
  throw new Error(
    'POSTMAN_SMS_QPS_LIMIT_PER_CAMPAIGN env var needs to be a positive integer',
  )
}
