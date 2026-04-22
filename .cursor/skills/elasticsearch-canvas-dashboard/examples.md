# Examples

## Trigger Examples

Use this skill for prompts like:

- "Build a canvas dashboard from my Elasticsearch logs data"
- "Turn these ES|QL results into a Cursor Canvas"
- "Mirror this Elastic dashboard in a canvas"
- "Make a standalone canvas for request latency and error rate"
- "Create a logs canvas with a timerange filter and refresh button"

## Example Canvas Plan

For a logs dashboard:

1. Read the existing dashboard JSON if it exists.
2. Validate the source index and time field.
3. Reduce the data to:
   - total requests
   - error rate
   - average payload size
   - requests over time
   - errors over time
   - status-code mix
   - top erroring requests
4. Create a canvas with:
   - title + context
   - timerange pills
   - refresh button
   - KPI strip
   - two trend charts
   - one pie or bar breakdown
   - one table
   - callout describing snapshot behavior

## Example User-Facing Caveat

Use wording like:

> This canvas embeds a snapshot of the Elasticsearch-backed dashboard so it can render as a standalone artifact. The timerange filter updates the embedded datasets, and the refresh button updates snapshot state. For live re-querying, use the MCP dashboard preview.

## Example Companion MCP Flow

If the user also wants the live dashboard:

1. Read the MCP resources first.
2. Create the dashboard.
3. Use `dashboardId` for every follow-up tool call.
4. Build metrics, charts, and sections.
5. Finish with `view_dashboard`.

## Anti-Patterns

Avoid:

- claiming the canvas live-queries Elasticsearch when it does not
- importing anything except `cursor/canvas`
- wrapping every section in identical cards
- embedding far more data than the canvas actually uses
- skipping the explanation of snapshot vs live behavior
