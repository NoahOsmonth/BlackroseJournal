# AI Control Plane Operations

This runbook covers the portable Blackrose deployment: Supabase is the Auth,
catalog, preference, audit, and Realtime authority; the gateway owns managed
provider credentials and Hindsight bank selection; the app uses device-direct
traffic only when a user explicitly enables BYOK.

Never put a Supabase secret/service-role key, provider credential, credential
master key, or Hindsight bank HMAC key in an `EXPO_PUBLIC_*` variable, browser
bundle, database export, log, or support artifact.

## Local Supabase development

Prerequisites are Docker and the Supabase CLI. Check the installed interface
before using it: `supabase --version`, `supabase --help`, and
`supabase db --help`. From the repository root:

```bash
supabase start
supabase status
supabase db reset
supabase migration list --local
```

`db reset` is local-development-only. It recreates the local database from the
immutable migration set and seed. Do not use the CLI local stack as a public or
production server; Supabase explicitly distinguishes it from a hardened
self-hosted deployment.

Copy `.env.example` and `backend/.env.example`, use the local API URL/key values
reported by `supabase status`, start Hindsight on loopback, then run the gateway.
Use two real email accounts for isolation checks. Confirm each sees only its own
`user_ai_preferences`, and confirm catalog publish/withdraw changes increment
`ai_catalog_revision` and arrive over Realtime without restarting the app.

## Hosted Supabase deployment

1. Create a fresh project and configure email Auth plus the exact mobile/web
   redirect allowlist. Do not enable anonymous Auth for this account-owned data
   model.
2. Run `supabase link --project-ref PROJECT_REF`, inspect
   `supabase db push --help`, then apply the repository's additive migrations
   with `supabase db push` from a reviewed release commit.
3. Verify RLS and grants for the authenticated catalog/preferences surfaces.
   Confirm `ai_catalog_models` and `ai_catalog_revision` are in the
   `supabase_realtime` publication.
4. Give the mobile/admin browser only the project URL and publishable/legacy
   anon key. Give the gateway the REST URL, JWT issuer/audience/JWKS URL, and a
   server-only `SUPABASE_SECRET_KEY`.
5. Insert the first administrator in `control.admins` using its authenticated
   Supabase user id. Authorization data belongs in this server-controlled table,
   never user-editable metadata.
6. Deploy the gateway with HTTPS and an explicit `ALLOWED_ORIGINS` list. Deploy
   the separate admin web app with only public Supabase and gateway URLs/keys.
   Test viewer versus operator roles before adding a real provider credential.

The gateway and admin app must use the same Supabase project as the mobile app.
Managed inference and `/v1/admin/*` require Supabase bearer tokens; admin
mutations additionally require an enabled operator row.

## Production self-hosted deployment

The supported production starting point is Supabase's version-pinned Docker
Compose self-hosting release, not `supabase start`. Place its API gateway behind
a TLS reverse proxy, generate new database/JWT/API/Studio secrets, configure
production SMTP, restrict database/network access, and create independent
encrypted backups. Pin the complete tested Supabase Compose release rather than
mixing arbitrary service image versions.

Run the Blackrose gateway and Hindsight on a private application network.
Expose only Supabase's TLS gateway, the Blackrose gateway, and the admin web
front end. Hindsight binds to loopback/private networking. The Blackrose
gateway may use `HINDSIGHT_BASE_URL=http://127.0.0.1:8888` when colocated, or a
private service DNS name when containers are separated; it must never use a
public mobile-reachable address.

For production Hindsight, follow its upstream external PostgreSQL with pgvector
deployment, keep the database on the private network, and set
`HINDSIGHT_VERSION` to a release tested with the gateway. An unpinned `latest`
image plus the embedded pg0 store is suitable for a development/staging helper,
not the production durability boundary.

Minimum operating checks:

- Supabase, database, Realtime, gateway `/health`, and Hindsight `/health` are
  monitored independently.
- Database and Hindsight volume backups are encrypted and restore-tested.
- Gateway logs redact bearer tokens, provider bodies, ciphertext, user ids, and
  derived Hindsight bank names.
- Provider egress is allowlisted by the gateway SSRF policy; Hindsight has no
  public ingress.
- Release deployment records the app, admin, gateway, Supabase Compose, and
  Hindsight image versions together.

Official references: [Supabase self-hosting](https://supabase.com/docs/guides/self-hosting),
[Docker deployment](https://supabase.com/docs/guides/self-hosting/docker), and
[HTTPS reverse proxy](https://supabase.com/docs/guides/self-hosting/self-hosted-proxy-https).

## Rollback

Before every release, take a database backup, a Hindsight volume snapshot, and
an encrypted secret-manager backup of both key families. Prefer rolling back
stateless app/admin/gateway artifacts while leaving additive database migrations
in place. A gateway rollback must still receive every credential key version
referenced by the database.

For an operational model mistake, archive/withdraw the route through the admin
API and verify the catalog revision rather than editing database rows. For a
bad Supabase schema release, stop writes and restore the pre-release backup into
a newly provisioned target, verify it, then switch endpoints. Never edit an
applied migration or invent reverse DDL during an incident.

If Hindsight alone fails, keep chat and journal completion available: memory is
soft-fail. Restore its private volume or rebuild each authenticated account from
that account's local journal/check-in history. Never copy or revive the old
shared `rosebud` bank.

## Export and import into a clean target

The scripts implement Supabase's logical backup order (roles, schema, data) and
do not copy secrets. The export contains application data and encrypted provider
credential ciphertext, so protect it as sensitive. The bundle never contains the key ring;
back up the credential master-key ring and Hindsight bank key separately in a
secret manager.

```bash
SOURCE_DB_URL='postgresql://...' \
  scripts/control-plane/export-supabase.sh /secure/new-bundle

TARGET_DB_URL='postgresql://...' \
  scripts/control-plane/import-supabase.sh /secure/new-bundle

TARGET_DB_URL='postgresql://...' \
  scripts/control-plane/import-supabase.sh /secure/new-bundle --execute
```

The importer is dry-run by default, verifies checksums when present, refuses a
target that already contains Blackrose control-plane objects, and performs the
restore in one transaction with `ON_ERROR_STOP`. URLs must be percent-encoded.
Use a newly provisioned target: the script will not merge or overwrite an
existing Blackrose deployment.

After import, install the separately backed-up server secrets, verify RLS/grants
and the Realtime publication, sign in as viewer and operator, decrypt/health-test
every provider, and test two-user Hindsight isolation before changing DNS or app
configuration. Storage object bodies are a separate migration if the app begins
using Supabase Storage. See Supabase's
[CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Credential master-key rotation and recovery

Credential encryption keys are external deployment secrets. Generate a new
32-byte base64 key, increment `AI_CREDENTIAL_MASTER_KEY_VERSION`, set the new
key in `AI_CREDENTIAL_MASTER_KEY_BASE64`, and set
`AI_CREDENTIAL_MASTER_KEY_RING_JSON` to a JSON map containing both old and new
versions. Deploy this ring before writing any credential with the new version.

For each active provider, call its authenticated credential-rekey admin action
using the current provider revision. Re-list and health-check providers, verify
the audit events, and query the credential rows server-side to prove no row
references the old version. Only then remove the old version on a later deploy,
after updating encrypted backups. Rekey is not provider-key rotation; replace a
provider API key through the credential rotation action when that upstream key
is compromised.

If the current deployment secret is lost, restore the exact key/version from
the secret-manager backup. Database ciphertext alone is unrecoverable. If no
backup exists, replace every upstream provider credential; do not attempt to
infer or reset the AES key. During recovery, keep the affected managed routes
withdrawn so requests fail closed instead of silently choosing another model.

The Hindsight bank HMAC key is a separate identity boundary. Preserve its key
and version for disaster recovery. Changing it creates different derived banks;
only do so with a planned per-account rebuild from owned local data, then retire
the inaccessible old banks under an audited retention policy.

## Hindsight private loopback deployment

`scripts/hindsight/deploy-laptop.sh` is a development/staging helper that binds
both Hindsight ports to loopback and keeps its Docker volume across container
replacement. Supply its LLM/embedding keys only at runtime and run it on the
same host or private network as the Blackrose gateway:

```bash
HINDSIGHT_LLM_API_KEY='...' \
HINDSIGHT_VOYAGE_EMBEDDINGS_API_KEY='...' \
  scripts/hindsight/deploy-laptop.sh

curl --fail http://127.0.0.1:8888/health
```

Set the gateway's `HINDSIGHT_BASE_URL`, optional `HINDSIGHT_API_KEY`, stable
`HINDSIGHT_MEMORY_BANK_HMAC_KEY_BASE64`, and positive bank key version. Mobile
and admin deployments receive none of these. Validate two authenticated users
retain and recall distinct facts, and verify API responses/logs contain neither
Supabase user ids nor derived bank identifiers. For production, use Hindsight's
external-Postgres Compose topology, bind API/UI ports to loopback or omit host
publication entirely, pin `HINDSIGHT_VERSION`, and restore-test its database
backup independently of Supabase.
