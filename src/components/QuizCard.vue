<template>
  <section class="quiz-shell glass-card">
    <div class="quiz-head">
      <div>
        <p class="quiz-label">Quiz mode</p>
        <h2>{{ wordData.word }}</h2>
        <span>{{ wordData.fullForm || wordData.word }}</span>
      </div>
      <el-tag round>{{ wordData.category }}</el-tag>
    </div>

    <p class="quiz-copy">请选择最贴合当前术语的释义，答错后会进入学习卡片模式。</p>

    <el-radio-group v-model="selected" class="quiz-options">
      <el-radio
        v-for="option in options"
        :key="option.value"
        class="quiz-option"
        :label="option.value"
      >
        {{ option.label }}
      </el-radio>
    </el-radio-group>

    <div class="quiz-actions">
      <el-button type="primary" :disabled="!selected" @click="submitAnswer">确认答案</el-button>
      <el-button plain @click="handleGiveUp">不会，进入学习</el-button>
      <el-button text @click="$emit('detail')">查看详情</el-button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getWordMeaning } from '@/utils/wordDisplay'

const props = defineProps({
  wordData: {
    type: Object,
    required: true
  },
  options: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['detail', 'give-up', 'submit'])

const selected = ref('')
const startTime = ref(Date.now())
const correctAnswer = computed(() => getWordMeaning(props.wordData))

function submitAnswer() {
  emit('submit', {
    selected: selected.value,
    correct: selected.value === correctAnswer.value,
    responseTimeMs: Date.now() - startTime.value
  })
}

function handleGiveUp() {
  emit('give-up')
}

watch(
  () => props.wordData.word,
  () => {
    selected.value = ''
    startTime.value = Date.now()
  }
)
</script>

<style scoped lang="scss">
.quiz-shell {
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.quiz-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;

  h2 {
    margin: 6px 0;
    font-size: clamp(42px, 6vw, 64px);
    letter-spacing: -0.08em;
    font-family: var(--font-mono);
  }

  span {
    color: var(--text-secondary);
  }
}

.quiz-label {
  margin: 0;
  color: var(--accent);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-family: var(--font-mono);
}

.quiz-copy {
  margin: 0;
  color: var(--text-secondary);
}

.quiz-options {
  display: grid;
  gap: 12px;
}

.quiz-option {
  margin-right: 0;
  border: 1px solid var(--border-color);
  border-radius: 18px;
  padding: 16px 18px;
  background: var(--bg-muted);
}

.quiz-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

@media (max-width: 720px) {
  .quiz-shell {
    padding: 22px;
  }

  .quiz-head {
    flex-direction: column;
  }
}
</style>
