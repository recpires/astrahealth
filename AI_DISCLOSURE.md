# AI Tools & Usage Disclosure

Team ANGARIS used AI-assisted tools, including Claude Code, Codex, and ChatGPT, as applicable, to support software development, code review, documentation, and presentation preparation.

The project’s concept, technical decisions, testing, and final validation are the responsibility of Team ANGARIS.

All physiological data presented in the prototype are simulated. ASTRA Health is an experimental demonstration and is not a clinically validated medical device.

The sections below give more detail on how AI-assisted tools were used in this repository.

## AI-assisted content

| Area | Files | Nature of assistance |
|------|-------|----------------------|
| Application source code | `src/**` | Developed with AI-assisted tools from the team brief |
| Simulated scenario data | `scripts/generate-scenarios.mjs`, `src/data/scenarios/*.json` | Generator developed with AI-assisted tools; the JSON is its seeded output |
| Demonstration procedures | `src/data/procedures.json` | Drafted with AI-assisted tools as illustrative, non-clinical safety steps |
| Provisional thresholds | `src/config/reference-ranges.ts` | Placeholder values chosen for demonstration; **not** from a NASA resource |
| Interface text (English) | `src/components/**` | Drafted with AI-assisted tools |
| Tests | `tests/**` | Drafted with AI-assisted tools |
| Documentation | `README.md`, `README.pt-BR.md`, `docs/**`, this file | Drafted with AI-assisted tools |
| Logo / brand image | `public/brand/astra-health-logo.png`; derived `src/assets/astra-emblem.png`, `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/opengraph-image.png`, README banners `docs/assets/banner-*.png` | **AI-generated image** supplied by the team (the original carries an "AI-generated" label). The derived files are crops/resizes of it; the README banners show the full logo with its label. |
| Science & Limits content | `src/config/evidence-library.ts`, `src/config/data-provenance.ts`, `scripts/import-osdr.mjs` | Structured with AI-assisted tools; titles, dates, risk statements and quotes are copied verbatim from official NASA sources and checked against them; OSD-575 data is the unmodified NASA OSDR file |
| Screenshots | `docs/screenshots/*.png` | Captured automatically from the running app by `scripts/screenshots.cjs` (not AI-generated images) |

## What AI tools did NOT do

- They did not select, verify or integrate a NASA scientific resource. That slot is intentionally empty
  (`src/config/scientific-sources.ts`) until the team confirms it.
- No real astronaut, patient or NASA data was used.
- No AI model runs inside the application. All analysis is deterministic and rule-based.

## Human responsibilities (Team ANGARIS)

- Review all AI-assisted code and content before submission.
- Confirm the official challenge statement and the NASA resource, then update thresholds and documentation.
- Keep the demonstration and medical disclaimers in every presentation of the project.
