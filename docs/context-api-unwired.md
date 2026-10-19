# Context-API wiring status

Endpoint status for the `/api/context/*` layer after §4 of the remediation plan.

| Endpoint | Client wrapper | Wired to UI |
| --- | --- | --- |
| `POST /api/context/fit-window` | `api.getFitWindowOptions` | Yes — "What Should I Do Now?" (`spontaneousMapper`) and the first-two-hours "extra time" card |
| `GET /api/context/travel-time` | `api.getTravelEstimate` | Yes — first-two-hours "Head toward your hotel" step duration |
| `GET /api/context/post-activity-food` | `api.getPostActivityFood` | **Intentionally unwired.** |
| `POST /api/context/parse-intent` | deleted | No — no natural caller exists; revive when a search screen needs intent parsing (see remediation plan §4, "احذف `parseSearchIntent` كمان") |
| `POST /api/context/daily-briefing` | deleted | No — the server handler returned a template while ignoring 2 of 3 inputs; a real daily briefing exists in DayGI (`src/shared/types/daygi.ts`) |

## Why `post-activity-food` is intentionally unwired

`FoodNowView` builds its "what to eat after your activity" surface from the
dining catalogue (`/api/dahab/food` via `buildDiningOptions`), which is richer
and already live. The `post-activity-food` endpoint (anchor location + a few
nearby spots) adds nothing the catalogue path does not provide, so it was left
off rather than running two food sources against the same screen.

The wrapper stays in `api.ts` with a real return type so the endpoint remains
reachable and typed the day a screen needs a post-activity food suggestion
(e.g. a dinner-after-sunset prompt).