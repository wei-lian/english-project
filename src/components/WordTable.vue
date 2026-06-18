<template>
  <div class="word-table-shell glass-card">
    <el-table :data="words" stripe>
      <el-table-column label="英文" min-width="160">
        <template #default="{ row }">
          <div class="word-main">
            <strong>{{ row.word }}</strong>
            <span>{{ row.fullForm || row.word }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="释义" min-width="220">
        <template #default="{ row }">
          {{ getWordMeaning(row) }}
        </template>
      </el-table-column>
      <el-table-column prop="category" label="分类" min-width="120" />
      <el-table-column prop="partOfSpeech" label="词性" min-width="120" />
      <el-table-column label="熟练度" min-width="120">
        <template #default="{ row }">
          <el-tag>{{ row.record?.proficiency || 0 }}/5</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="复习次数" min-width="110">
        <template #default="{ row }">
          {{ row.record?.reviewCount || 0 }}
        </template>
      </el-table-column>
      <el-table-column label="下次复习" min-width="130">
        <template #default="{ row }">
          {{ row.record?.nextReviewDate || '未学习' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <el-button text @click="$emit('view', row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { getWordMeaning } from '@/utils/wordDisplay'

defineProps({
  words: {
    type: Array,
    default: () => []
  }
})

defineEmits(['view'])
</script>

<style scoped lang="scss">
.word-table-shell {
  padding: 12px;
}

.word-main {
  display: flex;
  flex-direction: column;
  gap: 4px;

  strong {
    font-family: var(--font-mono);
  }

  span {
    color: var(--text-secondary);
    font-size: 12px;
  }
}
</style>
