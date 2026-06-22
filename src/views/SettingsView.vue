<template>
  <section class="page-shell">
    <div class="page-header">
      <div class="page-title-group">
        <h1>设置中心</h1>
        <p>调整学习节奏、展示主题与数据管理策略，变更会自动保存到本地，并在配置完成后同步到 Supabase。</p>
      </div>
    </div>

    <section class="settings-grid">
      <article class="glass-card settings-card">
        <div class="card-head">
          <h2>学习偏好</h2>
          <p>这些配置会直接影响每日抽词和学习流程。</p>
        </div>

        <el-alert
          :title="`当前词库共 ${store.vocabularyCount} 个词，可分配新词 ${store.availableNewWordsCount} 个。若你设置为 50 但首页不足 50，一般就是词库总量还不够。`"
          type="info"
          show-icon
          :closable="false"
        />

        <el-form label-position="top">
          <el-form-item label="每日单词数量">
            <el-segmented
              v-model="form.dailyCount"
              :options="[
                { label: '10', value: 10 },
                { label: '20', value: 20 },
                { label: '30', value: 30 },
                { label: '50', value: 50 }
              ]"
            />
          </el-form-item>

          <el-form-item label="学习模式">
            <el-radio-group v-model="form.learningMode">
              <el-radio-button label="flip">翻转卡片</el-radio-button>
              <el-radio-button label="quiz">先测后学</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="主题模式">
            <el-radio-group v-model="form.theme">
              <el-radio-button label="dark">深色模式</el-radio-button>
              <el-radio-button label="light">浅色模式</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="自动播放发音">
            <el-switch v-model="form.autoPlayAudio" />
          </el-form-item>
        </el-form>
      </article>

      <article class="glass-card settings-card">
        <div class="card-head">
          <h2>数据管理</h2>
          <p>当前项目支持浏览器本地缓存和 Supabase 云端数据库双模式。</p>
        </div>

        <div class="sync-panel">
          <div class="sync-row">
            <span>当前存储模式</span>
            <el-tag :type="store.storageMode === 'cloud' ? 'success' : 'info'">
              {{ store.storageMode === 'cloud' ? 'Supabase 云端' : '浏览器本地' }}
            </el-tag>
          </div>
          <div class="sync-row">
            <span>云端同步状态</span>
            <el-tag :type="syncStatusType">{{ syncStatusText }}</el-tag>
          </div>
          <div class="sync-row">
            <span>词库来源</span>
            <el-tag :type="store.vocabularySource === 'cloud' ? 'success' : 'warning'">
              {{ store.vocabularySource === 'cloud' ? 'Supabase 词库表' : '本地词库回退' }}
            </el-tag>
          </div>
          <div v-if="store.cloudProjectUrl" class="sync-row sync-row--column">
            <span>当前 Project URL</span>
            <code>{{ store.cloudProjectUrl }}</code>
          </div>
          <div v-if="store.cloudUserId" class="sync-row sync-row--column">
            <span>匿名用户 ID</span>
            <code>{{ store.cloudUserId }}</code>
          </div>
          <div v-if="store.lastSyncedAt" class="sync-row sync-row--column">
            <span>最近同步时间</span>
            <code>{{ formatSyncTime(store.lastSyncedAt) }}</code>
          </div>
          <p v-if="store.cloudErrorMessage" class="sync-error">{{ store.cloudErrorMessage }}</p>
          <p v-else-if="store.vocabularyCloudErrorMessage" class="sync-error">{{ store.vocabularyCloudErrorMessage }}</p>
          <p v-else class="sync-tip">{{ syncDescription }}</p>
        </div>

        <div class="action-list">
          <el-button type="primary" @click="store.exportAllData()">导出 learning_data.json</el-button>
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            accept=".json,application/json"
            @change="handleImport"
          >
            <el-button plain>导入 learning_data.json</el-button>
          </el-upload>
          <el-button v-if="store.cloudEnabled" plain @click="handleSyncNow">立即同步到云端</el-button>
          <el-button plain @click="refreshQueue">立即刷新今日单词</el-button>
          <el-button type="danger" plain @click="confirmReset">重置全部数据</el-button>
        </div>

        <div class="data-notice">
          <p>本地缓存：浏览器 LocalStorage</p>
          <p>云端表名：`public.user_learning_state`</p>
          <p>云端词库表：`public.vocabulary`</p>
          <p>初始种子：`public/learning_data.json`</p>
          <p>自动保存：每次操作 + 每 30 秒 + 关闭页面前</p>
        </div>
      </article>

      <article class="glass-card settings-card full-span">
        <div class="card-head">
          <h2>测试项目说明</h2>
          <p>这里保留了一些对接真实产品时需要继续扩展的点。</p>
        </div>

        <div class="notes-grid">
          <div class="note-item">
            <strong>数据写回限制</strong>
            <span>纯前端原型无法直接改写 `public/learning_data.json`，因此项目会先落本地缓存，再按配置同步到 Supabase。</span>
          </div>
          <div class="note-item">
            <strong>词库规模</strong>
            <span>当前页面会优先读取 Supabase 的 `public.vocabulary`。如果线上词库为空，才会回退到本地示例词库。</span>
          </div>
          <div class="note-item">
            <strong>接口代理</strong>
            <span>开发环境已预留 Free Dictionary API 代理配置，运行后可直接验证音标和发音拉取。</span>
          </div>
        </div>
      </article>
    </section>
  </section>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { readJsonFile } from '@/utils/fileUtils'
import { useLearningStore } from '@/stores/learningStore'

const store = useLearningStore()
const form = reactive({
  dailyCount: 20,
  theme: 'dark',
  learningMode: 'flip',
  autoPlayAudio: false
})
const syncingForm = ref(false)

const syncStatusText = computed(() => {
  switch (store.cloudStatus) {
    case 'disabled':
      return '未配置'
    case 'connecting':
      return '连接中'
    case 'syncing':
      return '同步中'
    case 'synced':
      return '已同步'
    case 'error':
      return '同步失败'
    default:
      return '待命'
  }
})

const syncStatusType = computed(() => {
  switch (store.cloudStatus) {
    case 'synced':
      return 'success'
    case 'error':
      return 'danger'
    case 'connecting':
    case 'syncing':
      return 'warning'
    default:
      return 'info'
  }
})

const syncDescription = computed(() => {
  if (!store.cloudEnabled) {
    return '还没有检测到 Supabase 环境变量，当前继续使用本地存储。'
  }

  if (store.storageMode === 'cloud') {
    return '云端数据库已经接管主存储，本地缓存会继续作为离线回退。'
  }

  return 'Supabase 已启用，但当前还没有完成可用同步，项目会先使用本地缓存兜底。'
})

function syncForm() {
  syncingForm.value = true
  Object.assign(form, store.settings)
  nextTick(() => {
    syncingForm.value = false
  })
}

function refreshQueue() {
  store.manualRefreshDailyWords()
  ElMessage.success('今日单词队列已刷新。')
}

function formatSyncTime(value) {
  if (!value) {
    return '--'
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false
  })
}

async function handleImport(uploadFile) {
  try {
    const file = uploadFile.raw || uploadFile
    const data = await readJsonFile(file)
    store.importAllData(data)
    syncForm()
    ElMessage.success('学习数据已导入。')
  } catch (error) {
    ElMessage.error('导入失败，请确认 JSON 文件结构正确。')
  }
}

async function handleSyncNow() {
  const success = await store.syncNow()

  if (success) {
    ElMessage.success('学习数据已同步到 Supabase。')
    return
  }

  ElMessage.error(store.cloudErrorMessage || '同步失败，请检查 Supabase 配置。')
}

async function confirmReset() {
  try {
    await ElMessageBox.confirm('这会清空当前浏览器里的全部学习记录，是否继续？', '二次确认', {
      type: 'warning',
      confirmButtonText: '确认重置',
      cancelButtonText: '取消'
    })
    store.resetAllData()
    syncForm()
    ElMessage.success('学习数据已重置。')
  } catch (error) {
    // 用户取消时不提示
  }
}

watch(
  () => store.settings,
  () => {
    syncForm()
  },
  {
    immediate: true,
    deep: true
  }
)

watch(
  form,
  (value) => {
    if (syncingForm.value) {
      return
    }
    store.updateSettings({ ...value })
  },
  {
    deep: true
  }
)
</script>

<style scoped lang="scss">
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.settings-card {
  padding: 24px;
}

.full-span {
  grid-column: 1 / -1;
}

.card-head {
  margin-bottom: 20px;

  h2 {
    margin: 0;
    font-size: 24px;
  }

  p {
    margin: 8px 0 0;
    color: var(--text-secondary);
  }
}

:deep(.el-alert) {
  margin-bottom: 18px;
}

.action-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.sync-panel {
  display: grid;
  gap: 12px;
  margin-bottom: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--bg-muted);
}

.sync-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  span {
    color: var(--text-secondary);
  }

  code {
    margin: 0;
    padding: 6px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-primary);
    word-break: break-all;
  }
}

.sync-row--column {
  align-items: flex-start;
  flex-direction: column;
}

.sync-tip,
.sync-error {
  margin: 0;
  line-height: 1.7;
}

.sync-error {
  color: #ff8d8d;
}

.data-notice {
  margin-top: 18px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.note-item {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--bg-muted);

  strong {
    display: block;
    margin-bottom: 8px;
  }

  span {
    color: var(--text-secondary);
    line-height: 1.7;
  }
}

@media (max-width: 960px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .sync-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
