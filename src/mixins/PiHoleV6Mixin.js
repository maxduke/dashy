import { localStorageKeys } from '@/utils/config/defaults';

const logins = {};

/* Shared auth and session handling for the Pi-hole v6 widgets */
export default {
  data() {
    return { session: null };
  },
  computed: {
    hostname() {
      const usersChoice = this.parseAsEnvVar(this.options.hostname);
      if (!usersChoice) this.error('You must specify the hostname for your Pi-Hole server');
      return usersChoice;
    },
    apiKey() {
      const usersChoice = this.parseAsEnvVar(this.options.apiKey);
      if (!usersChoice) this.error('App Password is required, please see the docs');
      return usersChoice;
    },
    authEndpoint() {
      return `${this.hostname}/api/auth`;
    },
    authHeader() {
      const { sid, csrf } = this.session || {};
      return { 'X-FTL-SID': sid, 'X-FTL-CSRF': csrf, Accept: 'application/json' };
    },
    sessionKey() {
      return `${localStorageKeys.PI_HOLE_SESSION}-${this.hostname}`;
    },
  },
  methods: {
    /* Runs the widget's fetch under a live session, logging in first if needed */
    withSession(run) {
      return this.ensureSession().then(run).then(
        () => this.saveSession(this.session),
        () => this.clearSession(),
      );
    },
    ensureSession() {
      const stored = this.readSession();
      if (stored && stored.expires > Date.now()) {
        this.session = stored;
        return Promise.resolve();
      }
      return this.login();
    },
    /* Widgets for the same host share a single in-flight login */
    login() {
      const key = this.sessionKey;
      if (!logins[key]) {
        const headers = { 'Content-Type': 'application/json' };
        logins[key] = this.makeRequest(this.authEndpoint, headers, 'POST', { password: this.apiKey })
          .then(({ session }) => {
            if (!session?.valid) {
              this.error('Authentication failed: Invalid credentials or 2FA token required');
              throw new Error('Pi-hole login failed');
            }
            const { sid, csrf, validity } = session;
            return this.saveSession({ sid, csrf, validity: validity * 1000 });
          })
          .finally(() => { delete logins[key]; });
      }
      return logins[key].then((session) => { this.session = session; });
    },
    readSession() {
      try { return JSON.parse(localStorage.getItem(this.sessionKey)); } catch { return null; }
    },
    saveSession(session) {
      this.session = { ...session, expires: Date.now() + session.validity };
      localStorage.setItem(this.sessionKey, JSON.stringify(this.session));
      return this.session;
    },
    clearSession() {
      this.session = null;
      localStorage.removeItem(this.sessionKey);
    },
  },
};
