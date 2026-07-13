import type { Request } from 'express'
import ipaddr from 'ipaddr.js'

/**
 * Cloudflare's published edge IP ranges (https://www.cloudflare.com/ips/).
 */
const CLOUDFLARE_CIDRS: ReadonlyArray<[ipaddr.IPv4 | ipaddr.IPv6, number]> = [
  // IPv4 — https://www.cloudflare.com/ips-v4/
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  // IPv6 — https://www.cloudflare.com/ips-v6/
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
].map((cidr) => ipaddr.parseCIDR(cidr))

/**
 * Parses a forwarded / socket address into a canonical IP, or null if it is not
 * a valid IP. IPv4-mapped IPv6 (`::ffff:1.2.3.4`) is folded to plain IPv4 so it
 * compares correctly against the IPv4 Cloudflare ranges.
 *
 * Entries are assumed to be bare IPs. The ALB's client-port preservation
 * (`routing.http.xff_client_port`) is disabled, so it never appends an
 * `ip:port` suffix — re-add port stripping here if that setting is ever enabled.
 */
function parseIp(value: string | undefined): ipaddr.IPv4 | ipaddr.IPv6 | null {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  if (!ipaddr.isValid(trimmed)) {
    return null
  }
  return ipaddr.process(trimmed)
}

function isCloudflareIp(addr: ipaddr.IPv4 | ipaddr.IPv6): boolean {
  return CLOUDFLARE_CIDRS.some(
    ([range, bits]) => range.kind() === addr.kind() && addr.match(range, bits),
  )
}

/**
 * The rightmost `X-Forwarded-For` entry — the address the ALB appended, i.e. the
 * peer that actually connected to it. A client cannot forge this: the ALB always
 * appends it AFTER any client-supplied entries, so nothing the client sends can
 * appear to its right. Returns null when there is no usable X-Forwarded-For.
 */
function getForwardedPeer(req: Request): ipaddr.IPv4 | ipaddr.IPv6 | null {
  const forwardedFor = req.headers['x-forwarded-for']
  const chain = Array.isArray(forwardedFor)
    ? forwardedFor.join(',')
    : forwardedFor ?? ''
  const entries = chain
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return parseIp(entries.at(-1))
}

/**
 * Resolves the client IP for a request behind the ALB, spoof-resistant in both
 * Cloudflare "orange cloud" (proxied) and "grey cloud" (DNS-only) modes.
 *
 * We only need the RIGHTMOST `X-Forwarded-For` entry — the peer the ALB appended
 * (see getForwardedPeer). That single, unspoofable entry tells us which mode we
 * are in and therefore which source to trust:
 *
 *   rightmost X-Forwarded-For entry  (ALB-appended peer — unspoofable)
 *                 |
 *        published CF edge IP? ---- yes ---> return cf-connecting-ip   (orange)
 *                 |
 *                 no
 *                 v
 *          return the entry itself         (grey — the real client)
 *
 *   - Orange cloud: the peer is one of Cloudflare's published edge IPs, so the
 *     request transited Cloudflare. Cloudflare strips any client-supplied
 *     `cf-connecting-ip` and sets it from the real connection, so it is
 *     authoritative here — and, unlike an X-Forwarded-For entry, it cannot be
 *     forged from a Cloudflare-range peer (reaching the ALB from such an IP means
 *     going through Cloudflare, and Workers cannot set `cf-*` headers).
 *
 *   - Grey cloud: the peer is not a Cloudflare IP, so Cloudflare is not in the
 *     path and the peer IS the real client. We ignore `cf-connecting-ip` here —
 *     a direct caller can forge it.
 *
 * We deliberately do NOT walk the chain: in orange mode the client comes from
 * `cf-connecting-ip`, not from an entry to the left of the edge, so there is
 * nothing further left to read. This also keeps us free of any fixed hop-count
 * assumption (Express `trust proxy` is avoided for the same reason).
 *
 * Residual risk: "Cloudflare edge IP" is judged against Cloudflare's *published*
 * ranges, which must be kept fresh — a stale list would misclassify a new edge
 * range. Those ranges only carry Cloudflare's reverse-proxy traffic (which
 * sanitises `cf-connecting-ip`); WARP / Worker egress uses different, unpublished
 * IPs that fail the check and are treated as grey.
 */
export function getClientIp(req: Request): string {
  const peer = getForwardedPeer(req)

  if (peer) {
    if (isCloudflareIp(peer)) {
      // Orange cloud: cf-connecting-ip is authoritative. Fall back to the edge
      // peer only in the anomalous case where it is missing or invalid.
      const cfHeader = req.headers['cf-connecting-ip']
      const cfIp = parseIp(typeof cfHeader === 'string' ? cfHeader : undefined)
      return (cfIp ?? peer).toString()
    }
    // Grey cloud: the ALB-appended peer is the real client.
    return peer.toString()
  }

  // No X-Forwarded-For (e.g. a direct internal call). Fall back to the transport
  // peer, then give up.
  const socketIp = parseIp(req.socket?.remoteAddress)
  return socketIp ? socketIp.toString() : 'unknown'
}
