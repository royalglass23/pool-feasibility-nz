# PoolReady documentation

Start with the root [`README.md`](../README.md) for the current product,
developer setup, and operating boundaries. Use [`CHANGELOG.md`](../CHANGELOG.md)
to understand how the internal Auckland POC became the current Property Check.

## Current reference

| Need                              | Read                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| Product language and audiences    | [`CONTEXT.md`](../CONTEXT.md)                                |
| Architecture and trust boundaries | [`architecture.md`](architecture.md)                         |
| Environment and package roles     | [`dependencies.md`](dependencies.md)                         |
| Database and migration boundary   | [`database.md`](database.md)                                 |
| Official data and reuse rules     | [`data-sources.md`](data-sources.md)                         |
| Scoring and confidence            | [`scoring.md`](scoring.md)                                   |
| Report structure and rendering    | [`report-format.md`](report-format.md)                       |
| Staff authentication              | [`staff-admin-access.md`](staff-admin-access.md)             |
| Public abuse controls             | [`public-rate-limiting.md`](public-rate-limiting.md)         |
| Privacy operations                | [`privacy-request-handling.md`](privacy-request-handling.md) |
| Analytics and search              | [`analytics-and-search.md`](analytics-and-search.md)         |
| Founding Partner Program          | [`partnership-program.md`](partnership-program.md)           |
| Validation and release evidence   | [`release-readiness.md`](release-readiness.md)               |

## Plans and historical decisions

Files named `*-plan.md`, `*-proposal.md`, the ADRs, and the evidence packs under
`../security/` capture decisions or validation at a particular time. They are
valuable context, but they may describe a candidate older than the current
branch. Check the document date, reviewed commit, verdict, and later changelog
entries before using one as a statement about current behavior.

In particular, the July internal-only/no-database release decision is historical.
The current branch contains persistence and anonymous public routes, but that
does not by itself prove a production migration, configuration, deployment, or
live security gate.
