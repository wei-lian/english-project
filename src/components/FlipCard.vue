<template>
  <article class="flip-shell">
    <div class="flip-card" :class="{ flipped }" @click="flipped = !flipped">
      <section class="card-face front glass-card">
        <div class="face-top">
          <div>
            <p class="face-label">Today card</p>
            <h2>{{ wordData.word }}</h2>
          </div>
          <el-tag round effect="plain">{{ wordData.category }}</el-tag>
        </div>

        <p class="phonetic">{{ displayData.phonetic || wordData.phonetic || '等待词典补充音标' }}</p>
        <p class="hint">点击卡片翻转，查看释义、代码示例和掌握度标记。</p>

        <div class="meta-row">
          <el-tag size="small" effect="dark">{{ wordData.difficulty }}</el-tag>
          <el-tag size="small" type="info">{{ displayData.partOfSpeech || wordData.partOfSpeech }}</el-tag>
          <el-button v-if="displayData.audio" text @click.stop="$emit('play-audio', displayData.audio)">
            播放发音
          </el-button>
        </div>
      </section>

      <section class="card-face back glass-card">
        <div class="back-scroll app-scrollbar">
          <div class="meaning-panel">
            <div>
              <p class="face-label">词条释义</p>
              <h3>{{ meaningText }}</h3>
            </div>
            <el-button text @click.stop="$emit('detail')">查看详情</el-button>
          </div>

          <p class="description">{{ descriptionText }}</p>

          <div class="example-panel">
            <div class="example-head">
              <strong>代码示例</strong>
              <span>{{ primaryExample?.language || 'javascript' }}</span>
            </div>
            <pre><code v-html="highlightedCode"></code></pre>
            <p v-if="primaryExample?.description" class="example-note">{{ primaryExample.description }}</p>
          </div>

          <div class="full-form">
            <span>完整拼写</span>
            <strong>{{ wordData.fullForm || wordData.word }}</strong>
          </div>
        </div>

        <div class="proficiency-bar" @click.stop>
          <el-button
            v-for="item in proficiencyOptions"
            :key="item.level"
            class="proficiency-btn"
            :type="item.type"
            plain
            @click="$emit('rate', item.level)"
          >
            {{ item.label }}
          </el-button>
        </div>
      </section>
    </div>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import xml from 'highlight.js/lib/languages/xml'
import { getWordDescription, getWordMeaning } from '@/utils/wordDisplay'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('python', python)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('vue', xml)

const props = defineProps({
  wordData: {
    type: Object,
    required: true
  },
  detailData: {
    type: Object,
    default: () => ({})
  }
})

defineEmits(['detail', 'play-audio', 'rate'])

const flipped = ref(false)

const proficiencyOptions = [
  { level: 1, label: '陌生', type: 'danger' },
  { level: 2, label: '认识', type: 'warning' },
  { level: 3, label: '熟悉', type: 'primary' },
  { level: 4, label: '掌握', type: 'success' },
  { level: 5, label: '精通', type: 'success' }
]

const displayData = computed(() => ({
  ...props.wordData,
  ...props.detailData
}))
const meaningText = computed(() => getWordMeaning(displayData.value))
const descriptionText = computed(() => getWordDescription(displayData.value))

const primaryExample = computed(() => displayData.value.codeExamples?.[0] || null)

const highlightedCode = computed(() => {
  const example = primaryExample.value
  if (!example?.code) {
    return '暂无代码示例'
  }

  const language = example.language || 'javascript'
  return hljs.highlight(example.code, {
    language: hljs.getLanguage(language) ? language : 'javascript'
  }).value
})

watch(
  () => props.wordData.word,
  () => {
    flipped.value = false
  }
)
</script>

<style scoped lang="scss">
.flip-shell {
  perspective: 1200px;
}

.flip-card {
  position: relative;
  min-height: 540px;
  transform-style: preserve-3d;
  transition: transform 420ms ease-in-out;
  cursor: pointer;

  &.flipped {
    transform: rotateY(180deg);
  }
}

.card-face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 20px;
  padding: 28px;
  backface-visibility: hidden;
}

.back {
  transform: rotateY(180deg);
}

.face-top,
.meaning-panel,
.example-head,
.full-form,
.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.face-label {
  margin: 0 0 10px;
  color: var(--accent);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-family: var(--font-mono);
}

.front h2 {
  margin: 0;
  font-size: clamp(52px, 8vw, 86px);
  letter-spacing: -0.08em;
  font-family: var(--font-mono);
}

.phonetic {
  margin: 0;
  font-size: 20px;
  color: var(--text-secondary);
}

.hint,
.description,
.example-note {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.7;
}

.back-scroll {
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow: auto;
}

.meaning-panel h3 {
  margin: 4px 0 0;
  font-size: 28px;
}

.example-panel {
  padding: 18px;
  border-radius: 18px;
  background: var(--bg-muted);
  border: 1px solid var(--border-color);

  pre {
    margin: 14px 0 0;
    overflow: auto;
    font-size: 13px;
    line-height: 1.7;
    font-family: var(--font-mono);
  }
}

.full-form {
  padding: 16px 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-color);

  span {
    color: var(--text-secondary);
  }

  strong {
    font-family: var(--font-mono);
    font-size: 18px;
  }
}

.proficiency-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.proficiency-btn {
  flex: 1;
  min-width: 96px;
}

@media (max-width: 720px) {
  .flip-card {
    min-height: 620px;
  }

  .card-face {
    padding: 22px;
  }

  .face-top,
  .meaning-panel,
  .example-head,
  .full-form,
  .meta-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
