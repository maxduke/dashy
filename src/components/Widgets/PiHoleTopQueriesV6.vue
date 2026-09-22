<template>
<div class="pi-hole-queries-wrapper" v-if="results">
  <div v-for="section in results" :key="section.id" class="query-section">
    <p class="section-title">{{ section.title }}</p>
    <div v-for="(query, i) in section.results" :key="i" class="query-row">
      <p class="domain">{{ query.domain }}</p>
      <p class="count">{{ query.count }}</p>
    </div>
  </div>
</div>
</template>

<script>
import WidgetMixin from '@/mixins/WidgetMixin';
import PiHoleV6Mixin from '@/mixins/PiHoleV6Mixin';
import { showNumAsThousand } from '@/utils/MiscHelpers';

export default {
  mixins: [WidgetMixin, PiHoleV6Mixin],
  components: {},
  data() {
    return {
      results: null,
    };
  },
  computed: {
    count() {
      const usersChoice = this.options.count;
      if (usersChoice && typeof usersChoice === 'number') return usersChoice;
      return 10;
    },
    /* This is actually just the stats that are shown on the Pi-Hole dashboard, which amounts to
    24hrs when the service first boots up, but will drift to be a little more than 24hrs worth of
    data as the server runs. If you need accurate stats to a particular timeframe, then the
    /api/stats/database/top_domains endpoint is the way to go. However, that endpoint does not
    return sorted results, so you would have to get everything and sort it yourself, which presents
    logistical problems. */
    topDomainsEndpoint() {
      return `${this.hostname}/api/stats/top_domains`;
    },
  },
  methods: {
    fetchData() {
      this.withSession(() => Promise.all([
        this.fetchTopAllowedDomains(),
        this.fetchTopBlockedDomains(),
      ]).then(this.processData));
    },
    fetchTopAllowedDomains() {
      const url = new URL(this.topDomainsEndpoint);
      url.searchParams.append('blocked', false);
      url.searchParams.append('count', this.count);
      return this.makeRequest(url.toString(), this.authHeader);
    },
    fetchTopBlockedDomains() {
      const url = new URL(this.topDomainsEndpoint);
      url.searchParams.append('blocked', true);
      url.searchParams.append('count', this.count);
      return this.makeRequest(url.toString(), this.authHeader);
    },
    processData([topAllowedDomains, topBlockedDomains]) {
      const topAds = [];
      topBlockedDomains.domains.forEach(({ domain, count }) => {
        topAds.push({ domain, count: showNumAsThousand(count) });
      });
      const topQueries = [];
      topAllowedDomains.domains.forEach(({ domain, count }) => {
        topQueries.push({ domain, count: showNumAsThousand(count) });
      });
      this.results = [
        { id: '01', title: 'Top Ads Blocked', results: topAds },
        { id: '02', title: 'Top Queries', results: topQueries },
      ];
    },
  },
};
</script>

<style scoped lang="scss">
.pi-hole-queries-wrapper {
  color: var(--widget-text-color);
  .query-section {
    display: inline-block;
    width: 100%;
    p.section-title {
      margin: 0.75rem 0 0.25rem;
      font-size: 1.2rem;
      font-weight: bold;
    }
    .query-row {
      display: flex;
      justify-content: space-between;
      margin: 0.25rem;
      p.domain {
        margin: 0.25rem 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      p.count {
        margin: 0.25rem 0;
        font-family: var(--font-monospace);
      }
      &:not(:last-child) {
        border-bottom: 1px dashed var(--widget-text-color);
      }
    }
  }
}
</style>
