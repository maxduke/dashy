<template>
  <div class="live-tennis">
    <!-- Nothing on court right now -->
    <p class="no-matches" v-if="matches && !matches.length">
      No {{ status }} matches
    </p>
    <!-- One block per match -->
    <div class="match" v-for="match in matches" :key="match.id">
      <!-- Tournament, round and match state -->
      <div class="match-meta">
        <span class="tournament" v-if="!hideTournament">{{ match.tournament }}</span>
        <span class="round" v-if="match.round">{{ match.round }}</span>
        <span :class="`status status-${match.status}`">{{ match.statusLabel }}</span>
      </div>
      <!-- A row per player, with their set scores and current game points -->
      <div
        :class="['player', { serving: player.isServing, winner: player.isWinner }]"
        v-for="player in match.players"
        :key="player.id"
      >
        <span class="serve-indicator" aria-hidden="true">{{ player.isServing ? '●' : '' }}</span>
        <span class="name">
          {{ player.name }}
          <span class="ranking" v-if="player.ranking && !hideRankings">#{{ player.ranking }}</span>
        </span>
        <span class="sets">
          <span
            :class="['set', { current: index === match.currentSet }]"
            v-for="(games, index) in player.games"
            :key="index"
          >{{ games }}</span>
        </span>
        <span :class="['points', { tiebreak: match.isTiebreak }]" v-if="match.isLive">
          {{ player.point }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import WidgetMixin from '@/mixins/WidgetMixin';
import { widgetApiEndpoints } from '@/utils/config/defaults';

/* Human-readable label for each of the API's match states */
const STATUS_LABELS = {
  live: 'Live',
  upcoming: 'Upcoming',
  completed: 'Finished',
};

export default {
  mixins: [WidgetMixin],
  data() {
    return {
      matches: null, // Array of processed matches, null until first response
    };
  },
  computed: {
    /* API key, from livetennisapi.com. Required */
    apiKey() {
      return this.parseAsEnvVar(this.options.apiKey) || '';
    },
    /* Which matches to show: live, upcoming or completed */
    status() {
      const status = this.options.status || 'live';
      return Object.keys(STATUS_LABELS).includes(status) ? status : 'live';
    },
    limit() {
      return parseInt(this.options.limit, 10) || 5;
    },
    hideRankings() {
      return this.options.hideRankings || false;
    },
    hideTournament() {
      return this.options.hideTournament || false;
    },
    endpoint() {
      const url = `${widgetApiEndpoints.liveTennis}/matches`;
      return `${url}?status=${this.status}&limit=${this.limit}`;
    },
    headers() {
      return { Authorization: `Bearer ${this.apiKey}` };
    },
  },
  methods: {
    fetchData() {
      if (!this.apiKey) {
        this.error('An apiKey is required, get one free at livetennisapi.com');
        this.finishLoading();
        return;
      }
      if (this.options.status && this.options.status !== this.status) {
        this.error(`Invalid status '${this.options.status}', showing live matches instead`);
      }
      this.makeRequest(this.endpoint, this.headers)
        .then(this.processData)
        .catch(() => { /* Error already surfaced by the mixin */ });
    },
    processData(data) {
      const results = (data && data.data) || [];
      this.matches = results.map((match) => this.makeMatch(match));
    },
    /* Flatten a single match from the API into everything the template renders */
    makeMatch(match) {
      const score = match.score || {};
      const games = Array.isArray(score.games) ? score.games : [];
      const setCount = Math.max((games[0] || []).length, (games[1] || []).length);
      const isLive = match.status === 'live';
      return {
        id: match.id,
        tournament: match.tournament,
        round: match.round,
        status: match.status,
        statusLabel: STATUS_LABELS[match.status] || match.status,
        isLive,
        isTiebreak: !!score.is_tiebreak,
        // Only a live match has a set in progress to highlight
        currentSet: isLive ? setCount - 1 : -1,
        players: [0, 1].map((index) => this.makePlayer(match, index, setCount)),
      };
    },
    /* Flatten one side of a match. `index` is 0 for p1, 1 for p2 */
    makePlayer(match, index, setCount) {
      const score = match.score || {};
      const player = (match.players || {})[`p${index + 1}`] || {};
      const games = (score.games || [])[index] || [];
      const sets = Array.isArray(score.sets) ? score.sets : [];
      return {
        id: player.id || `p${index + 1}`,
        name: player.name || 'Unknown',
        ranking: player.ranking,
        // The API numbers the server 1 or 2, matching p1 / p2.
        // It keeps the last server on a finished match, so only show it while live
        isServing: match.status === 'live' && score.server === index + 1,
        // Pad short rows so both players' set columns stay aligned
        games: Array.from({ length: setCount }, (_, i) => games[i] ?? ''),
        point: (score.points || [])[index] ?? '',
        // Only a finished match has a winner to highlight
        isWinner: match.status === 'completed' && sets.length > 0 && sets[index] > sets[1 - index],
      };
    },
  },
  created() {
    this.overrideUpdateInterval = 60;
  },
};
</script>

<style scoped lang="scss">
.live-tennis {
  color: var(--widget-text-color);

  p.no-matches {
    font-size: 1rem;
    margin: 0.5rem auto;
    text-align: center;
    opacity: var(--dimming-factor);
  }

  .match {
    padding: 0.25rem 0;

    &:not(:last-child) {
      border-bottom: 1px dashed var(--widget-text-color);
    }

    // Tournament name, round and match state
    .match-meta {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.7rem;
      opacity: var(--dimming-factor);

      .tournament {
        font-weight: bold;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .round {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .status {
        margin-left: auto;
        padding: 0 0.3rem;
        border-radius: var(--curve-factor);
        background: var(--widget-accent-color);
        white-space: nowrap;

        &.status-live {
          color: var(--success, var(--widget-text-color));
          font-weight: bold;
        }
      }
    }

    // One row per player
    .player {
      display: flex;
      align-items: center;
      font-size: 0.9rem;
      padding: 0.1rem 0;

      .serve-indicator {
        width: 0.7rem;
        flex-shrink: 0;
        font-size: 0.5rem;
        line-height: 1;
      }

      .name {
        flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        .ranking {
          font-size: 0.7rem;
          opacity: var(--dimming-factor);
          margin-left: 0.2rem;
        }
      }

      .sets {
        display: flex;
        flex-shrink: 0;
        font-family: var(--font-monospace);

        .set {
          width: 1.1rem;
          text-align: center;
          opacity: var(--dimming-factor);

          &.current {
            opacity: 1;
            font-weight: bold;
          }
        }
      }

      .points {
        width: 1.6rem;
        flex-shrink: 0;
        text-align: right;
        font-family: var(--font-monospace);
        font-weight: bold;

        &.tiebreak {
          font-style: italic;
        }
      }

      // The player currently serving, and the winner of a finished match
      &.serving .serve-indicator {
        color: var(--success, var(--widget-text-color));
      }

      &.winner .name {
        font-weight: bold;
      }
    }
  }
}
</style>
