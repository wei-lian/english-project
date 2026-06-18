import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import vocabularySeed from '@/data/vocabulary.json'
import { fetchDictionaryEntry } from '@/utils/api'
import { formatDate, getRecentDateList } from '@/utils/dateUtils'
import { EBBINGHAUS_INTERVALS, getNextReviewDate, getNextStage, isReviewDue } from '@/utils/ebbinghaus'
import { downloadJson } from '@/utils/fileUtils'
import { applyTheme } from '@/utils/themeUtils'

const STORAGE_KEY = 'codevocab-learning-data-v1'

const DEFAULT_SETTINGS = {
  dailyCount: 20,
  theme: 'dark',
  learningMode: 'flip',
  autoPlayAudio: false,
  lastFetchDate: '',
  createdAt: new Date().toISOString()
}

const DEFAULT_QUEUE = {
  date: '',
  newWords: [],
  reviewWords: [],
  completed: []
}

const DEFAULT_STATISTICS = {
  totalLearned: 0,
  totalMastered: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalStudyTimeMinutes: 0
}

function cloneDefaultData() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    learningRecords: [],
    dailyQueue: { ...DEFAULT_QUEUE },
    statistics: { ...DEFAULT_STATISTICS }
  }
}

function getStatusByProficiency(level) {
  if (level >= 5) {
    return 'mastered'
  }

  if (level >= 3) {
    return 'reviewing'
  }

  return 'learning'
}

function calculateStreak(records) {
  const uniqueDates = [...new Set(records.map((item) => item.firstLearnDate).filter(Boolean))].sort()
  if (!uniqueDates.length) {
    return { current: 0, longest: 0 }
  }

  let longest = 1
  let current = 1

  for (let index = 1; index < uniqueDates.length; index += 1) {
    const previous = new Date(uniqueDates[index - 1])
    const currentDate = new Date(uniqueDates[index])
    const dayDiff = (currentDate - previous) / (1000 * 60 * 60 * 24)

    if (dayDiff === 1) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 1
    }
  }

  const today = formatDate()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const lastDate = uniqueDates[uniqueDates.length - 1]
  const lastIsRecent = lastDate === today || lastDate === formatDate(yesterday)

  return {
    current: lastIsRecent ? current : 0,
    longest
  }
}

export const useLearningStore = defineStore('learning', () => {
  const initialized = ref(false)
  const loading = ref(false)
  const settings = ref({ ...DEFAULT_SETTINGS })
  const learningRecords = ref([])
  const dailyQueue = ref({ ...DEFAULT_QUEUE })
  const statistics = ref({ ...DEFAULT_STATISTICS })
  const dictionaryCache = ref({})
  const vocabulary = ref(vocabularySeed)

  const today = computed(() => formatDate())
  const vocabularyCount = computed(() => vocabulary.value.length)
  const availableNewWordsCount = computed(() => {
    const learned = new Set(learningRecords.value.map((item) => item.word))
    return vocabulary.value.filter((item) => !learned.has(item.word)).length
  })

  const allWords = computed(() =>
    vocabulary.value.map((item) => {
      const record = learningRecords.value.find((entry) => entry.word === item.word)
      return {
        ...item,
        record
      }
    })
  )

  const reviewWords = computed(() =>
    learningRecords.value
      .filter((item) => isReviewDue(item, today.value))
      .map((record) => {
        const word = vocabulary.value.find((item) => item.word === record.word)
        return {
          ...word,
          record
        }
      })
      .filter(Boolean)
  )

  const newWordItems = computed(() =>
    dailyQueue.value.newWords
      .map((word) => vocabulary.value.find((item) => item.word === word))
      .filter(Boolean)
  )

  const reviewWordItems = computed(() =>
    dailyQueue.value.reviewWords
      .map((word) => {
        const vocab = vocabulary.value.find((item) => item.word === word)
        const record = learningRecords.value.find((item) => item.word === word)
        return vocab ? { ...vocab, record } : null
      })
      .filter(Boolean)
  )

  const completionRate = computed(() => {
    const total = dailyQueue.value.newWords.length || 1
    return Math.round((dailyQueue.value.completed.length / total) * 100)
  })

  function recalculateStatistics() {
    const records = learningRecords.value
    const mastered = records.filter((item) => item.proficiency >= 5).length
    const totalStudyTimeMinutes = Math.round(
      records.reduce((sum, item) => {
        const duration = item.testHistory?.reduce((acc, history) => acc + (history.responseTimeMs || 0), 0) || 0
        return sum + duration
      }, 0) / 60000
    )
    const streak = calculateStreak(records)

    statistics.value = {
      totalLearned: records.length,
      totalMastered: mastered,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      totalStudyTimeMinutes
    }
  }

  function persistState() {
    if (typeof localStorage === 'undefined') {
      return
    }

    const snapshot = getAllData()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }

  function hydrateData(payload) {
    const source = payload || cloneDefaultData()
    settings.value = {
      ...DEFAULT_SETTINGS,
      ...(source.settings || {})
    }
    learningRecords.value = Array.isArray(source.learningRecords) ? source.learningRecords : []
    dailyQueue.value = {
      ...DEFAULT_QUEUE,
      ...(source.dailyQueue || {})
    }
    statistics.value = {
      ...DEFAULT_STATISTICS,
      ...(source.statistics || {})
    }
    recalculateStatistics()
    applyTheme(settings.value.theme)
  }

  function pickNewWords(count = settings.value.dailyCount) {
    const learned = new Set(learningRecords.value.map((item) => item.word))
    const available = vocabulary.value.filter((item) => !learned.has(item.word))
    return available.slice(0, count).map((item) => item.word)
  }

  function ensureDailyQueue(options = {}) {
    const { force = false, preserveCompleted = true } = options
    const desiredCount = Math.min(settings.value.dailyCount, availableNewWordsCount.value)
    const queueWordsStillValid = dailyQueue.value.newWords.every((word) =>
      vocabulary.value.some((item) => item.word === word)
    )
    const queueAlreadyMatchesToday =
      dailyQueue.value.date === today.value &&
      settings.value.lastFetchDate === today.value &&
      dailyQueue.value.newWords.length === desiredCount &&
      queueWordsStillValid

    if (!force && queueAlreadyMatchesToday) {
      dailyQueue.value.reviewWords = reviewWords.value.map((item) => item.word)
      return
    }

    const newWords = pickNewWords(settings.value.dailyCount)
    const completed = preserveCompleted
      ? dailyQueue.value.completed.filter((word) => newWords.includes(word))
      : []

    dailyQueue.value = {
      date: today.value,
      newWords,
      reviewWords: reviewWords.value.map((item) => item.word),
      completed
    }

    settings.value.lastFetchDate = today.value
  }

  async function initialize() {
    if (initialized.value) {
      return
    }

    loading.value = true

    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : ''
      if (stored) {
        hydrateData(JSON.parse(stored))
      } else {
        const response = await fetch('/learning_data.json')
        const seed = response.ok ? await response.json() : cloneDefaultData()
        hydrateData(seed)
      }
      ensureDailyQueue()
    } catch (error) {
      console.error('[CodeVocab] 初始化失败，已回退默认数据。', error)
      hydrateData(cloneDefaultData())
      ensureDailyQueue()
    } finally {
      initialized.value = true
      loading.value = false
      persistState()
    }
  }

  function updateSettings(partial) {
    const previousDailyCount = settings.value.dailyCount
    settings.value = {
      ...settings.value,
      ...partial
    }
    applyTheme(settings.value.theme)

    if (Object.prototype.hasOwnProperty.call(partial, 'dailyCount') && partial.dailyCount !== previousDailyCount) {
      ensureDailyQueue({
        force: true,
        preserveCompleted: true
      })
    }
  }

  function completeWord(word) {
    if (!dailyQueue.value.completed.includes(word)) {
      dailyQueue.value.completed = [...dailyQueue.value.completed, word]
    }
  }

  function markProficiency(word, proficiency, meta = {}) {
    const now = new Date().toISOString()
    const existingIndex = learningRecords.value.findIndex((item) => item.word === word)
    const currentRecord = existingIndex >= 0 ? learningRecords.value[existingIndex] : null
    const stage = getNextStage(currentRecord?.ebbinghausStage || 0, proficiency)
    const nextReviewDate =
      proficiency >= 4 ? getNextReviewDate(today.value, stage) : getNextReviewDate(today.value, 0)

    const nextRecord = {
      word,
      firstLearnDate: currentRecord?.firstLearnDate || today.value,
      lastReviewDate: today.value,
      nextReviewDate,
      reviewCount: (currentRecord?.reviewCount || 0) + 1,
      proficiency,
      status: getStatusByProficiency(proficiency),
      ebbinghausStage: stage,
      testHistory: [
        ...(currentRecord?.testHistory || []),
        {
          date: now,
          correct: meta.correct ?? proficiency >= 3,
          mode: meta.mode || settings.value.learningMode,
          responseTimeMs: meta.responseTimeMs || 0
        }
      ]
    }

    if (existingIndex >= 0) {
      learningRecords.value.splice(existingIndex, 1, nextRecord)
    } else {
      learningRecords.value.push(nextRecord)
    }

    completeWord(word)
    ensureDailyQueue()
  }

  async function fetchWordDetails(word) {
    if (dictionaryCache.value[word]) {
      return dictionaryCache.value[word]
    }

    const localWord = vocabulary.value.find((item) => item.word === word)
    const remote = await fetchDictionaryEntry(localWord?.fullForm || word)
    const merged = {
      ...localWord,
      phonetic: remote?.phonetic || localWord?.phonetic || '',
      audio: remote?.audio || '',
      meanings: remote?.meanings || [],
      englishDefinition: remote?.englishDefinition || '',
      example: remote?.example || '',
      partOfSpeech: remote?.partOfSpeech || localWord?.partOfSpeech || ''
    }

    dictionaryCache.value[word] = merged
    return merged
  }

  function manualRefreshDailyWords() {
    ensureDailyQueue({
      force: true,
      preserveCompleted: false
    })
  }

  function getAllData() {
    return {
      settings: settings.value,
      learningRecords: learningRecords.value,
      dailyQueue: dailyQueue.value,
      statistics: statistics.value
    }
  }

  function exportAllData() {
    downloadJson(`codevocab_backup_${today.value}.json`, getAllData())
  }

  function importAllData(data) {
    hydrateData(data)
    ensureDailyQueue({
      force: true,
      preserveCompleted: true
    })
    persistState()
  }

  function resetAllData() {
    hydrateData(cloneDefaultData())
    ensureDailyQueue({
      force: true,
      preserveCompleted: false
    })
    persistState()
  }

  const masteryDistribution = computed(() => {
    const buckets = [
      { label: '陌生', value: 0 },
      { label: '认识', value: 0 },
      { label: '熟悉', value: 0 },
      { label: '掌握', value: 0 },
      { label: '精通', value: 0 }
    ]

    learningRecords.value.forEach((item) => {
      const index = Math.min(Math.max(item.proficiency - 1, 0), 4)
      buckets[index].value += 1
    })

    return buckets
  })

  const categoryDistribution = computed(() => {
    const map = new Map()
    learningRecords.value.forEach((record) => {
      const vocab = vocabulary.value.find((item) => item.word === record.word)
      const key = vocab?.category || 'other'
      map.set(key, (map.get(key) || 0) + 1)
    })
    return [...map.entries()].map(([name, value]) => ({ name, value }))
  })

  const activitySummary = computed(() => {
    const days = getRecentDateList(7)
    return days.map((date) => {
      const newCount = learningRecords.value.filter((item) => item.firstLearnDate === date).length
      const reviewCount = learningRecords.value.reduce((sum, item) => {
        const total = item.testHistory?.filter(
          (history) => history.mode === 'review' && history.date.startsWith(date)
        ).length || 0
        return sum + total
      }, 0)

      return {
        date,
        newCount,
        reviewCount
      }
    })
  })

  const trendSummary = computed(() => {
    const days = getRecentDateList(30)
    let cumulative = 0

    return days.map((date) => {
      const newCount = learningRecords.value.filter((item) => item.firstLearnDate === date).length
      cumulative += newCount
      return {
        date,
        newCount,
        cumulative
      }
    })
  })

  watch(
    () => settings.value.theme,
    (theme) => {
      applyTheme(theme)
    },
    {
      immediate: true
    }
  )

  watch(
    [settings, learningRecords, dailyQueue],
    () => {
      if (!initialized.value) {
        return
      }
      recalculateStatistics()
      persistState()
    },
    {
      deep: true
    }
  )

  return {
    activitySummary,
    availableNewWordsCount,
    allWords,
    categoryDistribution,
    completionRate,
    dailyQueue,
    dictionaryCache,
    EBBINGHAUS_INTERVALS,
    exportAllData,
    fetchWordDetails,
    getAllData,
    importAllData,
    initialize,
    initialized,
    learningRecords,
    loading,
    manualRefreshDailyWords,
    markProficiency,
    masteryDistribution,
    newWordItems,
    persistState,
    resetAllData,
    reviewWordItems,
    reviewWords,
    settings,
    statistics,
    today,
    trendSummary,
    updateSettings,
    vocabulary,
    vocabularyCount
  }
})
