# Vector.js

**Version:** 0.0.1 — 15th June, 2026

**Author:** Satyam Verma — [github.com/SatyamV7](https://github.com/SatyamV7)

**License:** RPL-1.5

---

## Overview

`Vector` is a TypedArray-backed dynamic array for JavaScript, modeled after C++'s `std::vector`. It provides automatic capacity management and a minimal, low-overhead API suitable for performance-critical applications.

---

## Requirements

- A JavaScript environment supporting:
  - [Private class fields](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_class_fields) (`#field`)
  - [`ArrayBuffer.prototype.transfer()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/transfer) (ES2024)
  - TypedArrays (`Uint8Array`, `Float32Array`, etc.)

---

## Installation

`Vector.js` is a single self-contained file with no external dependencies. Copy it into your project and import as needed.

```js
import Vector from './Vector.js';
```

---

## Construction

```js
new Vector(T)
```

`T` may be either:

- A **TypedArray constructor** (e.g. `Float32Array`) — allocates a new empty buffer with an initial capacity of 8 elements.
- An **existing TypedArray instance** — adopted directly as the backing buffer. The vector's `length` is set to the instance's `length`.

Any other value throws a `TypeError`. This is the only method in the API that throws.

```js
const v = new Vector(Float32Array);
const v2 = new Vector(new Uint8Array([1, 2, 3, 4]));
```

> **Note:** When constructing from an existing TypedArray instance, the Vector takes ownership of the underlying buffer. The caller must not retain references to the passed TypedArray after construction, as subsequent reallocations will detach its buffer.

---

## API Reference

### Properties

#### `length` *(getter)*
Returns the number of elements currently held in the vector.

```js
v.length; // e.g. 5
```

#### `length` *(setter)*
Resizes the vector to exactly the specified value. New slots introduced by growth are zero-initialised. Equivalent to calling `resize(n)`.

```js
v.length = 10;
```

#### `capacity`
Returns the total number of elements the vector can hold before a reallocation is required.

```js
v.capacity; // e.g. 16
```

#### `pointer`
Returns a direct reference to the internal TypedArray buffer, inclusive of any reserved capacity beyond `length`. Intended for interop with APIs that require a raw typed memory view.

> **Warning:** The buffer exposed by `pointer` spans the full allocated capacity, not just the active region. Reads beyond `length` produce indeterminate values. Writes are reflected inside the Vector. Use `data()` for a bounded view of the active region only.

```js
v.pointer; // e.g. Float32Array(16) [...]
```

---

### Methods

#### `push(v)`
Appends a single value to the end of the vector, reallocating if necessary.

```js
v.push(42);
```

**Complexity:** Amortized O(1).

---

#### `pop()`
Removes and returns the last element. Returns `null` if the vector is empty.

```js
const last = v.pop();
```

**Complexity:** O(1).

---

#### `at(address, pointee?)`
Reads or writes the element at `address`.

- With one argument, returns the value at `address`.
- With two arguments, writes `pointee` to `address` and returns the input value as-is.

> **Warning:** `at` performs no bounds checking. It is the caller's responsibility to ensure `address` is a valid index within `[0, length)`. Access outside this range is not trapped — reads may return indeterminate values and writes produce undefined behaviour with respect to the vector's logical state. This is by design; callers who have already established index validity should not pay for redundant validation. If bounds checking is required, it must be applied at the call site (see [Call-Site Safety](#call-site-safety)).

```js
v.at(0);          // read
v.at(0, 3.14);    // write, returns 3.14
```

**Complexity:** O(1).

---

#### `insert(address, pointee)`
Inserts one or more elements at `address`, shifting all subsequent elements rightward.

- If `pointee` is a scalar, a single element is inserted.
- If `pointee` is a TypedArray of the same element type as the vector, the entire array is inserted as a contiguous block.

Returns `null` if `address` is out of the range `[0, length]`. An `address` equal to `length` is valid and is equivalent to appending.

> Passing a TypedArray of a **different** element type than the vector's buffer falls through to the scalar insertion path. Only the value assigned to `address` is inserted, subject to the TypedArray's own numeric coercion semantics.

```js
v.insert(2, 99);
v.insert(0, new Float32Array([1.0, 2.0, 3.0]));
```

**Complexity:** O(n).

---

#### `delete(address, length?)`
Removes `length` consecutive elements beginning at `address`, shifting subsequent elements leftward. `length` defaults to `1`.

Returns `null` if `address` or `address + length - 1` falls outside `[0, length)`, or if `length` is less than 1.

```js
v.delete(2);     // remove one element at index 2
v.delete(2, 3);  // remove elements at indices 2, 3, and 4
```

**Complexity:** O(n).

---

#### `append(T)`
Appends all elements of a TypedArray `T` to the end of the vector, reallocating if necessary.

```js
v.append(new Uint8Array([10, 20, 30]));
```

**Complexity:** O(k), where k is `T.length`.

---

#### `resize(n)`
Resizes the vector to exactly `n` elements. New slots introduced by growth are zero-initialised. Shrinking moves the logical length boundary without modifying existing element storage.

```js
v.resize(20);
```

**Complexity:** Amortized O(1).

---

#### `reserve(n)`
Ensures the vector can hold at least `n` elements without reallocation. Has no effect if current capacity is already sufficient. Does not alter `length`.

```js
v.reserve(10_000);
```

**Complexity:** O(n) if reallocation is required; O(1) otherwise.

---

#### `shrink_to_fit()`
Reallocates the backing buffer to exactly `length` elements, releasing surplus capacity. A no-op if capacity already equals `length`.

```js
v.shrink_to_fit();
```

**Complexity:** O(n).

---

#### `data()`
Returns a TypedArray view over the active region `[0, length)`. The view is live — mutations are reflected in the Vector.

```js
const view = v.data();
```

**Complexity:** O(1).

---

#### `[Symbol.iterator]()`
Iterates over the active region. Compatible with `for...of`, spread syntax, and destructuring.

```js
for (const x of v) console.log(x);
const arr = [...v];
```

---

## Capacity Growth

Vector grows using a **capacity-doubling** strategy, starting from an initial capacity of 8. This ensures amortized O(1) cost per element across any sequence of appends.

| Operation | Resulting capacity |
|---|---|
| `push` / scalar `insert` when full | `max(current × 2, 8)` |
| `reserve(n)` | `max(n, current × 2)` |
| `resize(n)` / `length = n` when growing | `max(n, current × 2)` |
| `shrink_to_fit()` | exactly `length` |

When the upper bound of a workload is known in advance, calling `reserve` prior to insertion eliminates all reallocation during that workload.

---

## Error Handling

With the exception of the constructor, Vector does not throw. Failed operations return `null` as an error sentinel:

| Operation | Failure condition | Return value |
|---|---|---|
| `constructor(T)` | Invalid `T` | throws `TypeError` |
| `insert(address, ...)` | `address` out of `[0, length]` | `null` |
| `delete(address, length)` | Either bound out of range, or `length < 1` | `null` |
| `pop()` | Vector is empty | `null` |
| `at(address, ...)` | *(no check performed)* | indeterminate if out of bounds |

Callers that need to distinguish a valid `null` element from an error sentinel should validate inputs prior to calling.

---

## Call-Site Safety

`at()` is an unsupervised dereference. Callers who require bounds-checked access must implement that check themselves:

```js
function checkedRead(vec, i) {
    if (i < 0 || i >= vec.length || !Number.isInteger(i))
        throw new RangeError(`Index ${i} is out of bounds`);
    return vec.at(i);
}
```

Similarly, callers who require exception-throwing behaviour from `insert` or `delete` may wrap those methods:

```js
function checkedInsert(vec, address, pointee) {
    const result = vec.insert(address, pointee);
    if (result === null)
        throw new RangeError(`insert at index ${address} failed`);
}
```

This pattern ensures that validation overhead is borne only by the callers that require it, and is absent from call sites where inputs have already been established as valid.

---

## Examples

```js
// Basic usage
const v = new Vector(Float32Array);
v.push(1.0);
v.push(2.0);
v.push(3.0);
console.log([...v]); // [1, 2, 3]

// Pre-allocate before a known workload
const v2 = new Vector(Uint32Array);
v2.reserve(10_000);
for (let i = 0; i < 10_000; i++) v2.push(i);

// Bulk insert
const v3 = new Vector(new Int16Array([10, 20, 50, 60]));
v3.insert(2, new Int16Array([30, 40]));
console.log([...v3]); // [10, 20, 30, 40, 50, 60]

// Construct from existing data
const raw = new Float64Array([3.14, 2.71, 1.41]);
const v4 = new Vector(raw);
v4.push(1.73);
console.log([...v4]); // [3.14, 2.71, 1.41, 1.73]

// Release surplus capacity after bulk work
v2.shrink_to_fit();
```

---

## License

Reciprocal Public License 1.5 (RPL-1.5). See [https://opensource.org/licenses/RPL-1.5](https://opensource.org/licenses/RPL-1.5) for full terms.