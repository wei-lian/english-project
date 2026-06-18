<template>
  <section class="page-shell">
    <div class="page-header">
      <div class="page-title-group">
        <h1>复习中心</h1>
        <p>按艾宾浩斯节奏处理今日到期单词，支持快速复习和深度复习。</p>
      </div>
      <el-segmented v-model="reviewMode" :options="reviewModeOptions" />
    </div>

    <section class="metric-grid">
      <article class="metric-card glass-card">
        <span>今日待复习</span>
        <strong>{{ dueWords.length }}</strong>
      </article>
      <article class="metric-card glass-card">
        <span>最长间隔</span>
        <strong>{{ maxStageInterval }} 天</strong>
      </article>
      <article class="metric-card glass-card">
        <span>累计复习次数</span>
        <strong>{{ totalReviews }}</strong>
      </article>
    </section>

    <section v-if="dueWords.length" class="review-grid">
      <aside class="glass-card review-list app-scrollbar">
        <ReviewItem
          v-for="item in dueWords"
          :key="item.word"
          :item="item"
          :selected="selectedWord?.word === item.word"
          @select="selectWord"
        />
      </aside>

      <div class="review-main">
        <div v-if="reviewMode === 'deep'" class="review-card-panel">
          <FlipCard
            v-if="selectedWord"
            :word-data="selectedWord"
            :detail-data="selectedDetail"
            @detail="showDetail = true"
            @play-audio="playAudio"
            @rate="handleReview"
          />
        </div>

        <div v-else class="quick-grid">
          <article v-for="item in dueWords" :key="item.word" class="glass-card quick-card">
            <div class="quick-head">
              <div>
                <strong>{{ item.word }}</strong>
                <span>{{ item.translations?.zh || item.description || item.englishDefinition || '暂无释义' }}</span>
              </div>
              <el-tag>{{ item.record?.proficiency || 0 }}/5</el-tag>
            </div>
            <p>{{ item.description }}</p>
            <div class="quick-actions">
              <el-button v-for="level in 5" :key="level" plain @click="handleQuickReview(item, level)">
                {{ level }}
              </el-button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section v-else class="glass-card empty-review">
      <el-empty description="今天暂时没有到期复习单词，休息一下也不错。" />
    </section>

    <WordDetail v-model="showDetail" :word-data="selectedDetail || selectedWord || {}" />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import FlipCard from '@/components/FlipCard.vue'
import ReviewItem from '@/components/ReviewItem.vue'
import WordDetail from '@/components/WordDetail.vue'
import { useLearningStore } from '@/stores/learningStore'

const store = useLearningStore()

const reviewModeOptions = [
  { label: '深度复习', value: 'deep' },
  { label: '快速复习', value: 'quick' }
]

const reviewMode = ref('deep')
const showDetail = ref(false)
const selectedWord = ref(null)
const selectedDetail = ref(null)

const dueWords = computed(() => store.reviewWordItems)
const totalReviews = computed(() =>
  store.learningRecords.reduce((sum, item) => sum + (item.reviewCount || 0), 0)
)
const maxStageInterval = computed(() => Math.max(...store.EBBINGHAUS_INTERVALS))

async function loadSelectedDetail() {
  if (!selectedWord.value) {
    selectedDetail.value = null
    return
  }
  selectedDetail.value = await store.fetchWordDetails(selectedWord.value.word)
}

function selectWord(item) {
  selectedWord.value = item
}

function playAudio(audioUrl) {
  if (!audioUrl) {
    return
  }
  const audio = new Audio(audioUrl)
  audio.play()
}

function syncSelectedWord() {
  if (!dueWords.value.length) {
    selectedWord.value = null
    return
  }

  const current = dueWords.value.find((item) => item.word === selectedWord.value?.word)
  selectedWord.value = current || dueWords.value[0]
}

function handleReview(level) {
  if (!selectedWord.value) {
    return
  }
  const targetWord = selectedWord.value.word
  store.markProficiency(targetWord, level, {
    mode: 'review',
    correct: level >= 3
  })
  ElMessage.success(`已完成 ${targetWord} 的复习记录`)
  syncSelectedWord()
}

function handleQuickReview(item, level) {
  store.markProficiency(item.word, level, {
    mode: 'review',
    correct: level >= 3
  })
  ElMessage.success(`已完成 ${item.word} 的快速复习`)
}

watch(
  dueWords,
  () => {
    syncSelectedWord()
  },
  {
    immediate: true
  }
)

watch(
  () => selectedWord.value?.word,
  () => {
    loadSelectedDetail()
  },
  {
    immediate: true
  }
)
</script>

<style scoped lang="scss">
.review-grid {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 18px;
}

.review-list {
  max-height: 720px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.review-main {
  min-width: 0;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
}

.quick-card {
  padding: 20px;
}

.quick-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;

  strong {
    display: block;
    font-family: var(--font-mono);
    font-size: 22px;
  }

  span {
    display: block;
    margin-top: 6px;
    color: var(--text-secondary);
  }
}

.quick-card p {
  color: var(--text-secondary);
  line-height: 1.7;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.empty-review {
  padding: 28px;
}

@media (max-width: 1100px) {
  .review-grid {
    grid-template-columns: 1fr;
  }
}
</style>
