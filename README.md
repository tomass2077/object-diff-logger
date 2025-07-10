# object-diff-logger

[![npm version](https://img.shields.io/npm/v/object-diff-logger.svg)](https://www.npmjs.com/package/object-diff-logger)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A TypeScript/JavaScript utility for logging and comparing deep differences between objects, arrays, Maps, Sets, and more. Designed for debugging, testing, and tracking changes in complex data structures.

---

## Why use this?

- **Debug complex state**: See exactly what changed, where, and how, in deeply nested objects.
- **Readable output**: Colorful, grouped, and aligned console logs for fast inspection.
- **Handles everything**: Works with objects, arrays, Maps, Sets, Dates, Buffers, and more.
- **Safe**: Handles circular references and depth limits gracefully.
- **Flexible**: Filter by path, track timing, and more.

---

## Features

- 🔍 Deep diffing of objects, arrays, Maps, Sets, Dates, and many built-in types
- 🎨 Colorful, structured console output for easy inspection
- 🔄 Handles circular references and depth limits
- 🎯 Path-based whitelist/blacklist filtering
- ⏱️ Timing info for changes (optional)
- 🟦 TypeScript typings included
- 🗂️ Supports both stateful (stored) and stateless diffing
- 🟢 Works in Node.js and browsers

---

## Installation

```bash
npm install object-diff-logger
```

---

## Quick Start

```typescript
import { ObjectDiffLogger } from "object-diff-logger";

const oldObj = { foo: 1, bar: [1, 2, 3] };
const newObj = { foo: 2, bar: [1, 2, 4] };

ObjectDiffLogger(oldObj, newObj, "comparisonLabel");
```

---

## Usage

### 1. Stateful (Stored) Diffing

Compare an object against its previous state (tracked by a key):

```typescript
import { ObjectDiffLogger_stored } from "object-diff-logger";

const obj = { a: 1, b: { c: 2 } };
ObjectDiffLogger_stored(obj, "myTrackedObject");

// ...later, after changes:
const updated = { a: 1, b: { c: 3, d: 4 } };
ObjectDiffLogger_stored(updated, "myTrackedObject");
```

- The first call stores the object under the given key.
- Subsequent calls compare the new value to the previous one and log any differences.

### 2. Stateless (Direct) Diffing

Compare two objects directly, without storing state:

```typescript
import { ObjectDiffLogger } from "object-diff-logger";

const oldObj = { foo: 1, bar: [1, 2, 3] };
const newObj = { foo: 2, bar: [1, 2, 4] };

ObjectDiffLogger(oldObj, newObj, "comparisonLabel");
```

### 3. Clearing Stored State

If you use stored diffing and want to reset all tracked objects:

```typescript
import { ObjectDiffLogger_clearStorage } from "object-diff-logger";

ObjectDiffLogger_clearStorage();
```

---

## Path Patterns

Many configuration options use "paths" to target specific parts of your objects.  
A path is a string representing the location of a value in the object, similar to JavaScript property access.

**Syntax:**

- Dot notation for properties: `a.b.c`
- Bracket notation for arrays: `foo[2].bar`
- Wildcards: `*` (any property or index at this level), `**` (any nested path, any depth)
- Array wildcards: `bar[]` (any index in array `bar`), `foo[].baz` (property `baz` in any element of array `foo`)
- Mixed: `root[].items[].id` (all `id` fields in all `items` arrays in all `root` array elements)

**Examples:**

- `user.profile.name` — matches the `name` property inside `profile` inside `user`
- `orders[].id` — matches the `id` property of any element in the `orders` array
- `*` — matches any path at the root
- `settings.theme` — matches the `theme` property in `settings`
- `settings.theme*` — matches the `theme` property in `settings`, and any properties or indexes inside of it
- `**.id` — matches any `id` property at any depth

You can use these patterns in `path_blacklist` and `path_whitelist` to include or exclude changes at specific locations.

---

## TypeScript Support

This library is written in TypeScript and ships with full type definitions.  
You get autocompletion and type safety for all APIs and config options.

---

## Performance

- Uses deep comparison and cloning (via lodash) for accuracy.
- For very large or deeply nested objects, consider tuning `maxDepth` for better performance.
- Path filtering (`path_blacklist`, `path_whitelist`) can help reduce unnecessary diffing and logging.

---

## API

### `ObjectDiffLogger_stored(value, key, config?)`

- `value`: The new object/value to compare.
- `key`: A unique string key to identify the object (used for diffing against previous state).
- `config` (optional): Configuration object (see below).
- **Returns**: `true` if changes were detected and logged, `false` otherwise.

### `ObjectDiffLogger(oldValue, newValue, label, config?)`

- `oldValue`: The previous object/value.
- `newValue`: The new object/value.
- `label`: Label for the diff output.
- `config` (optional): Configuration object (see below).
- **Returns**: `true` if changes were detected and logged, `false` otherwise.

### `ObjectDiffLogger_clearStorage()`

Clears all stored object states (only affects stored diffing).

---

## Configuration

All diff functions accept an optional config object.  
**Default values are shown in parentheses.**

| Option                                        | Type       | Description                                                           |
| --------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| `maxDepth` (30)                               | `number`   | Maximum depth for diffing                                             |
| `path_blacklist`                              | `string[]` | Exclude paths matching these patterns                                 |
| `path_whitelist`                              | `string[]` | Only include paths matching these patterns                            |
| `label_override`                              | `string`   | Override label for diff output                                        |
| `suppress_circular_reference_warning` (false) | `boolean`  | Suppress circular reference warnings                                  |
| `suppress_depth_limit_warning` (false)        | `boolean`  | Suppress depth limit warnings                                         |
| `show_debug_info` (false)                     | `boolean`  | Show debug info (timing, call stack)                                  |
| `record_timing_info` (false)                  | `boolean`  | Record and display time since last change per path (stored diff only) |
| `length_limit` (45)                           | `number`   | Limit the length of string representations in the diff output         |

---

## Example

```typescript
import { ObjectDiffLogger_stored } from "object-diff-logger";

ObjectDiffLogger_stored({ foo: 1, bar: [1, 2, 3] }, "example", {
  maxDepth: 5, // Limit the depth
  path_blacklist: ["bar[1]"], // Don't log changes in the second element of bar
  path_whitelist: ["bar"], // Only show changes inside of bar
  show_debug_info: true, // Show who called the function, and how long the diff took
  record_timing_info: true, // Show time since last change to value
  length_limit: 60, // Strings and functions longer than this will be shown as contextual diffs instead of full inline values
});
```

---

## Output

Console output is grouped and color-coded, showing changed paths, old/new values, type changes, and more.

- **Aligned columns** for old and new values, with type and timing info.
- **String diffs**: For long string changes, a detailed diff is shown with context.
- **Key changes**: Added/removed keys are listed.
- **Type and length changes**: Clearly indicated.
- **Errors**: Circular references and depth limits are reported (unless suppressed).
- **Debug info**: Optionally shows timing and call stack for each diff.

![Diff Output Example](https://github.com/tomass2077/object-diff-logger/blob/main/assets/demo_image.png?raw=true)

---

## Contributing

Contributions, bug reports, and feature requests are welcome!  
Please open an issue or pull request on [GitHub](https://github.com/tomass2077/object-diff-logger).

---

## License

MIT © [tomass2077](https://github.com/tomass2077)
