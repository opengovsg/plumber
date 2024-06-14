export const postmanSmsConfig = Object.freeze({
  qpsLimitPerCampaign: Number(process.env.POSTMAN_SMS_QPS_LIMIT_PER_CAMPAIGN),
})

if (
  !Number.isInteger(postmanSmsConfig.qpsLimitPerCampaign) ||
  postmanSmsConfig.qpsLimitPerCampaign <= 0
) {
  throw new Error(
    'POSTMAN_SMS_QPS_LIMIT_PER_CAMPAIGN env var needs to be a positive integer',
  )
}
