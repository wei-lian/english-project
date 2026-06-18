<template>
  <el-dialog v-model="visible" width="min(920px, 92vw)" destroy-on-close>
    <template #header>
      <div class="dialog-head">
        <div>
          <h2>{{ wordData.word }}</h2>
          <p>{{ wordData.fullForm || wordData.word }}</p>
        </div>
        <div class="dialog-tags">
          <el-tag effect="plain">{{ wordData.category }}</el-tag>
          <el-tag type="info">{{ wordData.partOfSpeech || '未标注词性' }}</el-tag>
        </div>
      </div>
    </template>

    <div class="detail-shell app-scrollbar">
      <section class="detail-section">
        <div>
          <span class="section-label">音标</span>
          <strong>{{ wordData.phonetic || '暂无音标' }}</strong>
        </div>
        <el-button v-if="wordData.audio" text @click="playAudio">播放发音</el-button>
      </section>

      <section class="detail-section">
        <span class="section-label">词条释义</span>
        <p>{{ meaningText }}</p>
        <p class="sub-copy">{{ descriptionText }}</p>
      </section>

      <section v-if="wordData.englishDefinition || wordData.example" class="detail-section">
        <span class="section-label">词典补充</span>
        <p v-if="wordData.englishDefinition">{{ wordData.englishDefinition }}</p>
        <p v-if="wordData.example" class="sub-copy">例句：{{ wordData.example }}</p>
      </section>

      <section class="detail-section">
        <span class="section-label">代码示例</span>
        <el-tabs stretch>
          <el-tab-pane
            v-for="example in wordData.codeExamples || []"
            :key="`${wordData.word}-${example.language}`"
            :label="example.language"
          >
            <pre><code v-html="getHighlightedCode(example)"></code></pre>
            <p v-if="example.description" class="sub-copy">{{ example.description }}</p>
          </el-tab-pane>
        </el-tabs>
      </section>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import xml from 'highlight.js/lib/languages/xml'
import { getWordDescription, getWordMeaning } from '@/utils/wordDisplay'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('vue', xml)

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  wordData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
const meaningText = computed(() => getWordMeaning(props.wordData))
const descriptionText = computed(() => getWordDescription(props.wordData))

function getHighlightedCode(example) {
  if (!example?.code) {
    return '暂无代码示例'
  }

  const language = example.language || 'javascript'
  return hljs.highlight(example.code, {
    language: hljs.getLanguage(language) ? language : 'javascript'
  }).value
}

function playAudio() {
  if (!props.wordData.audio) {
    return
  }
  const audio = new Audio(props.wordData.audio)
  audio.play()
}
</script>

<style scoped lang="scss">
.dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  h2 {
    margin: 0;
    font-size: 34px;
    font-family: var(--font-mono);
  }

  p {
    margin: 6px 0 0;
    color: var(--text-secondary);
  }
}

.dialog-tags {
  display: flex;
  gap: 10px;
}

.detail-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-height: 70vh;
  overflow: auto;
}

.detail-section {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--bg-muted);
}

.section-label {
  display: block;
  color: var(--accent);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-family: var(--font-mono);
}

.detail-section p,
.detail-section strong {
  margin: 10px 0 0;
}

.sub-copy {
  color: var(--text-secondary);
}

pre {
  margin: 14px 0 0;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
}

@media (max-width: 720px) {
  .dialog-head {
    flex-direction: column;
  }
}
</style>
