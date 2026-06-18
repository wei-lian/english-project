<template>
  <aside class="sidebar-shell glass-card">
    <div class="sidebar-top">
      <p class="eyebrow">Learning cockpit</p>
      <h2>CodeVocab</h2>
      <span>代码语境里的英语词汇训练营</span>
    </div>

    <nav class="nav-list">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-link"
        :class="{ active: route.path === item.path }"
      >
        <strong>{{ item.title }}</strong>
        <span>{{ item.description }}</span>
      </router-link>
    </nav>

    <div class="sidebar-foot">
      <p>今日进度</p>
      <strong>{{ store.dailyQueue.completed.length }}/{{ store.dailyQueue.newWords.length || 0 }}</strong>
      <el-progress
        :percentage="store.completionRate"
        :stroke-width="8"
        :show-text="false"
        color="var(--accent)"
      />
    </div>
  </aside>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useLearningStore } from '@/stores/learningStore'

const route = useRoute()
const store = useLearningStore()

const navItems = [
  {
    path: '/home',
    title: '今日学习',
    description: '新词卡片与小测入口'
  },
  {
    path: '/review',
    title: '复习中心',
    description: '到期单词与复习模式'
  },
  {
    path: '/stats',
    title: '学习统计',
    description: '趋势与掌握情况图表'
  },
  {
    path: '/word-bank',
    title: '单词库',
    description: '搜索筛选全部词汇'
  },
  {
    path: '/settings',
    title: '设置中心',
    description: '主题、数据与模式配置'
  }
]
</script>

<style scoped lang="scss">
.sidebar-shell {
  position: sticky;
  top: 18px;
  height: calc(100vh - 36px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 24px;
  gap: 24px;
}

.sidebar-top {
  h2 {
    margin: 10px 0 6px;
    font-size: 28px;
    letter-spacing: -0.06em;
  }

  span {
    color: var(--text-secondary);
    line-height: 1.6;
  }
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 12px;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nav-link {
  padding: 16px 18px;
  border: 1px solid var(--border-color);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.02);
  transition:
    transform var(--transition-base),
    border-color var(--transition-base),
    background var(--transition-base);

  strong {
    display: block;
    font-size: 16px;
  }

  span {
    display: block;
    margin-top: 6px;
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  &:hover,
  &.active {
    transform: translateX(4px);
    border-color: rgba(103, 183, 255, 0.45);
    background: linear-gradient(135deg, rgba(103, 183, 255, 0.1), rgba(106, 224, 196, 0.08));
  }
}

.sidebar-foot {
  padding: 18px;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent);

  p {
    margin: 0;
    color: var(--text-secondary);
  }

  strong {
    display: block;
    margin: 8px 0 16px;
    font-size: 30px;
  }
}

@media (max-width: 960px) {
  .sidebar-shell {
    position: static;
    height: auto;
  }

  .nav-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
}
</style>
