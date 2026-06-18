<template>
  <section class="page-shell">
    <div class="page-header">
      <div class="page-title-group">
        <h1>学习统计</h1>
        <p>查看学习趋势、掌握分布和分类结构，快速判断最近的学习节奏。</p>
      </div>
      <el-segmented v-model="range" :options="rangeOptions" />
    </div>

    <section class="metric-grid">
      <article class="metric-card glass-card">
        <span>累计学习</span>
        <strong>{{ store.statistics.totalLearned }}</strong>
      </article>
      <article class="metric-card glass-card">
        <span>累计精通</span>
        <strong>{{ store.statistics.totalMastered }}</strong>
      </article>
      <article class="metric-card glass-card">
        <span>最长连续</span>
        <strong>{{ store.statistics.longestStreak }} 天</strong>
      </article>
      <article class="metric-card glass-card">
        <span>总学习时长</span>
        <strong>{{ store.statistics.totalStudyTimeMinutes }} 分钟</strong>
      </article>
    </section>

    <section class="stats-grid">
      <StatChart
        title="累计学习趋势"
        description="观察近期新学词数和累计词汇量变化。"
        :option="trendOption"
        :is-empty="!trendRows.length"
      />
      <StatChart
        title="掌握程度分布"
        description="5 个熟练度等级的分布情况。"
        :option="masteryOption"
        :is-empty="!store.masteryDistribution.some((item) => item.value)"
      />
      <StatChart
        title="每日学习 vs 复习"
        description="近一周内新学数量与复习次数对比。"
        :option="activityOption"
        :is-empty="!activityRows.length"
      />
      <StatChart
        title="词性与分类结构"
        description="目前已经进入学习记录的分类分布。"
        :option="categoryOption"
        :is-empty="!store.categoryDistribution.length"
      />
    </section>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import StatChart from '@/components/StatChart.vue'
import { useLearningStore } from '@/stores/learningStore'
import { addDays, formatDate, getRecentDateList } from '@/utils/dateUtils'

const store = useLearningStore()

const range = ref(30)
const rangeOptions = [
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
  { label: '全部', value: 0 }
]

function getRangeDates() {
  if (range.value === 0) {
    const firstDate = store.learningRecords[0]?.firstLearnDate || store.today
    const dates = []
    let cursor = firstDate
    while (cursor <= store.today) {
      dates.push(cursor)
      cursor = addDays(cursor, 1)
    }
    return dates
  }

  return getRecentDateList(range.value)
}

const trendRows = computed(() => {
  const dates = getRangeDates()
  let cumulative = 0
  return dates.map((date) => {
    const newCount = store.learningRecords.filter((item) => item.firstLearnDate === date).length
    cumulative += newCount
    return {
      date,
      newCount,
      cumulative
    }
  })
})

const activityRows = computed(() => {
  const dates = getRecentDateList(7)
  return dates.map((date) => {
    const newCount = store.learningRecords.filter((item) => item.firstLearnDate === date).length
    const reviewCount = store.learningRecords.reduce((sum, item) => {
      const count = item.testHistory?.filter((history) => history.mode === 'review' && history.date.startsWith(date))
        .length || 0
      return sum + count
    }, 0)
    return {
      date,
      newCount,
      reviewCount
    }
  })
})

const baseAxisStyle = {
  axisLine: { lineStyle: { color: 'rgba(128, 144, 170, 0.28)' } },
  axisLabel: { color: '#93a4bf' },
  splitLine: { lineStyle: { color: 'rgba(128, 144, 170, 0.12)' } }
}

const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: {
    textStyle: { color: '#93a4bf' }
  },
  grid: { left: 10, right: 10, top: 42, bottom: 10, containLabel: true },
  xAxis: {
    type: 'category',
    data: trendRows.value.map((item) => item.date.slice(5)),
    ...baseAxisStyle
  },
  yAxis: {
    type: 'value',
    ...baseAxisStyle
  },
  series: [
    {
      name: '每日新增',
      type: 'line',
      smooth: true,
      areaStyle: {
        color: 'rgba(103, 183, 255, 0.16)'
      },
      lineStyle: {
        color: '#67b7ff'
      },
      itemStyle: {
        color: '#67b7ff'
      },
      data: trendRows.value.map((item) => item.newCount)
    },
    {
      name: '累计词汇量',
      type: 'line',
      smooth: true,
      lineStyle: {
        color: '#6ae0c4'
      },
      itemStyle: {
        color: '#6ae0c4'
      },
      data: trendRows.value.map((item) => item.cumulative)
    }
  ]
}))

const masteryOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: {
    bottom: 0,
    textStyle: { color: '#93a4bf' }
  },
  series: [
    {
      name: '掌握度',
      type: 'pie',
      radius: ['30%', '72%'],
      roseType: 'area',
      itemStyle: {
        borderRadius: 12
      },
      data: store.masteryDistribution.map((item, index) => ({
        name: item.label,
        value: item.value,
        itemStyle: {
          color: ['#ff7070', '#f5b84b', '#67b7ff', '#3fcf8e', '#6ae0c4'][index]
        }
      }))
    }
  ]
}))

const activityOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: {
    textStyle: { color: '#93a4bf' }
  },
  grid: { left: 10, right: 10, top: 42, bottom: 10, containLabel: true },
  xAxis: {
    type: 'category',
    data: activityRows.value.map((item) => item.date.slice(5)),
    ...baseAxisStyle
  },
  yAxis: {
    type: 'value',
    ...baseAxisStyle
  },
  series: [
    {
      name: '新学数量',
      type: 'bar',
      barMaxWidth: 22,
      itemStyle: {
        color: '#67b7ff',
        borderRadius: [8, 8, 0, 0]
      },
      data: activityRows.value.map((item) => item.newCount)
    },
    {
      name: '复习次数',
      type: 'bar',
      barMaxWidth: 22,
      itemStyle: {
        color: '#6ae0c4',
        borderRadius: [8, 8, 0, 0]
      },
      data: activityRows.value.map((item) => item.reviewCount)
    }
  ]
}))

const categoryOption = computed(() => ({
  tooltip: { trigger: 'item' },
  grid: { left: 10, right: 10, top: 18, bottom: 10, containLabel: true },
  xAxis: {
    type: 'value',
    ...baseAxisStyle
  },
  yAxis: {
    type: 'category',
    data: store.categoryDistribution.map((item) => item.name),
    ...baseAxisStyle
  },
  series: [
    {
      type: 'bar',
      itemStyle: {
        color: '#67b7ff',
        borderRadius: [0, 8, 8, 0]
      },
      data: store.categoryDistribution.map((item) => item.value)
    }
  ]
}))
</script>

<style scoped lang="scss">
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 18px;
}
</style>
