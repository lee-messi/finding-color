export function getCanonicalPageId(
  pageId: string,
  recordMap: ExtendedRecordMap,
  { uuid = true }: { uuid?: boolean } = {}
): string | null {
  const cleanPageId = parsePageId(pageId, { uuid: false })
  if (!cleanPageId) {
    return null
  }

  const override = inversePageUrlOverrides[cleanPageId]
  if (override) {
    return override
  } else {
    // 1. Try to get the canonical ID (slug)
    const canonicalId = getCanonicalPageIdImpl(pageId, recordMap, {
      uuid
    })

    // 2. If it's missing (which it is in your case), use the cleanPageId instead
    return canonicalId || cleanPageId
  }
}