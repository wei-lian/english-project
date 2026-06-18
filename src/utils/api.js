export async function fetchDictionaryEntry(word) {
  try {
    const response = await fetch(`/api/dictionary/api/v2/entries/en/${word}`)

    if (!response.ok) {
      throw new Error(`Dictionary request failed: ${response.status}`)
    }

    const [entry] = await response.json()
    if (!entry) {
      return null
    }

    const phoneticItem = entry.phonetics?.find((item) => item.audio || item.text)
    const firstMeaning = entry.meanings?.[0]
    const firstDefinition = firstMeaning?.definitions?.[0]

    return {
      word: entry.word,
      phonetic: entry.phonetic || phoneticItem?.text || '',
      audio: phoneticItem?.audio || '',
      meanings: entry.meanings || [],
      englishDefinition: firstDefinition?.definition || '',
      example: firstDefinition?.example || '',
      partOfSpeech: firstMeaning?.partOfSpeech || ''
    }
  } catch (error) {
    console.warn('[CodeVocab] 词典接口请求失败，已使用本地数据回退。', error)
    return null
  }
}

