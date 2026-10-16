import dns from 'dns'

import ipaddr from 'ipaddr.js'

import { DISALLOWED_IP_RESOLVED_ERROR } from './constants'

export async function getIpFromHostname(hostname: string) {
  try {
    const { address } = await dns.promises.lookup(hostname)
    return address
  } catch {
    throw new Error(`Unable to resolve IP address for ${hostname}`)
  }
}

// checks if IP address is allowed to be called
// not allowed:
// - internal/private/invalid ips
// - IPs within the VPC CIDR range (corresponds to private ip)
// - AWS metadata endpoint: 169.254.170.2, 169.254.169.254, 169.254.169.253, etc.. (corrsponds to linkLocal)
export function isIpAllowed(ip: string) {
  if (!ipaddr.isValid(ip)) {
    return false
  }
  const parsedIp = ipaddr.parse(ip)
  // check if parsed IP is prohibited
  // this effectively calls ipaddr.subnetMatch(this, this.SpecialRanges)
  // Special ranges include private, reserved, loopback ips
  // ipv6: https://github.com/whitequark/ipaddr.js/blob/master/lib/ipaddr.js#L530
  // ipv4: https://github.com/whitequark/ipaddr.js/blob/master/lib/ipaddr.js#L182
  const ipRangeLabel = parsedIp.range()

  // only allow unicast ips
  return ipRangeLabel === 'unicast'
}

export async function safeAxiosLookup(
  hostname: string,
  _options: object,
): Promise<string> {
  const ip = await getIpFromHostname(hostname)
  if (!isIpAllowed(ip)) {
    throw new Error(DISALLOWED_IP_RESOLVED_ERROR)
  }
  return ip
}
