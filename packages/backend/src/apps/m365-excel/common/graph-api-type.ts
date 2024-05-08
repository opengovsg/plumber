export enum GraphApiType {
  Others,
  SharePoint,
  Excel,
}

/**
 * A helper function to identify which Graph API endpoint we're calling.
 *
 * NOTE:
 * In Graph API, the endpoints we hit is determined by the URL path segments
 * (e.g. /a/b/c/ means we're hitting service a, b, and c, in that order).
 *
 * This function only returns the type of the last hit service (i.e. for the
 * above example, it returns c).
 *
 * NOTE 2:
 * This function is _not_ generic; it only works for the URLs used in this Excel
 * integration.
 */
export function getLastHitGraphApiType(url: string): GraphApiType {
  // For now, we don't have user-controlled data in our URL paths, so we can
  // just check for the presence of path segments, since our code guarantees
  // that segments are unique.

  // This uses a stub base URL because we should mostly get relative URLs.
  const urlPath = new URL(url, 'https://stub.local').pathname

  // Any path with a `/workbook/` segment means we're hitting an Excel endpoint.
  // Example path (querying Excel table info):
  // /v1.0/sites/{siteId}/drive/items/{fileId}/workbook/tables/{tableId}/headerRowRange
  if (urlPath.includes('/workbook/')) {
    return GraphApiType.Excel
  }

  // Any path with a `/sites/` segment means we're hitting a SharePoint
  // endpoint. Example path (querying file info):
  // /v1.0/sites/{siteId}/drive/items/{fileId}/
  if (urlPath.includes(`/sites/`)) {
    return GraphApiType.SharePoint
  }

  // This is OK - we might get here due to making queries to OAuth endpoints,
  // etc. We group such these calls into an "others" category because they are
  // largely uninteresting.
  return GraphApiType.Others
}
