# System Monitoring

The system monitoring feature exposes device hardware readings through
`GET /api/system`. The route is registered in `src/routes/index.js` and
implemented in `src/routes/systemRoutes.js`.

## Platform support

The route collects device readings only when it detects Android or Termux.
Other platforms receive HTTP `501` rather than running platform-specific
commands.

## Data sources

- Battery: `termux-battery-status`. Install the `termux-api` package and the
  Termux:API Android application to enable this reading.
- Memory: `free -m`, with `/proc/meminfo` as a fallback.
- CPU: `top`, with the first line of `/proc/stat` as a fallback.
- Temperature: readable `temp` files under `/sys/class/thermal/thermal_zone*`.

Commands run with a timeout. A missing command or inaccessible system file
results in that reading being unavailable; other readings are still returned.
Unavailable command readings are listed in the response's `unavailable` array.

See [the API reference](../../api/internal/SYSTEM_API.md) for the endpoint path,
response format, and HTTP status codes.
