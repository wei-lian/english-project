<template>
  <section class="page-shell">
    <div class="page-header">
      <div class="page-title-group">
        <h1>今日学习</h1>
        <p>根据今日队列推进新词学习，支持翻转卡片和先测后学两种模式。</p>
      </div>
      <div class="home-actions">
        <el-segmented v-model="mode" :options="modeOptions" />
        <el-button plain @click="refreshQueue">重新抽词</el-button>
      </div>
    </div>

    <section class="metric-grid">
      <article class="metric-card glass-card">
        <span>今日新词</span>
        <strong>{{ store.dailyQueue.newWords.length }}</strong>
      </article>
      <article class="metric-card glass-card">
        <span>今日已完成</span>
        <strong>{{ store.dailyQueue.completed.length }}</strong>
      </article>
      <article class="metric-card glass-card">
        <span>待复习</span>
        <strong>{{ store.reviewWords.length }}</strong>
      </article>
      <article class="metric-card glass-card">
        <span>完成度</span>
        <strong>{{ store.completionRate }}%</strong>
      </article>
    </section>

    <el-alert
      v-if="queueLimitNotice"
      :title="queueLimitNotice"
      type="warning"
      show-icon
      :closable="false"
    />

    <section v-if="currentWord" class="home-grid">
      <div class="main-panel">
        <FlipCard
          v-if="mode === 'flip' || quizLearningMode"
          :word-data="currentWord"
          :detail-data="currentDetail"
          @detail="showDetail = true"
          @play-audio="playAudio"
          @rate="handleRate"
        />
        <QuizCard
          v-else
          :word-data="currentWord"
          :options="quizOptions"
          @detail="showDetail = true"
          @give-up="enterLearningMode"
          @submit="handleQuizSubmit"
        />
      </div>

      <div class="side-panel">
        <article class="glass-card progress-card">
          <p class="section-note">当前进度</p>
          <el-progress :percentage="store.completionRate" :stroke-width="12" />
          <div class="progress-row">
            <span>剩余词数</span>
            <strong>{{ pendingWords.length }}</strong>
          </div>
          <div class="progress-row">
            <span>当前模式</span>
            <strong>{{ modeLabel }}</strong>
          </div>
          <div class="progress-row">
            <span>今日日期</span>
            <strong>{{ store.today }}</strong>
          </div>
        </article>

        <article class="glass-card tips-card">
          <p class="section-note">学习建议</p>
          <ul>
            <li>先看英文和音标，尝试在脑中回忆含义。</li>
            <li>如果答错，切换到学习卡片重新标记掌握度。</li>
            <li>代码示例尽量和你熟悉的技术栈一起记忆。</li>
          </ul>
        </article>
      </div>
    </section>

    <section v-else class="glass-card complete-card">
      <h2>今天的新词已经学习完成</h2>
      <p>你可以去复习中心继续巩固，也可以手动刷新再抽一批新词。</p>
      <div class="complete-actions">
        <el-button type="primary" @click="router.push('/review')">去复习中心</el-button>
        <el-button plain @click="refreshQueue">重新抽词</el-button>
      </div>
    </section>

    <WordDetail v-model="showDetail" :word-data="currentDetail || currentWord || {}" />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import FlipCard from '@/components/FlipCard.vue'
import QuizCard from '@/components/QuizCard.vue'
import WordDetail from '@/components/WordDetail.vue'
import { useLearningStore } from '@/stores/learningStore'
import { getWordMeaning } from '@/utils/wordDisplay'

const store = useLearningStore()
const router = useRouter()

const showDetail = ref(false)
const currentDetail = ref(null)
const quizLearningMode = ref(false)
const quizAttempt = ref(null)
const modeOptions = [
  { label: '翻转卡片', value: 'flip' },
  { label: '先测后学', value: 'quiz' }
]

const mode = computed({
  get: () => store.settings.learningMode,
  set: (value) =>
    store.updateSettings({
      learningMode: value
    })
})

const pendingWords = computed(() =>
  store.newWordItems.filter((item) => !store.dailyQueue.completed.includes(item.word))
)

const currentWord = computed(() => pendingWords.value[0] || null)

const modeLabel = computed(() => (mode.value === 'quiz' ? '先测后学' : '翻转卡片'))
const queueLimitNotice = computed(() => {
  if (store.availableNewWordsCount >= store.settings.dailyCount) {
    return ''
  }

  return `当前词库共 ${store.vocabularyCount} 个词，已有 ${store.learningRecords.length} 个进入学习记录，所以今天最多只能安排 ${store.availableNewWordsCount} 个新词。扩充词库后会自动补足。`
})

const quizOptions = computed(() => {
  if (!currentWord.value) {
    return []
  }

  const distractors = store.vocabulary
    .filter((item) => item.word !== currentWord.value.word)
    .map((item) => getWordMeaning(item))
    .filter(Boolean)

  const values = [getWordMeaning(currentWord.value), ...distractors]
  return [...new Set(values)]
    .slice(0, 4)
    .map((value) => ({
      value,
      label: value
    }))
    .sort(() => Math.random() - 0.5)
})

async function loadDetail() {
  if (!currentWord.value) {
    currentDetail.value = null
    return
  }
  currentDetail.value = await store.fetchWordDetails(currentWord.value.word)
}

function resetQuizState() {
  quizLearningMode.value = false
  quizAttempt.value = null
}

function playAudio(audioUrl) {
  if (!audioUrl) {
    return
  }
  const audio = new Audio(audioUrl)
  audio.play()
}

function finalizeWord(level, meta = {}) {
  if (!currentWord.value) {
    return
  }

  const targetWord = currentWord.value.word

  store.markProficiency(targetWord, level, {
    mode: meta.mode || mode.value,
    correct: meta.correct ?? level >= 3,
    responseTimeMs: meta.responseTimeMs || 0
  })
  resetQuizState()
  ElMessage.success(`已记录 ${targetWord} 的掌握度`)
}

function handleRate(level) {
  finalizeWord(level, {
    mode: quizLearningMode.value ? 'quiz' : mode.value,
    correct: quizAttempt.value?.correct ?? level >= 3,
    responseTimeMs: quizAttempt.value?.responseTimeMs || 0
  })
}

function enterLearningMode() {
  quizLearningMode.value = true
  quizAttempt.value = {
    correct: false,
    responseTimeMs: 0
  }
  ElMessage.warning('已切换到学习卡片模式，请先理解释义后再标记掌握度。')
}

function handleQuizSubmit(payload) {
  if (!currentWord.value) {
    return
  }

  if (payload.correct) {
    finalizeWord(4, {
      mode: 'quiz',
      correct: true,
      responseTimeMs: payload.responseTimeMs
    })
    return
  }

  quizAttempt.value = payload
  quizLearningMode.value = true
  ElMessage.warning('答案不正确，先看学习卡片再继续。')
}

function refreshQueue() {
  store.manualRefreshDailyWords()
  resetQuizState()
  ElMessage.success('今日新词队列已刷新。')
}

watch(
  currentWord,
  () => {
    resetQuizState()
    loadDetail()
  },
  {
    immediate: true
  }
)
</script>

<style scoped lang="scss">
.home-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
  gap: 18px;
}

.main-panel,
.side-panel {
  min-width: 0;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.progress-card,
.tips-card,
.complete-card {
  padding: 24px;
}

.section-note {
  margin: 0 0 18px;
  color: var(--accent);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-family: var(--font-mono);
}

.progress-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;

  span {
    color: var(--text-secondary);
  }
}

.tips-card ul {
  margin: 0;
  padding-left: 18px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.complete-card {
  text-align: center;

  h2 {
    margin-top: 0;
    font-size: 34px;
  }

  p {
    color: var(--text-secondary);
  }
}

.complete-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}

@media (max-width: 1100px) {
  .home-grid {
    grid-template-columns: 1fr;
  }
}
</style>
