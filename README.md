# Vector.js

**Version:** 0.0.4 — 19th June, 2026

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
new Vector(T, I)
```

### Parameters

#### `T`

`T` determines the element kind and the initial buffer of the vector. It must be one of:

- A **TypedArray constructor** (e.g. `Float32Array`) — a new backing buffer is allocated. The initial capacity is determined by the `I.capacity` field (see below); when `I` is omitted, the default capacity is `8`. The initial `length` is determined by the `I.length` field (see below); when `I` is omitted, `length` is initialised to `0`.
- An **existing TypedArray instance** — the instance is adopted as the backing buffer. The initial `length` is determined by the `I.length` field (see below); when `I` is omitted, `length` is initialised to the instance's own `length`. The vector's `capacity` is equal to the instance's `length`.

Any other value throws a `TypeError`.

#### `I` *(optional)*

`I` is expected to be an object that configures the initial state of the vector. When supplied, it must be a non-`null` object; passing any other type (including `null`) throws a `TypeError`.

All fields of `I` are optional. Unrecognised fields are ignored. The following fields are defined:

---

##### `I.capacity`

Specifies the initial capacity — the total number of elements the vector can hold before a reallocation is required.

- Applicable only when `T` is a **TypedArray constructor**. This field has no defined effect when `T` is an existing TypedArray instance.
- Must be a non-negative integer. Any other value throws a `RangeError`.
- When omitted, the default initial capacity is `8`.

---

##### `I.length`

Specifies the initial length — the number of elements considered logically present in the vector at construction time.

- Must be a non-negative integer. Any other value throws a `RangeError`.
- When `T` is a **TypedArray constructor**: `I.length` must be less than or equal to `I.capacity` (or the default capacity of `8` if `I.capacity` is omitted). Any other value throws a `RangeError`. When omitted, `length` defaults to `0`.
- When `T` is a **TypedArray instance**: `I.length` must be less than or equal to the instance's own `length`. Any other value throws a `RangeError`. When omitted, `length` defaults to the instance's own `length`.

> **Note:** Setting `I.length` to a value less than the buffer's populated region does not clear or zero the elements beyond `I.length`. Those elements reside in the reserved region and their values are indeterminate from the perspective of this specification.

---

##### `I.allocator`

Supplants the default allocator for all buffer allocation, reallocation, and deallocation operations over the lifetime of the vector. The value is captured at construction time and is not subsequently replaceable.

- Must be a non-`null` object whose `malloc`, `realloc`, and `free` properties are callable. Any other value throws a `TypeError`.
- When omitted, the default allocator — implemented in terms of `ArrayBuffer.prototype.transferToFixedLength` — applies.

Each callable property must conform to the interface below. Conformance is not verified at runtime; a non-conforming implementation constitutes undefined behaviour.

| Property | Signature | Required behaviour |
|---|---|---|
| `malloc` | `(T, size) → TypedArray` | Must return a TypedArray of constructor `T` whose `length` is exactly `size`. |
| `realloc` | `(view, size) → TypedArray` | Must return a TypedArray of the same constructor as `view` whose `length` is exactly `size`. The contents of `view` over `[0, min(view.length, size))` must be preserved in the returned TypedArray. |
| `free` | `(view) → void` | Must release the buffer underlying `view`. The vector issues no further accesses to `view` or its buffer subsequent to this call. |

---

### Failure Conditions

| Condition | Error type |
|---|---|
| `T` is not a TypedArray constructor or TypedArray instance | `TypeError` |
| `I` is supplied but is not a non-`null` object | `TypeError` |
| `I.capacity` is supplied but is not a non-negative integer | `RangeError` |
| `I.length` is supplied but is not a non-negative integer, or exceeds the applicable upper bound | `RangeError` |
| `I.allocator` is supplied but is not a non-`null` object, or is missing any of callable `malloc`, `realloc`, or `free` | `TypeError` |

The constructor is the only point in the API that throws.

---

### Buffer Ownership

When `T` is an existing TypedArray instance, the Vector takes ownership of the underlying buffer. The caller must not retain references to the passed TypedArray after construction, as subsequent reallocations will detach its buffer.

---

### Examples

```js
// Construct from a TypedArray constructor with default capacity and length
const v1 = new Vector(Float32Array);

// Construct with an explicit initial capacity
const v2 = new Vector(Uint32Array, { capacity: 64 });

// Construct with an explicit initial capacity and length
const v3 = new Vector(Int16Array, { capacity: 64, length: 16 });

// Construct from an existing TypedArray instance; length defaults to instance length
const v4 = new Vector(new Uint8Array([1, 2, 3, 4]));

// Construct from an existing instance with a reduced initial length
const v5 = new Vector(new Uint8Array([1, 2, 3, 4]), { length: 2 });
```

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

#### Indeterminate value

A value returned by a read operation for which this specification imposes no constraint on content.

- The returned value *shall* be a valid, well-defined value of the vector's element type or `undefined`, as produced deterministically by the underlying TypedArray read. It is never unspecified at the engine level, uninitialised, or unsafe to obtain.
- This specification does not constrain *which* such value is returned. The value *may* depend on implementation details not described herein, and such details *shall not* be relied upon, including where observed to be stable across calls or releases.
- A future revision *may* alter the indeterminate value produced by a given operation without this being considered a breaking change.

#### Undefined behaviour

The absence of any constraint, imposed by this specification, on the effect of a write operation upon Vector's tracked invariants (`length`, `capacity`, the active/reserved boundary), when that operation is performed outside the bounds of its documented contract.

- The underlying write *shall* remain memory-safe and fully defined at the engine level for every address, in accordance with the ECMAScript specification, irrespective of this clause.
- This clause constrains only the logical state guarantees made by Vector. It does not relax, nor refer to, memory safety at the level of the host engine.
- No conforming implementation, nor any caller, *shall* infer reachability or unreachability of any code path on the basis of this clause.

> **Note:** These terms bound the guarantees made by *this* specification; they do not describe properties of the underlying runtime, which remains fully deterministic and memory-safe in all cases. Where this document is silent, behaviour is unspecified by Vector — not unsafe, and not unknown to the engine.

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

#### `destruct()`
- Invokes the allocator's `free` method on the backing buffer, sets the internal buffer reference to `null`, and sets `length` to `0`.

- Any TypedArray views or references previously obtained via `pointer` or `data()` are invalidated subsequent to this call and must not be accessed thereafter.

- Any subsequent operation that dereferences the internal buffer may throw a `TypeError` due to host's null dereference semantics.

- No failure conditions exist for `destruct`.

- Returns `undefined`.

***Example***:
```js
v.destruct();
```

**Complexity:** O(1).

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
| `push` / scalar `insert` when full | `current × 2 || 8` |
| `reserve(n)` | `max(n, current × 2)` |
| `resize(n)` / `length = n` when growing | `max(n, current × 2)` |
| `shrink_to_fit()` | exactly `length` |

When the upper bound of a workload is known in advance, calling `reserve` prior to insertion eliminates all reallocation during that workload.

---

## Error Handling

With the exception of the constructor, Vector does not throw. Failed operations return `null` as an error sentinel:

| Operation | Failure condition | Return value |
|---|---|---|
| `constructor(T, I)` | Invalid `T` | throws `TypeError` |
| `constructor(T, I)` | `I` is not a non-`null` object | throws `TypeError` |
| `constructor(T, I)` | `I.capacity` is not a non-negative integer | throws `RangeError` |
| `constructor(T, I)` | `I.length` is not a non-negative integer or exceeds its upper bound | throws `RangeError` |
| `constructor(T, I)` | `I.allocator` is not a non-`null` object, or is missing any of `malloc`, `realloc`, or `free` | throws `TypeError` |
| `insert(address, ...)` | `address` out of `[0, length]` | `null` |
| `delete(address, length)` | Either bound out of range, or `length < 1` | `null` |
| `pop()` | Vector is empty | `null` |
| `at(address, ...)` | *(no check performed)* | indeterminate if out of bounds |

> **Note:** With the exception of the constructor, Vector does not throw, but the underlying TypedArray may throw, likely due to coercion issues when using Vector's backed by BigInt64Array or BigUint64Array. Such exceptions are not explicitly documented as part of the Vector API, but may occur if input values are incompatible with the vector's element type. Also if detached ArrayBuffer backed views are passed to `constructor`, `insert`, or `append`, the methods may throw.

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

## License

The Vector.js library is licensed under the terms of the Reciprocal Public License 1.5 (RPL1.5). See LICENSE.txt for more information.