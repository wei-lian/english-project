<template>
  <header class="header-shell glass-card">
    <div class="brand-block">
      <div class="brand-mark">CV</div>
      <div>
        <strong>CodeVocab</strong>
        <p>{{ currentTitle }}</p>
      </div>
    </div>

    <div class="header-metrics">
      <div class="metric-pill">
        <span>连续学习</span>
        <strong>{{ store.statistics.currentStreak }} 天</strong>
      </div>
      <div class="metric-pill">
        <span>累计掌握</span>
        <strong>{{ store.statistics.totalMastered }} 词</strong>
      </div>
    </div>

    <div class="header-actions">
      <div class="theme-toggle">
        <span>浅色</span>
        <el-switch
          :model-value="store.settings.theme === 'dark'"
          inline-prompt
          active-text="暗"
          inactive-text="亮"
          @change="toggleTheme"
        />
      </div>
      <el-button plain @click="router.push('/settings')">设置</el-button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLearningStore } from '@/stores/learningStore'

const store = useLearningStore()
const route = useRoute()
const router = useRouter()

const currentTitle = computed(() => route.meta.title || '学习工具')

function toggleTheme(value) {
  store.updateSettings({
    theme: value ? 'dark' : 'light'
  })
}
</script>

<style scoped lang="scss">
.header-shell {
  min-height: var(--header-height);
  padding: 18px 22px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 18px;
  align-items: center;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 14px;

  strong {
    display: block;
    font-size: 21px;
    letter-spacing: -0.04em;
  }

  p {
    margin: 4px 0 0;
    color: var(--text-secondary);
    font-size: 13px;
  }
}

.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-weight: 700;
  color: #081019;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  box-shadow: 0 10px 22px rgba(103, 183, 255, 0.25);
}

.header-metrics {
  display: flex;
  gap: 12px;
}

.metric-pill {
  padding: 10px 14px;
  border-radius: 16px;
  background: var(--bg-muted);
  border: 1px solid var(--border-color);
  min-width: 108px;

  span {
    display: block;
    color: var(--text-secondary);
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 6px;
    font-size: 16px;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 13px;
}

@media (max-width: 1200px) {
  .header-shell {
    grid-template-columns: 1fr;
  }

  .header-metrics,
  .header-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .header-metrics {
    flex-wrap: wrap;
  }

  .header-actions {
    flex-wrap: wrap;
  }
}
</style>
