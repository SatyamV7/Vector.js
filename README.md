# Vector.js

**Version:** 0.0.3 — 16th June, 2026

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

***Example***:
```js
const v = new Vector(Float32Array);
const v2 = new Vector(new Uint8Array([1, 2, 3, 4]));
```

> **Note:** When constructing from an existing TypedArray instance, the Vector takes ownership of the underlying buffer. The caller must not retain references to the passed TypedArray after construction, as subsequent reallocations will detach its buffer.

---

## API Reference

### Properties

#### `length` *(getter)*

```js
v.length;
```

- Returns the number of elements in the vector.

- `length` is always less than or equal to `capacity`.

#### `length` *(setter)*

```js
v.length = n;
```

- Resizes the vector to contain exactly the specified number of elements.

- If current `length` is greater than the specified value, the vector is reduced to first specified number of elements.

- If current `length` is less than the specified value, new slots are appended and zero-initialised.

- Equivalent to calling `resize(n)`.

#### `capacity`

```js
v.capacity;
```

- Returns the total number of elements the vector can hold before a reallocation is required.

#### `pointer`

```js
v.pointer;
```

- Returns a direct reference to the internal TypedArray buffer, inclusive of any reserved capacity beyond `length`. Intended for interop with APIs that require a raw typed memory view.

> **Warning:** The buffer exposed by `pointer` spans the full allocated capacity, not just the active region. Reads beyond `length` produce indeterminate values. Writes are reflected inside the Vector. Use `data()` for a bounded view of the active region only.

> **Note:** The `pointer` property is read-only. The underlying buffer may be reallocated at any time, invalidating any previously obtained reference. Callers must not retain references to the buffer across operations that may trigger a reallocation (e.g., `push`, `insert`, `resize`, etc.).

---

> **Note:** The active region is defined as the contiguous range of elements `[0, length)`, and the reserved region is defined as the contiguous range of elements `[length, capacity)`.

---

### Methods

#### `push(v)`
- Appends a single value to the end of the vector, reallocating if necessary.

- Reallocation takes place if `length` is equal to `capacity`. The new capacity is determined by the growth strategy described in [Capacity Growth](#capacity-growth).

- Returns `undefined`.

- No failure conditions exist for `push`.

- `v` may be a number or BigInt, as per the TypedArray's element kind. The value is subject to the TypedArray's own numeric coercion semantics.

***Example***:
```js
v.push(42);
```

**Complexity:** Amortized O(1).

---

#### `pop()`
- Removes the last element of the vector and returns its value, if the vector is not empty i.e, `length` is greater than zero.

- Fails if the vector is empty, i.e. `length` is equal to zero, returning `null` in failure condition.

***Example***:
```js
const last = v.pop();
```

**Complexity:** O(1).

---

#### `at(address, pointee?)`
- Reads or writes the element at `address`.

- With `pointee` argument absent, returns the value at `address` index.
- With `pointee` argument present, writes `pointee` to `address` and returns the input value as-is.

- Note that `pointee` (if provided) may be coerced to the vector's element type when writing at given `address`, also returned value (same as `pointee`, the input value) may not be equal to value written to the vector, due to TypedArray numeric coercion semantics.

> **Warning:** `at` performs no bounds checking. It is the caller's responsibility to ensure `address` is a valid index within `[0, length)`. Access outside this range is not trapped — reads may return indeterminate values and writes produce undefined behaviour with respect to the vector's logical state. This is by design; callers who have already established index validity should not pay for redundant validation. If bounds checking is required, it must be applied at the call site (see [Call-Site Safety](#call-site-safety)).

***Example***:
```js
v.at(0);          // read
v.at(0, 3.14);    // write, returns 3.14
```

**Complexity:** O(1).

---

#### `insert(address, pointee)`
- Inserts one or more elements at `address`, shifting all subsequent elements rightward.

- If `pointee` is a number/BigInt (as per the TypedArray's element kind), pointee's value is inserted, and the value inserted is subject to the TypedArray's own numeric coercion semantics.
- If `pointee` is a TypedArray of the same element kind as the vector, the entire array is inserted as a contiguous block.

- Reallocation takes place if necessary, using the growth strategy described in [Capacity Growth](#capacity-growth).

- Fails if `address` is outside the valid range `[0, length]`, returning `null` in failure condition.

- An `address` equal to `length` is valid and is equivalent to pushing/appending.

- Returns `undefined` on success.

> Passing a TypedArray of a **different** element kind than the vector's buffer falls through to the scalar insertion path. Only the value assigned to `address` is inserted, subject to the TypedArray's own numeric coercion semantics.

***Example***:
```js
v.insert(2, 99);
v.insert(0, new Float32Array([1.0, 2.0, 3.0]));
```

**Complexity:** O(n).

---

#### `delete(address, length?)`
- Removes `length` consecutive elements beginning at `address`, shifting subsequent elements leftward.

- Value of `length` parameter defaults to `1` and is expected to be a integer greater than or equal to 1.

- Fails if `address` or `address + length - 1` falls outside active region, or if `length` is less than 1, returning `null` in failure condition.

- Returns `undefined` on success.

***Example***:
```js
v.delete(2);     // remove one element at index 2
v.delete(2, 3);  // remove elements at indices 2, 3, and 4
```

**Complexity:** O(n).

---

#### `append(T)`
- Appends all elements of a TypedArray `T` to the end of the vector, reallocating if necessary.

- T is expected to have the same element kind as the vector's buffer. If `T` has a different element kind, the values are casted to the vector's element type according to the TypedArray's own numeric coercion semantics.

- No failure conditions exist for `append`.

- Returns `undefined`.

***Example***:
```js
v.append(new Uint8Array([10, 20, 30]));
```

**Complexity:** O(k), where k is `T.length`.

---

#### `resize(n)`
- Resizes the vector to contain exactly the `n` number of elements.

- If current `length` is greater than `n`, the vector is reduced to first `n` elements.

- If current `length` is less than `n`, new slots are appended and zero-initialised.

- May trigger a reallocation if `n` exceeds current `capacity`. The new capacity is determined by the growth strategy described in [Capacity Growth](#capacity-growth).

- If `n` is not an integer or is negative or is equal to `length`, the operation is a no-op and returns `undefined`.

- Returns `undefined`.

- There is no failure condition for `resize`, instead it is a no-op if `n` is invalid or equal to current `length`.

***Example***:
```js
v.resize(20);
```

**Complexity:** Amortized O(1).

---

#### `reserve(n)`
- Increase the capacity of the vector (the total number of elements that the vector can hold without requiring reallocation) to a value that's greater or equal to `n`.

- If `n` is greater than the current `capacity`, new storage is allocated, otherwise the function does nothing.

- `reserve()` does not change the `length` of the vector.

- Reallocations are usually costly operations in terms of performance. The `reserve()` function can be used to eliminate reallocations if the number of elements is known beforehand.

- No failure conditions exist for `reserve`.

- Returns `undefined`.

***Example***:
```js
v.reserve(10_000);
```

**Complexity:** O(n) if reallocation is required; O(1) otherwise.

---

#### `shrink_to_fit()`
- Reallocates the backing buffer to exactly `length` elements, releasing surplus capacity. A no-op if `capacity` already equals `length`.

- No failure conditions exist for `shrink_to_fit` but is a no-op if `length` is equal to `capacity`.

- Returns `undefined`.

***Example***:
```js
v.shrink_to_fit();
```

**Complexity:** O(n) if reallocation is required; O(1) otherwise.

---

#### `data()`
- Returns a TypedArray view over the active region `[0, length)`. The view is live — mutations are reflected in the Vector.

- The view is invalidated by any operation that reallocates the backing buffer (e.g., `push`, `insert`, `resize`, etc.). Callers must not retain references to the view across such operations.

- Changes to vector's `length` are not reflected in the view. The view's `length` is fixed at the time of creation.

- No failure conditions exist for `data`.

- Returns a TypedArray of the same element kind as the vector's buffer, with `length` equal to the vector's `length` at the time of creation.

***Example***:
```js
const view = v.data();
```

**Complexity:** O(1).

---

#### `[Symbol.iterator]()`
- Iterates over the active region. Compatible with `for...of`, spread syntax, and destructuring.

- Iterators are invalidated by any operation that reallocates the backing buffer (e.g., `push`, `insert`, `resize`, etc.). Callers must not retain references to the iterator across such operations.

- Iterators go stale if the vector's `length` is changed by operations that mutate the vector after the iterator is created. Iterator iterates upto `length` fixed at time of creation of the iterator, even if the vector's `length` is subsequently changed. Iterators loop over live data, so changes to the vector's contents are reflected in the iterator.

- Read-only operations do not invalidate iterators or make iterators go stale.

***Example***:
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

The Vector.js library is licensed under the terms of the Reciprocal Public License 1.5 (RPL1.5). See LICENSE.txt for more information.