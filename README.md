# Access regression preview

A free, local example for developers testing whether users can read or change another company's records. Start with synthetic invoices or UUID-based support tickets. Deliberately break a policy to see a failed access check.

## Quick try

Install Node.js 24 or later, download this repository, and open a terminal in its folder:

```sh
npm ci --ignore-scripts
npm run demo
npm run demo -- tickets
npm run demo -- invoices --broken
```

The last command intentionally fails with exit code 1: it demonstrates detection of a forbidden insert. The first two should pass. No API key, Supabase account, Docker, or production credentials are needed. First installation downloads the pinned PGlite package from npm; the demos then run in disposable in-memory databases with no telemetry.

## Run the benchmark

```sh
npm run test:all
npm run report
```

Open `reports/index.html` locally. The recorded core results cover 67 selected cases, including healthy configurations, deliberately broken policies, setup problems, and unsupported mappings. Expected failures are successful bug detection in the benchmark, not healthy configurations. Three additional upstream SELECT-probe experiments are in `reports/baseline.json` and have different scope.

The examples test allowed and forbidden CRUD, record/list visibility, membership deletion, and demotion. Write checks inspect stored effects, not just error codes. The mapped examples use JSON files in `fixtures/`; the demo accepts only those two bundled fixture names. To explore another schema, edit a local copy of the fixtures and run tests. There is no general customer-project installer yet.

## Scope and limits

This is an early research sample, not a complete security scanner or a paid service. It tests synthetic database-level policies in PGlite. It does not validate signed JWTs, HTTP endpoints, a full Supabase deployment, Storage, Realtime, or production database parity. Passing checks do not establish that an app is secure. The cases were designed by us and are not a representative accuracy benchmark.

Removal here means deleting membership, with immediate revocation. Demotion leaves read access and removes owner writes. Other applications may need different expectations. Ticket membership deactivation is not separately tested.

## Free-tool comparison

The vendored SupaShield core SELECT probe is pinned to commit `ab01656ba6e6664f6aca2879b3eec8270601b48d` of https://github.com/Rodrigotari1/supashield and retains its MIT license. A PGlite adapter executes three SELECT experiments; Node strips TypeScript and adjusts one import path without changing the probe algorithm. The fixture uses a serial ID to support upstream seeding.

A generic table-level ALLOW and an exact tenant-row assertion ask different questions. Our experiment illustrates that distinction; it is not a full CLI comparison or evidence of overall superiority. Developers can write equivalent expectations in SQL/pgTAP. We have not measured setup-time savings.

## Want help adapting the tests?

We are evaluating a **$149 one-time custom setup pilot** for one synthetic permission model. [See the pilot page and request a free fit check](https://access-regression.mrbuzi.chatgpt.site). The [full proposed scope](PILOT.md) is also available here. This is an interest check; no orders or payments are accepted yet.

## Feedback

We are evaluating this with agency developers maintaining several Supabase applications. Useful feedback: what you use today, where these fixture mappings fail to fit, and how long setup takes. Use a GitHub issue with synthetic examples only. Do not post credentials, production data, customer names, or private schema details.

No payments or customer connections are collected by this sample. A future agency workflow is still being evaluated; no revenue or adoption claims are made.
