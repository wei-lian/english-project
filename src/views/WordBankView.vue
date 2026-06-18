<template>
  <section class="page-shell">
    <div class="page-header">
      <div class="page-title-group">
        <h1>单词库</h1>
        <p>统一查看全部词条，支持搜索、筛选、排序和详情查看。</p>
      </div>
      <el-tag round effect="dark">共 {{ filteredWords.length }} 条结果</el-tag>
    </div>

    <section class="glass-card filter-shell">
      <el-input v-model="keyword" clearable placeholder="搜索英文、中文或完整拼写" />
      <el-select v-model="proficiency" clearable placeholder="熟练度">
        <el-option label="陌生" :value="1" />
        <el-option label="认识" :value="2" />
        <el-option label="熟悉" :value="3" />
        <el-option label="掌握" :value="4" />
        <el-option label="精通" :value="5" />
      </el-select>
      <el-select v-model="category" clearable placeholder="分类">
        <el-option v-for="item in categoryOptions" :key="item" :label="item" :value="item" />
      </el-select>
      <el-select v-model="sortBy" placeholder="排序方式">
        <el-option label="按字母序" value="alphabetical" />
        <el-option label="按学习日期" value="date" />
        <el-option label="按熟练度" value="proficiency" />
        <el-option label="按复习次数" value="reviews" />
      </el-select>
    </section>

    <WordTable :words="pagedWords" @view="openDetail" />

    <div class="pagination-shell glass-card">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        background
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50, 100]"
        :total="filteredWords.length"
      />
    </div>

    <WordDetail v-model="showDetail" :word-data="detailData || currentWord || {}" />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import WordDetail from '@/components/WordDetail.vue'
import WordTable from '@/components/WordTable.vue'
import { useLearningStore } from '@/stores/learningStore'
import { getWordMeaning } from '@/utils/wordDisplay'

const store = useLearningStore()

const keyword = ref('')
const proficiency = ref(null)
const category = ref('')
const sortBy = ref('alphabetical')
const page = ref(1)
const pageSize = ref(10)
const showDetail = ref(false)
const currentWord = ref(null)
const detailData = ref(null)

const categoryOptions = computed(() => [...new Set(store.vocabulary.map((item) => item.category))])

const filteredWords = computed(() => {
  const lowerKeyword = keyword.value.trim().toLowerCase()
  const rows = store.allWords.filter((item) => {
    const matchKeyword =
      !lowerKeyword ||
      item.word.toLowerCase().includes(lowerKeyword) ||
      item.fullForm?.toLowerCase().includes(lowerKeyword) ||
      getWordMeaning(item).toLowerCase().includes(lowerKeyword) ||
      item.englishDefinition?.toLowerCase().includes(lowerKeyword) ||
      item.description?.toLowerCase().includes(lowerKeyword)
    const matchProficiency =
      !proficiency.value || item.record?.proficiency === proficiency.value
    const matchCategory = !category.value || item.category === category.value
    return matchKeyword && matchProficiency && matchCategory
  })

  return rows.sort((a, b) => {
    if (sortBy.value === 'date') {
      return (b.record?.firstLearnDate || '').localeCompare(a.record?.firstLearnDate || '')
    }
    if (sortBy.value === 'proficiency') {
      return (b.record?.proficiency || 0) - (a.record?.proficiency || 0)
    }
    if (sortBy.value === 'reviews') {
      return (b.record?.reviewCount || 0) - (a.record?.reviewCount || 0)
    }
    return a.word.localeCompare(b.word)
  })
})

const pagedWords = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredWords.value.slice(start, start + pageSize.value)
})

async function openDetail(row) {
  currentWord.value = row
  detailData.value = await store.fetchWordDetails(row.word)
  showDetail.value = true
}

watch([keyword, proficiency, category, sortBy, pageSize], () => {
  page.value = 1
})
</script>

<style scoped lang="scss">
.filter-shell {
  padding: 18px;
  display: grid;
  grid-template-columns: minmax(220px, 1.5fr) repeat(3, minmax(160px, 1fr));
  gap: 12px;
}

.pagination-shell {
  padding: 16px 18px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 1100px) {
  .filter-shell {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 720px) {
  .filter-shell {
    grid-template-columns: 1fr;
  }

  .pagination-shell {
    justify-content: center;
  }
}
</style>
