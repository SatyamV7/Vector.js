// Vector.js v0.0.3 <16th June, 2026> - Author: Satyam Verma <github.com/SatyamV7> - License: RPL-1.5

export default class Vector {
    #buffer;
    #length = 0;
    #NULL = 0;

    static #TypedArray = Object.getPrototypeOf(Uint8Array);

    static #realloc(view, new_cap) {
        function realloc_v(view, size) {
            return new view.constructor(
                view.buffer.transfer(size * view.BYTES_PER_ELEMENT)
            );
        }
        const capacity = new_cap ?? (view.length << 1 || 8);
        return realloc_v(view, capacity);
    }

    static #isOutOfBound(address, HighAddress) {
        return !Number.isInteger(address) || address < 0 || address > HighAddress;
    }

    constructor(T) {
        if (Object.getPrototypeOf(T) === Vector.#TypedArray) {
            this.#buffer = new T(8);
        } else if (ArrayBuffer.isView(T) && !(T instanceof DataView)) {
            this.#buffer = ((this.#length = T.length), T);
        } else {
            throw new TypeError(
                "Expected a TypedArray View or a TypedArray constructor"
            );
        }

        if (
            this.#buffer instanceof BigInt64Array ||
            this.#buffer instanceof BigUint64Array
        ) {
            this.#NULL = 0n;
        }
    }

    get length() {
        return this.#length;
    }

    set length(x) {
        this.#resize(x, true);
    }

    get pointer() {
        return this.#buffer;
    }

    get capacity() {
        return this.#buffer.length;
    }

    reserve(capacity) {
        if (capacity > this.#buffer.length) {
            this.#buffer = Vector.#realloc(
                this.#buffer,
                Math.max(capacity, this.#buffer.length << 1)
            );
        }
    }

    #resize(x, ZeroInit = true) {
        if (!Number.isInteger(x)) return;
        if (x < 0 || x === this.#length) return;
        const $0 = this.#NULL;
        if (x > this.#length) {
            const c = Math.min(x, this.#buffer.length);
            if (x > this.#buffer.length) {
                this.#buffer = Vector.#realloc(
                    this.#buffer,
                    Math.max(x, this.#buffer.length << 1)
                );
            }
            if (ZeroInit) {
                this.#buffer.fill($0, this.#length, c);
            }
        } /* else {
            this.#buffer.fill($0, this.#length, x);
        } */
        this.#length = x;
    }

    resize(n) {
        this.#resize(n, true);
    }

    shrink_to_fit() {
        if (this.#buffer.length === 0 || this.#buffer.length === this.#length)
            return;
        this.#buffer = Vector.#realloc(this.#buffer, this.#length);
    }

    insert(address, pointee) {
        if (Vector.#isOutOfBound(address, this.#length)) {
            // throw new RangeError(
            //     "attempt to subscript vector with out-of-bounds index"
            // );
            return null;
        }
        if (pointee instanceof this.#buffer.constructor) {
            const mov_tail = this.#length;
            this.#resize(this.#length + pointee.length, false);
            this.#buffer.copyWithin(address + pointee.length, address, mov_tail);
            this.#buffer.set(pointee, address);
        } else {
            if (this.#length >= this.capacity) {
                this.#buffer = Vector.#realloc(this.#buffer);
            }
            this.#buffer.copyWithin(address + 1, address, this.#length++);
            this.#buffer[address] = pointee;
        }
    }

    delete(address, length = 1) {
        if (
            length < 1 ||
            !Number.isInteger(length) ||
            Vector.#isOutOfBound(address + length - 1, this.#length - 1) ||
            Vector.#isOutOfBound(address, this.#length - 1)
        ) {
            // throw new RangeError(
            //     "attempt to subscript vector with out-of-bounds index"
            // );
            return null;
        }
        this.#buffer.copyWithin(address, address + length, this.#length);
        this.#length -= length;
    }

    push(v) {
        if (this.#length >= this.#buffer.length) {
            this.#buffer = Vector.#realloc(this.#buffer);
        }
        this.#buffer[this.#length++] = v;
    }

    pop() {
        if (this.#length === 0) return null;
        return this.#buffer[--this.#length];
    }

    at(address, pointee) {
        // if (Vector.#isOutOfBound(address, this.#length - 1)) {
        //     // throw new RangeError(
        //     //     "attempt to subscript vector with out-of-bounds index"
        //     // );
        //     return null;
        // }
        if (pointee !== undefined) {
            return (this.#buffer[address] = pointee);
        }
        return this.#buffer[address];
    }

    append(T) {
        const address = this.#length;
        this.#resize(address + T.length, false);
        this.#buffer.set(T, address);
    }

    data() {
        return this.#buffer.subarray(0, this.#length);
    }

    [Symbol.iterator]() {
        return this.data()[Symbol.iterator]();
    }
}
