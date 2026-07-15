<template>
<div class="gh-stats">
  <!-- User profile card, with avatar and headline stats -->
  <a v-if="profile" class="profile-card" :href="profile.link" target="_blank">
    <img class="avatar" :src="profile.avatar" :alt="profile.login" />
    <div class="profile-info">
      <p class="name">{{ profile.name }}</p>
      <p class="login">@{{ profile.login }}</p>
      <p v-if="profile.bio" class="bio">{{ profile.bio }}</p>
    </div>
    <div class="headline-stats">
      <div v-for="stat in profile.stats" :key="stat.label" class="stat">
        <span class="num">{{ stat.value }}</span>
        <span class="label">{{ stat.label }}</span>
      </div>
    </div>
  </a>
  <!-- One card per listed repository -->
  <a v-for="repo in repoCards" :key="repo.name" class="repo-card" :href="repo.link" target="_blank">
    <p class="repo-name">{{ repo.name }}</p>
    <p v-if="repo.description" class="repo-desc">{{ repo.description }}</p>
    <div class="repo-stats">
      <span v-if="repo.language" class="lang">
        <i class="dot" :style="{ background: repo.langColor }"></i>{{ repo.language }}
      </span>
      <span v-for="stat in repo.stats" :key="stat.label" class="stat" :title="stat.label">
        <svg class="icon" viewBox="0 0 16 16"><path fill-rule="evenodd" :d="stat.icon" /></svg>
        {{ stat.value }}
      </span>
    </div>
  </a>
</div>
</template>

<script>
import WidgetMixin from '@/mixins/WidgetMixin';
import { widgetApiEndpoints } from '@/utils/config/defaults';
import { formatNumber, truncateStr } from '@/utils/MiscHelpers';

// The star, fork and issue icons
const icons = {
  star: 'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97'
    + '.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194'
    + 'L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z',
  fork: 'M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v'
    + '.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 '
    + '3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a'
    + '.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z',
  issue: 'M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 '
    + '6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z',
};

// Most common language colors, saves us needing to make second request
const langColors = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  Go: '#00ADD8', Rust: '#dea584', C: '#555555', 'C++': '#f34b7d', 'C#': '#7355dd',
  Ruby: '#701516', PHP: '#4F5D95', Shell: '#89e051', HTML: '#e34c26', CSS: '#663399',
  SCSS: '#c6538c', Vue: '#41b883', Svelte: '#ff3e00', Astro: '#ff5a03', Swift: '#F05138',
  Kotlin: '#A97BFF', Dart: '#00B4AB', 'Objective-C': '#438eff', Scala: '#c22d40',
  Elixir: '#6e4a7e', Haskell: '#5e5086', Clojure: '#db5855', Lua: '#000080', Perl: '#0298c3',
  R: '#198CE7', Julia: '#a270ba', Zig: '#ec915c', Nix: '#7e7eff', Solidity: '#AA6746',
  Dockerfile: '#384d54', 'Jupyter Notebook': '#DA5B0B', PowerShell: '#012456',
  MDX: '#fcb32c', HCL: '#844FBA',
};

export default {
  mixins: [WidgetMixin],
  data() {
    return {
      profile: null,
      repoCards: null,
    };
  },
  computed: {
    username() {
      return this.options.username;
    },
    repos() {
      const usersChoice = this.options.repos;
      if (!usersChoice) return [];
      const list = Array.isArray(usersChoice) ? usersChoice : [usersChoice];
      return list.filter((repo) => typeof repo === 'string' && repo.includes('/'));
    },
    token() {
      return this.options.token ? this.parseAsEnvVar(this.options.token) : null;
    },
    authHeaders() {
      return this.token ? { Authorization: `Bearer ${this.token}` } : null;
    },
  },
  methods: {
    /* Validate options, then dispatch a request for the profile and each repo */
    fetchData() {
      if (!this.username && !this.repos.length) {
        this.error('Nothing to display, set a username or add repos');
        this.finishLoading();
        return;
      }
      if (this.username) this.fetchProfile();
      if (this.repos.length) this.fetchRepos();
    },
    /* Fetch the users profile for the top card */
    fetchProfile() {
      const endpoint = `${widgetApiEndpoints.githubApi}/users/${this.username}`;
      const notFound = `GitHub user '${this.username}' not found`;
      this.makeRequest(endpoint, this.authHeaders)
        .then((data) => { this.profile = this.formatProfile(data); })
        .catch((err) => this.handleApiError(err, notFound));
    },
    /* Fetch each listed repo, keeping the users original order */
    fetchRepos() {
      const jobs = this.repos.map((repo) => {
        const endpoint = `${widgetApiEndpoints.githubApi}/repos/${repo}`;
        const notFound = `Repository '${repo}' not found`;
        return this.makeRequest(endpoint, this.authHeaders)
          .then(this.formatRepo)
          .catch((err) => { this.handleApiError(err, notFound); return null; });
      });
      Promise.all(jobs).then((cards) => { this.repoCards = cards.filter(Boolean); });
    },
    formatProfile(data) {
      return {
        avatar: data.avatar_url,
        name: data.name || data.login,
        login: data.login,
        bio: data.bio ? truncateStr(data.bio, 100) : null,
        link: data.html_url,
        stats: [
          { label: this.$t('widgets.github-profile.repos'), value: formatNumber(data.public_repos) },
          { label: this.$t('widgets.github-profile.followers'), value: formatNumber(data.followers) },
          { label: this.$t('widgets.github-profile.following'), value: formatNumber(data.following) },
        ],
      };
    },
    formatRepo(data) {
      return {
        name: data.full_name,
        description: data.description ? truncateStr(data.description, 100) : null,
        link: data.html_url,
        language: data.language,
        langColor: langColors[data.language] || 'var(--widget-text-color)',
        stats: [
          { label: this.$t('widgets.github-profile.stars'), icon: icons.star, value: formatNumber(data.stargazers_count) },
          { label: this.$t('widgets.github-profile.forks'), icon: icons.fork, value: formatNumber(data.forks_count) },
          { label: this.$t('widgets.github-profile.issues'), icon: icons.issue, value: formatNumber(data.open_issues_count) },
        ],
      };
    },
    /* Display error message when error happens */
    handleApiError(err, notFoundMsg) {
      const res = err && err.response;
      const status = res?.status || res?.data?.error?.status;
      if (status === 401) {
        this.error('Invalid GitHub token');
      }
      else if (status === 403 || status === 429) {
        this.error('GitHub API rate limit reached, add a token or try again later');
      }
      else if (status === 404) {
        this.error(notFoundMsg);
      }
      else if (status >= 500) {
        this.error('GitHub is currently unavailable, try again later');
      }
    },
  },
};
</script>

<style scoped lang="scss">
.gh-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  a {
    color: var(--widget-text-color);
    text-decoration: none;
  }

  // Top user profile card
  .profile-card {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.25rem 0.75rem;

    .avatar {
      width: 3.5rem;
      height: 3.5rem;
      border-radius: 50%;
    }
    .profile-info {
      p { margin: 0; }
      .name {
        font-size: 1.2rem;
        font-weight: bold;
      }
      .login {
        font-size: 0.9rem;
        opacity: var(--dimming-factor);
      }
      .bio {
        margin-top: 0.2rem;
        font-size: 0.8rem;
      }
    }
    .headline-stats {
      grid-column: 1 / -1;
      display: flex;
      justify-content: space-around;
      margin-top: 0.25rem;
      .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        .num {
          font-size: 1.1rem;
          font-weight: bold;
          font-family: var(--font-monospace);
        }
        .label {
          font-size: 0.7rem;
          text-transform: uppercase;
          opacity: var(--dimming-factor);
        }
      }
    }
  }

  // Per-repo card, separated by a dashed divider
  .repo-card:not(:first-child) {
    padding-top: 0.5rem;
    border-top: 1px dashed var(--widget-text-color);
  }
  .repo-card {
    .repo-name {
      margin: 0;
      font-weight: bold;
    }
    .repo-desc {
      margin: 0.2rem 0;
      font-size: 0.8rem;
      opacity: var(--dimming-factor);
    }
    .repo-stats {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.25rem;
      font-size: 0.85rem;
      .stat {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-family: var(--font-monospace);
        .icon {
          width: 0.9rem;
          height: 0.9rem;
          fill: currentColor;
        }
      }
      .lang {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        .dot {
          width: 0.7rem;
          height: 0.7rem;
          border-radius: 50%;
        }
      }
    }
  }

  // Underline the heading on hover, to signal the card is a link
  .profile-card:hover .name,
  .repo-card:hover .repo-name {
    text-decoration: underline;
  }
}
</style>
