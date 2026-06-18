<template>
  <section class="chart-shell glass-card">
    <div class="chart-head">
      <div>
        <h3>{{ title }}</h3>
        <p>{{ description }}</p>
      </div>
      <slot name="actions" />
    </div>

    <div v-if="isEmpty" class="chart-empty">
      <el-empty :description="emptyText" />
    </div>
    <v-chart v-else class="chart-view" :option="option" autoresize />
  </section>
</template>

<script setup>
import { use } from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([BarChart, CanvasRenderer, DatasetComponent, GridComponent, LegendComponent, LineChart, PieChart, TooltipComponent])

defineProps({
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  option: {
    type: Object,
    required: true
  },
  isEmpty: {
    type: Boolean,
    default: false
  },
  emptyText: {
    type: String,
    default: '暂无统计数据'
  }
})
</script>

<style scoped lang="scss">
.chart-shell {
  padding: 22px;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.chart-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;

  h3 {
    margin: 0;
    font-size: 22px;
  }

  p {
    margin: 8px 0 0;
    color: var(--text-secondary);
  }
}

.chart-view {
  height: 300px;
}

.chart-empty {
  min-height: 250px;
  display: grid;
  place-items: center;
}

@media (max-width: 720px) {
  .chart-shell {
    padding: 18px;
  }

  .chart-head {
    flex-direction: column;
  }
}
</style>

