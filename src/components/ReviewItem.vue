<template>
  <button class="review-item" :class="{ active: selected }" type="button" @click="$emit('select', item)">
    <div>
      <strong>{{ item.word }}</strong>
      <span>{{ meaningText }}</span>
    </div>
    <div class="review-meta">
      <el-tag size="small">{{ item.record?.proficiency || 0 }}/5</el-tag>
      <small>到期：{{ item.record?.nextReviewDate || '今日' }}</small>
    </div>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { getWordMeaning } from '@/utils/wordDisplay'

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  }
})

defineEmits(['select'])

const meaningText = computed(() => getWordMeaning(props.item))
</script>

<style scoped lang="scss">
.review-item {
  width: 100%;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--bg-muted);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  text-align: left;
  cursor: pointer;
  transition:
    transform var(--transition-base),
    border-color var(--transition-base),
    background var(--transition-base);

  &:hover,
  &.active {
    transform: translateX(4px);
    border-color: rgba(103, 183, 255, 0.45);
    background: linear-gradient(135deg, rgba(103, 183, 255, 0.1), rgba(106, 224, 196, 0.08));
  }

  strong {
    display: block;
    font-family: var(--font-mono);
    font-size: 18px;
  }

  span,
  small {
    color: var(--text-secondary);
  }
}

.review-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

@media (max-width: 720px) {
  .review-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .review-meta {
    align-items: flex-start;
  }
}
</style>
