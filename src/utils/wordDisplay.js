export function getWordMeaning(wordData = {}) {
  return (
    wordData?.translations?.zh?.trim() ||
    wordData?.description?.trim() ||
    wordData?.englishDefinition?.trim() ||
    wordData?.meanings?.[0]?.definitions?.[0]?.definition?.trim() ||
    '暂无释义'
  )
}

export function getWordDescription(wordData = {}) {
  return (
    wordData?.description?.trim() ||
    wordData?.englishDefinition?.trim() ||
    wordData?.meanings?.[0]?.definitions?.[0]?.definition?.trim() ||
    '暂无说明'
  )
}
