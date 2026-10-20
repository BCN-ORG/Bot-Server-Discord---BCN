# System Monitoring

The system monitoring feature returns RAM and battery readings through
`GET /api/system`. The route is registered in `src/routes/index.js` and
implemented in `src/routes/systemRoutes.js`.

## Platform support

The route collects device readings only when it detects Android or Termux.
Other platforms receive HTTP `501` rather than running platform-specific
commands.

## Data sources

- Battery: `termux-battery-status`. Install the `termux-api` package and the
  Termux:API Android application to enable this reading.
- Memory: `free -m`; total, used, free memory and usage percentage are returned in MB.
- Temperature: battery temperature from `termux-battery-status`.

Commands run with a timeout. A missing command or invalid output makes that
reading `null`; the other readings are still returned.

See [the API reference](../../api/internal/SYSTEM_API.md) for the endpoint path,
response format, and HTTP status codes.
