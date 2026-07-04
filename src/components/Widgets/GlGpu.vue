<template>
<div class="glances-gpu-wrapper" v-if="gpus">
  <p v-if="!gpus.length" class="no-gpu">{{ $t('widgets.glances.gpu-none') }}</p>
  <div class="gpu-card" v-for="gpu in gpus" :key="gpu.id">
    <p class="gpu-name">{{ gpu.name }}</p>
    <div class="metric" v-for="bar in gpu.bars" :key="bar.label">
      <p class="label">{{ bar.label }}</p>
      <div class="bar">
        <div
          class="bar-fill"
          :class="`range-${bar.color}`"
          :style="{ width: `${bar.value || 0}%` }"
        ></div>
        <span class="bar-text">{{ bar.value === null ? '—' : `${bar.value}%` }}</span>
      </div>
    </div>
    <div class="gpu-footer">
      <p class="temp" :class="`range-${gpu.tempColor}`">
        {{ $t('widgets.glances.gpu-temperature') }}: {{ gpu.temp }}
      </p>
      <p class="fan" v-if="gpu.fan !== null">
        {{ $t('widgets.glances.gpu-fan-speed') }}: {{ gpu.fan }} rpm
      </p>
    </div>
  </div>
</div>
</template>

<script>
import WidgetMixin from '@/mixins/WidgetMixin';
import GlancesMixin from '@/mixins/GlancesMixin';
import { celsiusToFahrenheit } from '@/utils/MiscHelpers';

export default {
  mixins: [WidgetMixin, GlancesMixin],
  data() {
    return {
      gpus: null,
    };
  },
  computed: {
    endpoint() {
      return this.makeGlancesUrl('gpu');
    },
    /* Desired temperature unit, either Celsius (default) or Fahrenheit */
    units() {
      return `${this.options.units || 'C'}`.toUpperCase() === 'F' ? 'F' : 'C';
    },
  },
  methods: {
    /* Map raw Glances GPU list into display-ready cards */
    processData(gpuData) {
      if (!Array.isArray(gpuData)) return;
      this.gpus = gpuData.map((gpu, index) => {
        const id = gpu.gpu_id ?? index;
        return {
          id,
          name: gpu.name || `GPU ${id}`,
          bars: [
            this.makeBar(this.$t('widgets.glances.gpu-usage'), gpu.proc),
            this.makeBar(this.$t('widgets.glances.gpu-memory'), gpu.mem),
          ],
          fan: this.round(gpu.fan_speed),
          ...this.makeTemp(gpu.temperature),
        };
      });
    },
    /* Build a labelled progress bar for a percentage metric */
    makeBar(label, value) {
      const percent = this.round(value);
      return { label, value: percent, color: this.usageColor(percent) };
    },
    /* Format temperature, converting units if needed, and pick its color */
    makeTemp(celsius) {
      if (celsius === null || celsius === undefined || Number.isNaN(celsius)) {
        return { temp: '—', tempColor: 'grey' };
      }
      const value = this.units === 'F' ? celsiusToFahrenheit(celsius) : Math.round(celsius);
      return { temp: `${value}°${this.units}`, tempColor: this.tempColor(celsius) };
    },
    round(value) {
      return (value === null || value === undefined || Number.isNaN(value)) ? null : Math.round(value);
    },
    usageColor(percent) {
      if (percent === null) return 'grey';
      if (percent >= 85) return 'red';
      if (percent >= 50) return 'yellow';
      return 'green';
    },
    tempColor(celsius) {
      if (celsius >= 75) return 'red';
      if (celsius >= 50) return 'yellow';
      return 'green';
    },
  },
  created() {
    this.overrideUpdateInterval = 2;
  },
};
</script>

<style scoped lang="scss">
.glances-gpu-wrapper {
  color: var(--widget-text-color);
  .no-gpu {
    text-align: center;
    margin: 1rem 0;
    opacity: var(--dimming-factor);
  }
  .gpu-card {
    padding: 0.5rem 0;
    &:not(:last-child) {
      border-bottom: 1px dashed var(--widget-text-color);
    }
    p.gpu-name {
      margin: 0 0 0.5rem 0;
      font-weight: bold;
      font-size: 1.1rem;
    }
  }
  .metric {
    display: flex;
    align-items: center;
    margin: 0.35rem 0;
    p.label {
      margin: 0;
      width: 4.5rem;
      font-size: 0.9rem;
    }
    .bar {
      position: relative;
      flex: 1;
      height: 1.2rem;
      background: var(--widget-accent-color);
      border-radius: var(--curve-factor);
      overflow: hidden;
      .bar-fill {
        height: 100%;
        transition: width 0.5s ease;
        &.range-green { background: var(--success); }
        &.range-yellow { background: var(--warning); }
        &.range-red { background: var(--danger); }
        &.range-grey { background: var(--medium-grey); }
      }
      .bar-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 0.75rem;
        font-family: var(--font-monospace);
      }
    }
  }
  .gpu-footer {
    display: flex;
    justify-content: space-between;
    margin-top: 0.4rem;
    p {
      margin: 0;
      font-size: 0.9rem;
      font-family: var(--font-monospace);
    }
    p.temp {
      font-weight: bold;
      &.range-green { color: var(--success); }
      &.range-yellow { color: var(--warning); }
      &.range-red { color: var(--danger); }
      &.range-grey { color: var(--medium-grey); }
    }
  }
}
</style>
