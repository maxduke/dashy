# Authentication

- [Built-In Auth](#built-in-auth)
- [Keycloak](#keycloak)
- [Header Authentication](#header-authentication)
- [OIDC Auth](#oidc)
  - [Authentik](./authentication/authentik.md)
  - [Authelia](./authentication/authelia-oidc.md)
  - [Zitadel](./authentication/zitadel.md)
  - [Pocket ID](./authentication/pocketid.md)
- [Zero-Trust Tunnels](#zero-trust-tunnels)
  - [Cloudflare Tunnel](./authentication/cloudflare-tunnel.md)
  - [Tailscale / Headscale](./authentication/tailscale.md)
- [Alternative Authentication Methods](#alternative-authentication-methods)
  - [Reverse Proxy Auth](./authentication/other-auth-methods.md#reverse-proxy-auth)
  - [VPN](./authentication/other-auth-methods.md#vpn)
  - [IP-Based Access](./authentication/other-auth-methods.md#ip-based-access)
  - [Web Server Authentication](./authentication/other-auth-methods.md#web-server-authentication)
  - [Client Certificates (mTLS)](./authentication/other-auth-methods.md#client-certificates-mtls)
  - [SSO / OAuth Providers](./authentication/other-auth-methods.md#sso--oauth-providers)
  - [Cloud Hosting Providers](./authentication/other-auth-methods.md#cloud-hosting-providers)


> [!IMPORTANT]
> It is your responsibility to properly secure your Dashy instance.
> Never expose your Dashy instance to the public internet or untrusted users without sufficient authentication and authorization in place.

## Built-In Auth

Dashy includes a built-in username/password login, with optional server-side HTTP Basic Auth. This is the easiest way to get a login page, without needing to spin up any other services. The full guide, covering password hashing, env-var passwords, guest access, user roles, visibility controls and security notes, is in the [Built-In Auth guide](./authentication/built-in.md).

To enable, simply add an array of users under `appConfig.auth.users`, each with a username (`user`) and a SHA256 hash of their password (`hash`).

```yaml
appConfig:
  disableConfigurationForNonAdmin: true
  auth:
    users:
      - user: alicia
        hash: 5994471ABB01112AFCC18159F6CC74B4F511B99806DA59B3CAF5A9C173CACFC5
        type: admin
```

Optionally set this env var to enforce this on the server-side too
```env
ENABLE_HTTP_AUTH=true
```

## Keycloak

Dashy supports [Keycloak](https://www.keycloak.org/) (v17+) as an authentication provider. See the [Keycloak guide](./authentication/keycloak.md) for the full deploy and configuration walkthrough.

```yaml
appConfig:
  disableConfigurationForNonAdmin: true
  auth:
    enableKeycloak: true
    keycloak:
      serverUrl: http://localhost:9100
      realm: dashy
      clientId: dashy
      adminRole: dashy-admin
```

## Header Authentication
Dashy can defer authentication to a reverse proxy that injects the user's identity in a request header. See the [Header Authentication guide](./authentication/header-auth.md).

```yaml
appConfig:
  auth:
    enableHeaderAuth: true
    users:
      - user: alice
        hash: 0a7b1d4c2e...
        type: admin
    headerAuth:
      userHeader: Remote-User
      proxyWhitelist:
        - 172.18.0.2
```

## OIDC

Dashy has full support for OIDC based auth, with scoped permissions. See either the generic [OIDC](./authentication/oidc.md) docs, or our provider-specific guides:
- [Authentik](./authentication/authentik.md)
- [Authelia](./authentication/authelia-oidc.md)
- [Zitadel](./authentication/zitadel.md)
- [Pocket ID](./authentication/pocketid.md)
- [Keycloak](./authentication/keycloak.md)

```yaml
appConfig:
  disableConfigurationForNonAdmin: true # Hide the config editor from non-admins (recommended)
  enableGuestAccess: false              # Optional: view the dashboard read-only without signing in
  enableServiceWorker: true             # Optional: enables the PWA and offline support
  enableAuthProxyCompat: true           # Recover the PWA after a session expires (needs the service worker)
  auth:
    enableOidc: true                    # Turn OIDC on
    oidc:
      clientId: dashy                    # Client ID from your provider
      endpoint: https://auth.example.com/application/o/dashy/ # The issuer URL, not the .well-known one
      scope: openid profile email groups # Scopes to request (groups for adminGroup, roles for adminRole)
      adminGroup: dashy-admins           # Members of this group are admins
      adminRole: dashy-admin             # Or grant admin by role instead
      enableSilentRenew: true            # Refresh the session in the background before it expires
```

## Zero-Trust Tunnels

Dashy works well with third-party tunnel based auth, allowing you to access your dashboard remotely.
- [Cloudflare Tunnel](./authentication/cloudflare-tunnel.md)
- [Tailscale / Headscale](./authentication/tailscale.md)

## Alternative Authentication Methods

These are alternatives to Dashy's built-in auth, Keycloak, and OIDC. Most of them sit in front of Dashy at the network or reverse proxy level, which is generally the better approach for anything internet-facing.

- [Reverse Proxy Auth](./authentication/other-auth-methods.md#reverse-proxy-auth) - Authelia, Authentik, or similar sitting in front of Dashy
- [VPN](./authentication/other-auth-methods.md#vpn) - Keep Dashy off the internet entirely
- [IP-Based Access](./authentication/other-auth-methods.md#ip-based-access) - Restrict by source IP in your web server
- [Web Server Authentication](./authentication/other-auth-methods.md#web-server-authentication) - HTTP basic auth at the proxy level
- [Client Certificates (mTLS)](./authentication/other-auth-methods.md#client-certificates-mtls) - Require a client TLS certificate to connect
- [SSO / OAuth Providers](./authentication/other-auth-methods.md#sso--oauth-providers) - Cloud-hosted identity providers
- [Cloud Hosting Providers](./authentication/other-auth-methods.md#cloud-hosting-providers) - Built-in auth on hosting platforms

## Comparison of Auth Options

| Method | Type | Description | Complexity | Security | Best for |
|---|---|---|---|---|---|
| No Auth | Built-in | This is the default state Dashy ships with | 🟢 Easy | 🔴 Weak | Internal usage |
| [Built-In Auth](./authentication/built-in.md) | Built-in | Username/password list in your config, optionally enforced server-side | 🟢 Easy | 🟠 Medium | A quick login screen on a trusted LAN |
| [Header Auth](./authentication/header-auth.md) | Built-in | Trusts a username header from a proxy that already did the login | 🟠 Medium | 🟠 Medium | Reusing an existing proxy or forward-auth session |
| [OIDC (generic)](./authentication/oidc.md) | OIDC | Any OpenID Connect provider, with server-side token checks and admin roles | 🟠 Medium | 🟢 Strong | Standards-based SSO with any IdP |
| [Authentik](./authentication/authentik.md) | OIDC | Self-hosted IdP with a full admin UI, MFA and group policies | 🟠 Medium | 🟢 Strong | One login across many self-hosted apps |
| [Authelia](./authentication/authelia-oidc.md) | OIDC | Lightweight self-hosted IdP, configured from a single YAML file | 🟠 Medium | 🟢 Strong | Self-hosters who prefer file-based config |
| [Keycloak](./authentication/keycloak.md) | OIDC | Heavyweight enterprise IdP with realms, roles and social login | 🔴 Hard | 🟢 Strong | Larger or enterprise deployments |
| [Pocket ID](./authentication/pocketid.md) | OIDC | Minimal passkey-only IdP, a single Go binary | 🟠 Medium | 🟢 Strong | Passwordless homelab SSO |
| [Zitadel](./authentication/zitadel.md) | OIDC | Go/Postgres IdP with project roles (needs an Action to map groups) | 🔴 Hard | 🟢 Strong | Role-based access across projects |
| [Cloudflare Tunnel](./authentication/cloudflare-tunnel.md) | Tunnel | Outbound tunnel to Cloudflare's edge, paired with Access for login | 🟠 Medium | 🟢 Strong | Public access with no open ports |
| [Tailscale / Headscale](./authentication/tailscale.md) | Tunnel | Private WireGuard mesh, with optional Funnel for public access | 🟢 Easy | 🟢 Strong | Private remote access between your devices |
| [Reverse Proxy Auth](./authentication/other-auth-methods.md#reverse-proxy-auth) | Proxy | An auth server (Authelia, Authentik, OAuth2 Proxy) in front via forward-auth | 🟠 Medium | 🟢 Strong | Protecting many apps behind one proxy |
| [Web Server Auth](./authentication/other-auth-methods.md#web-server-authentication) | Proxy | HTTP basic auth handled by your reverse proxy | 🟢 Easy | 🟠 Medium | A fast password prompt over HTTPS |
| [Client Certificates (mTLS)](./authentication/other-auth-methods.md#client-certificates-mtls) | Proxy | Require a client TLS certificate to connect, enforced at the proxy | 🔴 Hard | 🟢 Strong | A small fixed set of trusted devices |
| [IP-Based Access](./authentication/other-auth-methods.md#ip-based-access) | Network | Allow only certain source IPs at the web server | 🟢 Easy | 🟠 Medium | An extra layer on a static IP or VPN |
| [VPN](./authentication/other-auth-methods.md#vpn) | Network | Keep Dashy off the internet, reach it over WireGuard, Tailscale or OpenVPN | 🟠 Medium | 🟢 Strong | Private access with zero public exposure |
| [SSO / OAuth Providers](./authentication/other-auth-methods.md#sso--oauth-providers) | OIDC | Cloud IdPs (Auth0, Okta, Google) wired in through Dashy's OIDC | 🟠 Medium | 🟢 Strong | Offloading identity to a managed provider |
| [Cloud Hosting Providers](./authentication/other-auth-methods.md#cloud-hosting-providers) | Platform | Platform-level auth (Cloudflare Access, Netlify, Vercel) outside Dashy | 🟢 Easy | 🟢 Strong | Dashboards hosted on a cloud platform |

**[⬆️ Back to Top](#authentication)**
