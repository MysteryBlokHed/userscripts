# InitLive Devtools

Ignore restrictions when scheduling/unscheduling shifts on [InitLive](https://www.initlive.com/).

## API

All methods are available on the global `ILDevtools` object.

| Method                | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `showShiftChecks`     | Shows checkmarks for full shifts and enables disabled checkmarks |
| `showShiftIds`        | Shows the IDs of all the available shifts                        |
| `getgetEventUserInfo` | Get event-specific user information from InitLive                |
| `scheduleShift`       | Schedule yourself for a shift. Accepts one or more ID's          |
| `unscheduleShift`     | Unschedule yourself for a shift. Accepts one or more ID's        |

The specific options available for each function can be found by looking at the TypeScript API.

## Examples

```typescript
// Give yourself shifts
ILDevtools.scheduleShift(1234567)
ILDevtools.scheduleShift([1234567])
ILDevtools.scheduleShift([1234567, 8901234])
```

```typescript
// Remove yourself from shifts
ILDevtools.unscheduleShift(1234567)
ILDevtools.unscheduleShift([1234567])
ILDevtools.unscheduleShift([1234567, 8901234])
```

## TypeScript

This UserScript is fully written in TypeScript, so the API's types can be imported into a TypeScript project.

```typescript
/// <reference types="./path/to/InitLiveDevtools.user.ts">
```
