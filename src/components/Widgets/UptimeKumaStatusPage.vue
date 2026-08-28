<template>
  <div @click="openStatusPage" class="clickable-widget">
    <template v-if="errorMessage">
      <div class="error-message">
        <span class="text">{{ errorMessage }}</span>
      </div>
    </template>
    <template v-else-if="lastHeartbeats">
      <div
        v-for="heartbeat in lastHeartbeats"
        :key="heartbeat.id"
        class="item-wrapper"
      >
        <div class="item monitor-row" v-tooltip="monitorTooltip(heartbeat)">
          <div class="title-title">
            <span class="text">{{ heartbeat.name }}</span>
          </div>
          <div class="monitors-container">
            <div v-if="!hideHistory" class="heartbeat-strip">
              <span
                v-for="(beat, index) in heartbeat.history"
                :key="index"
                class="beat"
                :class="getStatusClass(beat.status)"
              ></span>
            </div>
            <span v-if="!hideUptime && heartbeat.uptime" class="uptime">{{ heartbeat.uptime }}</span>
            <span v-if="!hideStatus" class="status-pill" :class="getStatusClass(heartbeat.status)">
              {{ getStatusText(heartbeat.status) }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import WidgetMixin from '@/mixins/WidgetMixin';
import { getTimeAgo } from '@/utils/MiscHelpers';

const STATUSES = {
  0: { text: 'Down', class: 'down' },
  1: { text: 'Up', class: 'up' },
  2: { text: 'Pending', class: 'pending' },
  3: { text: 'Maintenance', class: 'maintenance' },
};
const UNKNOWN = { text: 'Unknown', class: 'unknown' };
const HISTORY_BEATS = 30;

export default {
  mixins: [WidgetMixin],
  data() {
    return {
      lastHeartbeats: null,
      errorMessage: null,
      errorMessageConstants: {
        missingHost: 'No host set',
        missingSlug: 'No slug set',
      },
    };
  },
  computed: {
    host() {
      return this.parseAsEnvVar(this.options.host);
    },
    slug() {
      return this.parseAsEnvVar(this.options.slug);
    },
    monitorNames() {
      return Array.isArray(this.options.monitorNames) ? this.options.monitorNames : [];
    },
    hideHistory() {
      return this.options.hideHistory || false;
    },
    hideUptime() {
      return this.options.hideUptime || false;
    },
    hideStatus() {
      return this.options.hideStatus || false;
    },
    endpoint() {
      return `${this.host}/api/status-page/heartbeat/${this.slug}`;
    },
    configEndpoint() {
      return `${this.host}/api/status-page/${this.slug}`;
    },
    statusPageUrl() {
      return `${this.host}/status/${this.slug}`;
    },
  },
  methods: {
    getStatusText(status) {
      return (STATUSES[status] || UNKNOWN).text;
    },
    getStatusClass(status) {
      return (STATUSES[status] || UNKNOWN).class;
    },
    update() {
      this.startLoading();
      this.fetchData();
    },
    fetchData() {
      const { host, slug } = this;
      if (!this.optionsValid({ host, slug })) {
        return;
      }
      Promise.all([
        this.makeRequest(this.endpoint), // Get uptime data
        this.makeRequest(this.configEndpoint).catch(() => null), // attempt get monitor names
      ])
        .then(([heartbeats, statusPage]) => this.processData(heartbeats, statusPage))
        .catch((error) => {
          this.errorMessage = error.message || 'Failed to fetch data';
        });
    },
    processData(response, statusPage) {
      const { heartbeatList, uptimeList } = response;
      this.errorMessage = null;
      this.lastHeartbeats = this.getOrderedMonitors(statusPage, heartbeatList)
        .map((monitor, index) => {
          const heartbeats = heartbeatList[monitor.id];
          const uptime = uptimeList?.[`${monitor.id}_24`];
          return {
            ...heartbeats[heartbeats.length - 1],
            id: monitor.id,
            name: this.monitorNames[index] || monitor.name || `Monitor ${index + 1}`,
            uptime: typeof uptime === 'number' ? `${(uptime * 100).toFixed(2)}%` : null,
            history: heartbeats.slice(-HISTORY_BEATS),
          };
        });
    },
    monitorTooltip(heartbeat) {
      const failed = heartbeat.history.filter((beat) => beat.status === 0).length;
      return this.tooltip([
        Number.isFinite(heartbeat.ping) ? `Response: ${heartbeat.ping}ms` : null,
        /* Kuma sends UTC, without a zone marker */
        heartbeat.time ? `Last check: ${getTimeAgo(`${heartbeat.time.replace(' ', 'T')}Z`)}` : null,
        failed ? `${failed} of ${heartbeat.history.length} recent checks failed` : null,
        heartbeat.msg,
      ].filter(Boolean).join('<br>'), true);
    },
    getOrderedMonitors(statusPage, heartbeatList) {
      const groups = statusPage?.publicGroupList;
      const monitors = groups
        ? groups.flatMap((group) => group.monitorList)
        : Object.keys(heartbeatList).map((id) => ({ id }));
      return monitors.filter((monitor) => heartbeatList[monitor.id]?.length > 0);
    },
    optionsValid({ host, slug }) {
      const errors = [];
      if (!host) errors.push(this.errorMessageConstants.missingHost);
      if (!slug) errors.push(this.errorMessageConstants.missingSlug);
      if (errors.length > 0) {
        this.errorMessage = errors.join('\n');
        return false;
      }
      return true;
    },
    openStatusPage() {
      window.open(this.statusPageUrl, '_blank');
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

.clickable-widget {
  cursor: pointer;
  container-type: inline-size;
}
.monitors-container {
  display: flex;
  align-items: center;
  gap: 0.5em;
}
.uptime {
  font-size: 0.8em;
  opacity: 0.8;
}
.heartbeat-strip {
  display: none;
  gap: 1px;

  .beat {
    width: 3px;
    height: 1.1em;
    border-radius: 1px;
    background-color: var(--neutral);

    &.up { background-color: var(--success); }
    &.down { background-color: var(--danger); }
    &.pending { background-color: var(--warning); }
    &.maintenance { background-color: var(--info); }
  }
}
/* Only room for the strip once the widget's own column is wide enough */
@container (min-width: 320px) {
  .heartbeat-strip { display: flex; }
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
.error-message {
  color: var(--danger);
  font-weight: bold;
}
</style>
