# System Statistics API

## `GET /api/system`

Returns battery, memory, and battery temperature when the server is running on
Android or Termux.

```bash
curl http://localhost:3000/api/system
```

### Success response

HTTP `200`:

```json
{
  "success": true,
  "device": {
    "temperature": "32.5°C (Battery)",
    "ram": {
      "total": 4096,
      "used": 2048,
      "free": 2048,
      "usagePercentage": "50.0%"
    },
    "battery": {
      "percentage": 85,
      "status": "DISCHARGING",
      "plugged": "UNPLUGGED",
      "health": "GOOD"
    }
  }
}
```

| Field | Description |
| --- | --- |
| `device.temperature` | Battery temperature with `°C (Battery)` suffix, or `Không xác định` if unavailable. |
| `device.ram` | RAM total, used, and free in MB, plus usage percentage; `null` if `free -m` is unavailable or unparseable. |
| `device.battery` | Selected battery fields (`percentage`, `status`, `plugged`, `health`), or `null` if unavailable. |

The exact battery values depend on the Android device and Termux:API.
Install the `termux-api` package and the Termux:API Android application to
enable battery readings. Missing battery or RAM data does not prevent the
endpoint from returning the other reading.

### Unsupported platform

On a host not detected as Android or Termux, the endpoint returns HTTP `501`:

```json
{
  "success": false,
  "error": "System statistics are available only on Android or Termux."
}
```

An unexpected collection failure returns HTTP `500`:

```json
{
  "success": false,
  "error": "Lỗi đọc phần cứng"
}
```
