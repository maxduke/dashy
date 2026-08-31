<template>
  <div>
    <template v-if="monitors">
      <div v-for="monitor in monitors" :key="monitor.name" class="item-wrapper">
        <div class="item monitor-row" v-tooltip="monitorTooltip(monitor)">
          <div class="title-title"><span class="text">{{ monitor.name }}</span></div>
          <div class="monitors-container">
            <div v-if="!hideStatus" class="status-container">
              <span class="status-pill" :class="getStatusClass(monitor.status)">
                {{ getStatusText(monitor.status) }}
              </span>
            </div>
            <div v-if="!hideResponseTime" class="status-container">
              <span class="response-time">{{ formatResponseTime(monitor.responseTime) }}</span>
            </div>
            <div v-if="!hideUptime && monitor.uptime" class="status-container">
              <span class="uptime">{{ monitor.uptime }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-if="errorMessage">
      <div class="error-message">
        <span class="text">{{ errorMessage }}</span>
      </div>
    </template>
  </div>
</template>

<script>
/**
 * Renders the status and response time of each monitor on an Uptime Kuma
 * instance, read from its Prometheus-format `/metrics` endpoint
 */
import WidgetMixin from '@/mixins/WidgetMixin';

const STATUSES = {
  0: { text: 'Down', class: 'down' },
  1: { text: 'Up', class: 'up' },
  2: { text: 'Pending', class: 'pending' },
  3: { text: 'Maintenance', class: 'maintenance' },
};
const UNKNOWN = { text: 'Unknown', class: 'unknown' };
const WINDOWS = [['1d', '24h'], ['30d', '30d'], ['365d', '1y']];
const formatPercent = (ratio) => `${(ratio * 100).toFixed(2)}%`;

export default {
  mixins: [WidgetMixin],
  data() {
    return {
      monitors: null,
      errorMessage: null,
      errorMessageConstants: {
        missingApiKey: 'No API key set',
        missingUrl: 'No URL set',
      },
    };
  },

  computed: {
    /* Get API key for access to instance */
    apiKey() {
      return this.parseAsEnvVar(this.options.apiKey);
    },
    /* Get instance URL */
    url() {
      return this.parseAsEnvVar(this.options.url);
    },
    hideStatus() {
      return this.options.hideStatus || false;
    },
    hideResponseTime() {
      return this.options.hideResponseTime || false;
    },
    hideUptime() {
      return this.options.hideUptime || false;
    },
    /* Optional status pill text overrides, keyed by status (e.g. `down: Error`) */
    statusLabels() {
      return this.options.statusLabels || {};
    },
    /* Create authorisation header for the instance from the apiKey */
    authHeaders() {
      if (!this.apiKey) {
        return {};
      }
      const encoded = window.btoa(`:${this.apiKey}`);
      return { Authorization: `Basic ${encoded}` };
    },
  },
  methods: {
    getStatusText(status) {
      const { text, class: key } = STATUSES[status] || UNKNOWN;
      return this.statusLabels[key] || text;
    },
    getStatusClass(status) {
      return (STATUSES[status] || UNKNOWN).class;
    },
    update() {
      this.startLoading();
      this.fetchData();
    },
    /* Make the data request to the computed API endpoint */
    fetchData() {
      const { authHeaders, url, apiKey } = this;

      if (!this.optionsValid({ url, apiKey })) {
        return;
      }

      this.makeRequest(url, authHeaders)
        .then(this.processData)
        .catch((error) => {
          this.errorMessage = error.message || 'Failed to fetch data';
        });
    },
    /* Add ms unit to response time if it valid (-1 means no ping) */
    summariseWindows(label, values, format) {
      const parts = WINDOWS
        .filter(([key]) => Number.isFinite(values?.[key]))
        .map(([key, name]) => `${format(values[key])} (${name})`);
      return parts.length ? `${label}: ${parts.join(', ')}` : null;
    },
    monitorTooltip(monitor) {
      return this.tooltip([
        this.summariseWindows('Uptime', monitor.uptimes, formatPercent),
        this.summariseWindows('Avg response', monitor.avgResponse, (v) => `${Math.round(v * 1000)}ms`),
      ].filter(Boolean).join('<br>'), true);
    },
    formatResponseTime(responseTime) {
      const ms = Number(responseTime);
      return Number.isFinite(ms) && ms >= 0 ? `${ms}ms` : '-';
    },
    /* Convert API response data into a format to be consumed by the UI */
    processData(response) {
      const monitorRows = this.getMonitorRows(response);

      const monitors = new Map();

      for (let index = 0; index < monitorRows.length; index += 1) {
        const row = monitorRows[index];
        this.processRow(row, monitors);
      }

      this.errorMessage = null;
      this.monitors = Array.from(monitors.values());
    },
    getMonitorRows(response) {
      if (typeof response !== 'string') return [];
      return response.split('\n').filter(row => row.startsWith('monitor_'));
    },
    processRow(row, monitors) {
      const dataType = this.getRowDataType(row);
      const monitorName = this.getRowMonitorName(row);

      if (!monitorName) return;

      if (!monitors.has(monitorName)) {
        monitors.set(monitorName, { name: monitorName });
      }

      const monitor = monitors.get(monitorName);
      const value = this.getRowValue(row);

      const updated = this.setMonitorValue(dataType, monitor, value, this.getRowWindow(row));

      monitors.set(monitorName, updated);
    },
    setMonitorValue(key, monitor, value, timeWindow) {
      const copy = { ...monitor };
      switch (key) {
        case 'monitor_uptime_ratio': {
          copy.uptimes = { ...copy.uptimes, [timeWindow]: Number(value) };
          if (timeWindow === '1d') copy.uptime = formatPercent(Number(value));
          break;
        }
        case 'monitor_response_time_seconds': {
          copy.avgResponse = { ...copy.avgResponse, [timeWindow]: Number(value) };
          break;
        }
        case 'monitor_cert_days_remaining': {
          copy.certDaysRemaining = value;
          break;
        }
        case 'monitor_cert_is_valid': {
          copy.certValid = value;
          break;
        }
        case 'monitor_response_time': {
          copy.responseTime = value;
          break;
        }
        case 'monitor_status': {
          copy.status = Number(value);
          break;
        }
        default:
          break;
      }

      return copy;
    },
    getRowValue(row) {
      return this.getValueWithRegex(row, /\s(\S+)\s*$/);
    },
    getRowMonitorName(row) {
      return this.getValueWithRegex(row, /monitor_name="([^"]+)"/);
    },
    getRowWindow(row) {
      return this.getValueWithRegex(row, /window="([^"]+)"/);
    },
    getRowDataType(row) {
      return this.getValueWithRegex(row, /^(.*?)\{/);
    },
    getValueWithRegex(string, regex) {
      const result = string.match(regex);

      const isArray = Array.isArray(result);

      if (!isArray) {
        return result;
      }

      return result.length > 1 ? result[1] : result[0];
    },
    optionsValid({ url, apiKey }) {
      const errors = [];
      if (!url) {
        errors.push(this.errorMessageConstants.missingUrl);
      }

      if (!apiKey) {
        errors.push(this.errorMessageConstants.missingApiKey);
      }

      if (errors.length === 0) { return true; }

      this.errorMessage = errors.join('\n');
      return false;
    },
  },
};
</script>

<style scoped lang="scss">
.status-pill {
  border-radius: 50em;
  box-sizing: border-box;
  font-size: 0.75em;
  display: inline-block;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
  vertical-align: baseline;
  padding: 0.35em 0.65em;
  margin: 0.1em 0.5em;
  min-width: 64px;

  &.up {
    background-color: var(--success);
    color: var(--black);
  }
  &.down {
    background-color: var(--danger);
    color: var(--white);
  }
  &.pending {
    background-color: var(--warning);
    color: var(--black);
  }
  &.maintenance {
    background-color: var(--info);
    color: var(--black);
  }
  &.unknown {
    background-color: var(--neutral);
    color: var(--white);
  }
}

div.item.monitor-row:hover {
  background-color: var(--item-background);
  color: var(--current-color);
  opacity: 1;

  div.title-title>span.text {
    color: var(--current-color);
  }
}

.monitors-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  width: 50%;
}

.monitor-row {
  display: flex;
  justify-content: space-between;
  padding: 0.35em 0.5em;
  align-items: center;
}

.title-title {
  font-weight: bold;
}
</style>
