# Custom access-test pilot — interest check

Want repeatable checks for a permission model like the examples in this repository?

We are evaluating a **$149 USD one-time setup pilot** for developers who want help adapting the sample to one tenant-owned table. This is a proposed price, not checkout or an accepted order. The free MIT sample stays free.

## Proposed deliverable

- One synthetic fixture representing two tenants, their memberships, and one owned table.
- Explicit expected outcomes for legitimate and forbidden reads, inserts, updates, and deletes.
- Membership removal and role demotion checks if those behaviors fit your model.
- A runnable local test package, a results report, and instructions to rerun it.
- One revision against the scope agreed before work begins.

The initial package runs in PGlite. It is not a production Supabase assessment, security audit, certification, or guarantee. Production PostgreSQL parity, API/JWT behavior, Storage, Realtime, custom extensions, and broader schema coverage are excluded. If you need those, this pilot is not yet a fit.

## Request a fit check

[Open a pilot-interest issue](https://github.com/elfman1/access-regression-preview/issues/new?template=pilot-interest.md).

Describe your workflow and expected permissions using invented names only. All issues here are **public**. Do not include real customer identifiers, private schema or code, credentials, connection strings, or production records. No email address is required.

A fit check is free and nonbinding. Do not send payment. Before any paid work, the project owner must confirm deliverables, acceptance criteria, timing, payment arrangements, and applicable terms with you. No delivery time or availability is promised by submitting an issue.

## What would make this useful?

We are testing whether custom setup saves developers enough work to justify the price. SQL and pgTAP remain valid free alternatives. There are no paying-customer claims or measured time-savings claims.
