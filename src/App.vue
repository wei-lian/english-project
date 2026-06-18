<template>
  <div class="app-layout">
    <AppSidebar />
    <div class="app-main">
      <AppHeader />
      <main class="app-content app-scrollbar">
        <div v-if="store.loading" class="loading-shell glass-card">
          <el-skeleton :rows="8" animated />
        </div>
        <router-view v-else />
      </main>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
import { useLearningStore } from '@/stores/learningStore'

const store = useLearningStore()

function handleBeforeUnload() {
  store.persistState()
}

let autoSaveTimer = null

onMounted(async () => {
  await store.initialize()

  window.addEventListener('beforeunload', handleBeforeUnload)
  autoSaveTimer = window.setInterval(() => {
    store.persistState()
  }, 30000)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (autoSaveTimer) {
    window.clearInterval(autoSaveTimer)
  }
})
</script>

<style scoped lang="scss">
.app-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  min-height: 100vh;
  padding: 18px;
  gap: 18px;
}

.app-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.app-content {
  min-height: 0;
  flex: 1;
  padding: 12px 6px 12px 0;
  overflow: auto;
}

.loading-shell {
  padding: 28px;
}

@media (max-width: 960px) {
  .app-layout {
    grid-template-columns: 1fr;
    padding: 14px;
  }

  .app-content {
    padding-right: 0;
  }
}
</style>
