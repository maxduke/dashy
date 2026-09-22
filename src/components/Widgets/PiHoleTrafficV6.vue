<template>
<div :id="chartId" class="pi-hole-traffic"></div>
</template>

<script>
import WidgetMixin from '@/mixins/WidgetMixin';
import ChartingMixin from '@/mixins/ChartingMixin';
import PiHoleV6Mixin from '@/mixins/PiHoleV6Mixin';

export default {
  mixins: [WidgetMixin, ChartingMixin, PiHoleV6Mixin],
  components: {},
  computed: {
    historyEndpoint() {
      return `${this.hostname}/api/history`;
    },
  },
  methods: {
    fetchData() {
      this.withSession(() => this.fetchHistory().then((response) => {
        if (this.validate(response)) {
          this.processData(response);
        }
      }));
    },
    fetchHistory() {
      return this.makeRequest(this.historyEndpoint, this.authHeader);
    },
    validate(data) {
      if (!data || !Array.isArray(data.history)) {
        this.error('Got success, but found no results, possible authorization error');
      } else if (data.history.length < 1) {
        this.error('Request completed succesfully, but no data in Pi-Hole yet');
        return false;
      }
      return true;
    },
    processData({ history }) {
      const timeData = [];
      const domainsData = [];
      const adsData = [];
      history.forEach(({ timestamp, total, blocked }) => {
        timeData.push(this.formatTime(timestamp * 1000));
        domainsData.push(total - blocked);
        adsData.push(blocked);
      });
      const chartData = {
        labels: timeData,
        datasets: [
          { name: 'Queries', type: 'bar', values: domainsData },
          { name: 'Ads Blocked', type: 'bar', values: adsData },
        ],
      };
      this.generateChart(chartData);
    },
    generateChart(chartData) {
      return new this.Chart(`#${this.chartId}`, {
        title: 'Recent Queries & Ads',
        data: chartData,
        type: 'axis-mixed',
        height: this.chartHeight,
        colors: ['#20e253', '#f80363'],
        truncateLegends: true,
        lineOptions: {
          regionFill: 1,
          hideDots: 1,
        },
        axisOptions: {
          xIsSeries: true,
          xAxisMode: 'tick',
        },
      });
    },
  },
};
</script>
