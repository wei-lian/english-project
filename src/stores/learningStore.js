import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import vocabularySeed from '@/data/vocabulary.json'
import {
  fetchCloudState,
  fetchCloudVocabulary,
  getSupabaseConfig,
  isSupabaseConfigured,
  saveCloudState
} from '@/lib/supabase'
import { fetchDictionaryEntry } from '@/utils/api'
import { formatDate, getRecentDateList } from '@/utils/dateUtils'
import { EBBINGHAUS_INTERVALS, getNextReviewDate, getNextStage, isReviewDue } from '@/utils/ebbinghaus'
import { downloadJson } from '@/utils/fileUtils'
import { applyTheme } from '@/utils/themeUtils'

const STORAGE_KEY = 'codevocab-learning-data-v1'
const CLOUD_SYNC_DEBOUNCE_MS = 1200

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

function hasStoredWordDetails(word) {
  if (!word) {
    return false
  }

  return Boolean(
    word.phonetic ||
      word.audio ||
      word.englishDefinition ||
      word.example ||
      word.description ||
      word.meanings?.length ||
      word.codeExamples?.length
  )
}

export const useLearningStore = defineStore('learning', () => {
  const cloudConfig = getSupabaseConfig()
  const initialized = ref(false)
  const loading = ref(false)
  const settings = ref({ ...DEFAULT_SETTINGS })
  const learningRecords = ref([])
  const dailyQueue = ref({ ...DEFAULT_QUEUE })
  const statistics = ref({ ...DEFAULT_STATISTICS })
  const dictionaryCache = ref({})
  const vocabulary = ref(vocabularySeed)
  const vocabularySource = ref('local')
  const vocabularyCloudErrorMessage = ref('')
  const cloudEnabled = ref(isSupabaseConfigured)
  const storageMode = ref('local')
  const cloudStatus = ref(cloudEnabled.value ? 'idle' : 'disabled')
  const cloudErrorMessage = ref('')
  const cloudUserId = ref('')
  const lastSyncedAt = ref('')

  let cloudSyncTimer = null

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

  function readLocalSnapshot() {
    if (typeof localStorage === 'undefined') {
      return null
    }

    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return null
    }

    try {
      return JSON.parse(stored)
    } catch (error) {
      console.warn('[CodeVocab] 本地缓存解析失败，已忽略。', error)
      return null
    }
  }

  async function fetchSeedSnapshot() {
    try {
      const response = await fetch('/learning_data.json')
      if (!response.ok) {
        return cloneDefaultData()
      }
      return await response.json()
    } catch (error) {
      console.warn('[CodeVocab] 种子数据加载失败，已回退默认数据。', error)
      return cloneDefaultData()
    }
  }

  async function pushCloudSnapshot(snapshot) {
    if (!cloudEnabled.value) {
      storageMode.value = 'local'
      return false
    }

    cloudStatus.value = 'syncing'
    cloudErrorMessage.value = ''

    try {
      const result = await saveCloudState(snapshot)
      cloudUserId.value = result.userId || ''
      lastSyncedAt.value = result.updatedAt || new Date().toISOString()
      storageMode.value = 'cloud'
      cloudStatus.value = 'synced'
      return true
    } catch (error) {
      storageMode.value = 'local'
      cloudStatus.value = 'error'
      cloudErrorMessage.value = error?.message || '云端同步失败'
      console.warn('[CodeVocab] 云端同步失败，已回退本地存储。', error)
      return false
    }
  }

  function scheduleCloudSync() {
    if (!cloudEnabled.value) {
      return
    }

    if (cloudSyncTimer) {
      window.clearTimeout(cloudSyncTimer)
    }

    cloudSyncTimer = window.setTimeout(() => {
      cloudSyncTimer = null
      void pushCloudSnapshot(getAllData())
    }, CLOUD_SYNC_DEBOUNCE_MS)
  }

  function persistState(options = {}) {
    const { immediateRemote = false } = options
    const snapshot = getAllData()

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    }

    if (!cloudEnabled.value) {
      storageMode.value = 'local'
      cloudStatus.value = 'disabled'
      return Promise.resolve(false)
    }

    if (immediateRemote) {
      return pushCloudSnapshot(snapshot)
    }

    scheduleCloudSync()
    return Promise.resolve(true)
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
      const localSnapshot = readLocalSnapshot()
      hydrateData(localSnapshot || (await fetchSeedSnapshot()))

      let shouldCreateCloudRow = false

      if (cloudEnabled.value) {
        cloudStatus.value = 'connecting'
        cloudErrorMessage.value = ''

        try {
          const remoteState = await fetchCloudState()
          cloudUserId.value = remoteState.userId || ''

          if (remoteState.snapshot) {
            hydrateData(remoteState.snapshot)
            storageMode.value = 'cloud'
            cloudStatus.value = 'synced'
            lastSyncedAt.value = remoteState.updatedAt || ''
          } else {
            shouldCreateCloudRow = true
          }
        } catch (error) {
          storageMode.value = 'local'
          cloudStatus.value = 'error'
          cloudErrorMessage.value = error?.message || '云端读取失败'
          console.warn('[CodeVocab] 云端读取失败，已回退本地存储。', error)
        }

        try {
          const remoteVocabulary = await fetchCloudVocabulary()
          if (remoteVocabulary.length) {
            vocabulary.value = remoteVocabulary
            vocabularySource.value = 'cloud'
            vocabularyCloudErrorMessage.value = ''
          } else {
            vocabulary.value = vocabularySeed
            vocabularySource.value = 'local'
            vocabularyCloudErrorMessage.value = 'Supabase 词库表当前为空，已回退本地词库。'
          }
        } catch (error) {
          vocabulary.value = vocabularySeed
          vocabularySource.value = 'local'
          vocabularyCloudErrorMessage.value = error?.message || '云端词库读取失败'
          console.warn('[CodeVocab] 云端词库读取失败，已回退本地词库。', error)
        }
      }

      ensureDailyQueue()

      if (cloudEnabled.value && (storageMode.value === 'cloud' || shouldCreateCloudRow)) {
        await persistState({
          immediateRemote: true
        })
      } else {
        await persistState()
      }
    } catch (error) {
      console.error('[CodeVocab] 初始化失败，已回退默认数据。', error)
      hydrateData(cloneDefaultData())
      ensureDailyQueue()
      await persistState()
    } finally {
      initialized.value = true
      loading.value = false
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
    const remote = hasStoredWordDetails(localWord) ? null : await fetchDictionaryEntry(localWord?.fullForm || word)
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

  function syncNow() {
    return persistState({
      immediateRemote: true
    })
  }

  function importAllData(data) {
    hydrateData(data)
    ensureDailyQueue({
      force: true,
      preserveCompleted: true
    })
    void persistState({
      immediateRemote: true
    })
  }

  function resetAllData() {
    hydrateData(cloneDefaultData())
    ensureDailyQueue({
      force: true,
      preserveCompleted: false
    })
    void persistState({
      immediateRemote: true
    })
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
    cloudEnabled,
    cloudErrorMessage,
    cloudProjectUrl: cloudConfig.projectUrl,
    cloudStatus,
    cloudUserId,
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
    lastSyncedAt,
    persistState,
    resetAllData,
    storageMode,
    reviewWordItems,
    reviewWords,
    settings,
    syncNow,
    statistics,
    today,
    trendSummary,
    updateSettings,
    vocabulary,
    vocabularyCloudErrorMessage,
    vocabularyCount,
    vocabularySource
  }
})
