<template>
<div class="crypto-price-chart" :id="chartId"></div>
</template>

<script>
import { Chart } from 'frappe-charts/dist/frappe-charts.min.esm';
import request from '@/utils/request';
import WidgetMixin from '@/mixins/WidgetMixin';
import ChartingMixin from '@/mixins/ChartingMixin';
import { widgetApiEndpoints } from '@/utils/config/defaults';

export default {
  mixins: [WidgetMixin, ChartingMixin],
  components: {},
  data() {
    return {
      chartData: null,
      chartDom: null,
    };
  },
  computed: {
    /* The stock or share asset symbol to fetch data for */
    stock() {
      return this.options.stock;
    },
    /* The users API key for AlphaVantage */
    apiKey() {
      return this.parseAsEnvVar(this.options.apiKey);
    },
    /* The formatted GET request API endpoint to fetch stock data from */
    endpoint() {
      return `${widgetApiEndpoints.stockPriceChart}?function=TIME_SERIES_DAILY`
      + `&symbol=${this.stock}&apikey=${this.apiKey}`;
    },
    /* The number of data points to render on the chart */
    dataPoints() {
      const userChoice = this.options.dataPoints;
      if (typeof userChoice === 'number' && userChoice < 100 && userChoice > 5) {
        return userChoice;
      }
      return 30;
    },
    /* A sudo-random ID for the chart DOM element */
    chartId() {
      return `stock-price-chart-${Math.round(Math.random() * 10000)}`;
    },
    /* Which price for each interval should be used (API requires in stupid format) */
    priceTime() {
      const usersChoice = this.options.priceTime || 'high';
      switch (usersChoice) {
        case ('open'): return '1. open';
        case ('high'): return '2. high';
        case ('low'): return '3. low';
        case ('close'): return '4. close';
        case ('volume'): return '5. volume';
        default: return '2. high';
      }
    },
  },
  methods: {
    /* Create new chart, using the crypto data */
    generateChart() {
      return new Chart(`#${this.chartId}`, {
        title: `${this.stock} Price Chart`,
        data: this.chartData,
        type: 'axis-mixed',
        height: this.chartHeight,
        colors: this.chartColors,
        truncateLegends: true,
        lineOptions: {
          regionFill: 1,
          hideDots: 1,
        },
        axisOptions: {
          xIsSeries: true,
          xAxisMode: 'tick',
        },
        tooltipOptions: {
          formatTooltipY: d => `$${d}`,
        },
      });
    },
    /* Make GET request to AlphaVantage API endpoint */
    fetchData() {
      request.get(this.endpoint)
        .then((response) => {
          const apiError = response.data['Error Message']
            || response.data.Information || response.data.Note;
          if (apiError) {
            this.error('API Error', apiError);
          } else {
            this.processData(response.data);
          }
        })
        .catch((error) => {
          this.error('Unable to fetch stock price data', error);
        })
        .finally(() => {
          this.finishLoading();
        });
    },
    /* Convert data returned by API into a format that can be consumed by the chart
     * To improve efficiency, only a certain amount of data points are plotted
     */
    processData(data) {
      const rawMarketData = data['Time Series (Daily)'];
      if (!rawMarketData) {
        this.error('Unexpected stock price response format');
        return;
      }
      const priceLabels = [];
      const priceValues = [];
      const numPoints = Object.keys(rawMarketData).length;
      const interval = Math.max(1, Math.round(numPoints / this.dataPoints));
      Object.keys(rawMarketData).forEach((timeGroup, index) => {
        if (index % interval === 0) {
          priceLabels.push(this.formatDate(timeGroup));
          priceValues.push(this.formatPrice(rawMarketData[timeGroup][this.priceTime]));
        }
      });
      // // Combine results with chart config
      this.chartData = {
        labels: priceLabels.reverse(),
        datasets: [
          { name: `Price ${this.priceTime}`, type: 'bar', values: priceValues.reverse() },
        ],
      };
      // // Call chart render function
      this.renderChart();
    },
    /* Uses class data to render the line chart */
    renderChart() {
      this.chartDom = this.generateChart();
    },
    /* Format the date for a given time stamp */
    formatDate(timestamp) {
      const localFormat = navigator.language;
      const dateFormat = { weekday: 'short', day: 'numeric', month: 'short' };
      return new Date(`${timestamp}T00:00:00`).toLocaleDateString(localFormat, dateFormat);
    },
    /* Format the price, rounding to given number of decimal places */
    formatPrice(priceStr) {
      const price = parseFloat(priceStr);
      let numDecimals = 0;
      if (price < 10) numDecimals = 1;
      if (price < 1) numDecimals = 2;
      if (price < 0.1) numDecimals = 3;
      if (price < 0.01) numDecimals = 4;
      if (price < 0.001) numDecimals = 5;
      return price.toFixed(numDecimals);
    },
  },
};
</script>

<style lang="scss">
.crypto-price-chart .chart-container {
  text.title {
    text-transform: capitalize;
    color: var(--widget-text-color);
  }
  .axis, .chart-label {
    fill: var(--widget-text-color);
    opacity: var(--dimming-factor);
    &:hover { opacity: 1; }
  }
}
</style>
