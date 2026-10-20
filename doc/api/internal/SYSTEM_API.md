# System Statistics API

## `GET /api/system`

Returns battery, memory, CPU, and thermal readings when the server is running on
Android or Termux.

```bash
curl http://localhost:3000/api/system
```

### Success response

HTTP `200`:

```json
{
  "status": "success",
  "timestamp": "2026-10-20T13:00:00.000Z",
  "hardware": {
    "battery": {
      "percentage": 85,
      "status": "DISCHARGING"
    },
    "ram": "total        used        free ...",
    "cpu_load": "CPU: 2% usr 1% sys ...",
    "temperatures_celsius": [35.2, 37.1]
  },
  "unavailable": []
}
```

| Field | Description |
| --- | --- |
| `timestamp` | Time the readings were collected, in ISO 8601 format. |
| `hardware.battery` | Parsed output from `termux-battery-status`, or `null` if unavailable. |
| `hardware.ram` | Output from `free -m`, or `/proc/meminfo` as a fallback. |
| `hardware.cpu_load` | Output from `top`, or the first line of `/proc/stat` as a fallback. |
| `hardware.temperatures_celsius` | Readings from available thermal zones under `/sys/class/thermal`. |
| `unavailable` | Indicators for readings that could not be collected, such as `battery:command_not_installed`. |

The exact battery fields and command output depend on the Android device and
installed utilities. Unavailable readings do not prevent the endpoint from
returning other data.

### Unsupported platform

On a host not detected as Android or Termux, the endpoint returns HTTP `501`:

```json
{
  "status": "unsupported",
  "message": "System statistics are available only on Android or Termux."
}
```

An unexpected collection failure returns HTTP `500`:

```json
{
  "status": "error",
  "message": "Unable to collect system statistics."
}
```
