import ConfigAccumulator from '@/utils/config/ConfigAccumalator';
import { localStorageKeys } from '@/utils/config/defaults';
import ErrorHandler from '@/utils/logging/ErrorHandler';
import { statusMsg, statusErrorMsg } from '@/utils/logging/CoolConsole';

// Session storage config for storing last sign-in attempt
const SIGNIN_GUARD_KEY = 'dashy.oidc.signin-attempt';
const SIGNIN_GUARD_THRESHOLD_MS = 5 * 1000;

const getAppConfig = () => {
  const Accumulator = new ConfigAccumulator();
  const config = Accumulator.config();
  return config.appConfig || {};
};

const isOidcGuestAccessEnabled = () => {
  const { auth } = getAppConfig();
  return auth && auth.enableGuestAccess;
};

class OidcAuth {
  constructor(UserManager, WebStorageStateStore) {
    const { auth } = getAppConfig();
    const {
      clientId,
      endpoint,
      scope,
      adminGroup,
      adminRole,
    } = auth.oidc;
    if (typeof clientId === 'number' && !Number.isSafeInteger(clientId)) {
      ErrorHandler(
        'Your OIDC appears invalid. ',
        'You passed it as a number, and it is too long to be parsed without loosing precision. '
        + 'Wrap it in quotes in your conf.yml (e.g. clientId: "12345") to force it be a string.',
      );
    }
    const settings = {
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      authority: endpoint,
      client_id: String(clientId),
      redirect_uri: `${window.location.origin}`,
      response_type: 'code',
      scope: scope || 'openid profile email roles groups',
      response_mode: 'query',
      filterProtocolClaims: true,
      loadUserInfo: true,
    };

    this.adminGroup = adminGroup;
    this.adminRole = adminRole;
    this.userManager = new UserManager(settings);

    // Surface OIDC errors that fire outside the init promise chain
    this.userManager.events.addSilentRenewError((err) => {
      ErrorHandler('OIDC silent token renew failed', err);
    });
    this.userManager.events.addUserSignedOut(() => {
      statusMsg('OIDC', 'User signed out at provider');
    });
  }

  async login() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const providerError = url.searchParams.get('error');

    // Provider redirected back with an error
    if (providerError && !code) {
      const desc = url.searchParams.get('error_description') || '';
      throw new Error(`OIDC provider returned ${providerError}: ${desc}`);
    }

    if (code) {
      // Populate localStorage before the reload so the post-reload route guard
      // sees the user as logged-in and lets them through to /, not /login.
      const callbackUser = await this.userManager.signinCallback(window.location.href);
      if (!callbackUser) {
        throw new Error(
          'OIDC signinCallback returned no user. Check userinfo CORS, '
          + 'requested scopes, and that id_token claims include a username.',
        );
      }
      this.persistUserInfo(callbackUser);
      window.location.href = '/';
      return;
    }

    const user = await this.userManager.getUser();
    if (user === null) {
      if (!isOidcGuestAccessEnabled()) {
        // Bail with error, if we've literally just redirected. Prevents loop
        const lastAttempt = Number(sessionStorage.getItem(SIGNIN_GUARD_KEY)) || 0;
        if (Date.now() - lastAttempt < SIGNIN_GUARD_THRESHOLD_MS) {
          sessionStorage.removeItem(SIGNIN_GUARD_KEY);
          throw new Error(
            'OIDC sign-in redirect loop detected. Check provider redirect URIs '
            + 'and that id_token claims include a username.',
          );
        }
        sessionStorage.setItem(SIGNIN_GUARD_KEY, String(Date.now()));
        await this.userManager.signinRedirect();
      }
    } else {
      this.persistUserInfo(user);
    }
  }

  /* Mirror the OIDC user into the localStorage keys other parts of Dashy read */
  persistUserInfo(user) {
    const { roles = [], groups = [] } = user.profile;
    const info = { groups, roles };
    const isAdmin = (Array.isArray(groups) && groups.includes(this.adminGroup))
      || (Array.isArray(roles) && roles.includes(this.adminRole))
      || false;
    // Fall back through username candidates so USERNAME is always a non-empty
    const username = user.profile.preferred_username
      || user.profile.email
      || user.profile.sub
      || 'oidc-user';
    statusMsg(`Authenticated as ${username} ${isAdmin ? '(admin)' : '(non-admin)'}`, JSON.stringify(info));
    localStorage.setItem(localStorageKeys.KEYCLOAK_INFO, JSON.stringify(info));
    localStorage.setItem(localStorageKeys.USERNAME, username);
    localStorage.setItem(localStorageKeys.ISADMIN, isAdmin);
    if (user.id_token) localStorage.setItem(localStorageKeys.ID_TOKEN, user.id_token);
    sessionStorage.removeItem(SIGNIN_GUARD_KEY);
  }

  async logout() {
    localStorage.removeItem(localStorageKeys.USERNAME);
    localStorage.removeItem(localStorageKeys.KEYCLOAK_INFO);
    localStorage.removeItem(localStorageKeys.ISADMIN);
    localStorage.removeItem(localStorageKeys.ID_TOKEN);

    try {
      await this.userManager.signoutRedirect();
    } catch (reason) {
      statusErrorMsg('logout', 'could not log out. Redirecting to OIDC instead', reason);
      window.location.href = this.userManager.settings.authority;
    }
  }
}

export const isOidcEnabled = () => {
  const { auth } = getAppConfig();
  if (!auth) return false;
  return auth.enableOidc || false;
};

let oidc;

export const initOidcAuth = async () => {
  const { UserManager, WebStorageStateStore, Log } = await import('oidc-client-ts');
  if (import.meta.env.DEV) {
    Log.setLogger(console);
    Log.setLevel(Log.INFO);
  }
  oidc = new OidcAuth(UserManager, WebStorageStateStore);
  return oidc.login();
};

export const getOidcAuth = () => {
  if (!oidc) {
    ErrorHandler("OIDC not initialized, can't get instance of class");
  }
  return oidc;
};
