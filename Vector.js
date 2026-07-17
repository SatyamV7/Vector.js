// Vector.js v0.0.7 <23rd June, 2026> - Author: Satyam Verma <github.com/SatyamV7> - License: RPL-1.5

export default class Vector {
    #buffer;
    #length = 0;
    #NULL = 0;

    static #PrivilegedKey = Symbol();

    static #TypedArray = Object.getPrototypeOf(Uint8Array);

    static #Allocator = Object.freeze({
        malloc(T, size) {
            return new T(new ArrayBuffer(size * T.BYTES_PER_ELEMENT));
        },

        realloc(view, size) {
            return new view.constructor(
                view.buffer.transferToFixedLength(size * view.BYTES_PER_ELEMENT)
            );
        },

        free(view) {
            if (!view.buffer.detached) {
                return void view.buffer.transferToFixedLength(0x0000);
            }
        }
    });

    #allocator = Vector.#Allocator;

    static #isOutOfBound(address, HighAddress) {
        return !Number.isInteger(address) || address < 0 || address > HighAddress;
    }

    constructor(T, I = {}) {
        if (typeof I !== "object" || I === null) {
            throw new TypeError("Expected an object for the `I` parameter");
        }

        if (
            Object.hasOwn(I, "capacity") &&
            Vector.#isOutOfBound(I.capacity, Infinity)
        ) {
            throw new RangeError("capacity must be a non-negative integer");
        }

        if (
            Object.hasOwn(I, "allocator") &&
            (!I.allocator ||
                typeof I.allocator !== "object" ||
                typeof I.allocator.malloc !== "function" ||
                typeof I.allocator.realloc !== "function" ||
                typeof I.allocator.free !== "function")
        ) {
            throw new TypeError(
                "allocator must be an non-null object with malloc, realloc, and free methods implemented"
            );
        } else if (Object.hasOwn(I, "allocator")) {
            this.#allocator = I.allocator;
        }

        const { capacity = 8, length = 0 } = I;

        if (Object.getPrototypeOf(T) === Vector.#TypedArray) {
            if (
                Object.hasOwn(I, "length") &&
                Vector.#isOutOfBound(I.length, capacity)
            ) {
                throw new RangeError(
                    "length must be a non-negative integer less than or equal to capacity"
                );
            }
            this.#buffer =
                ((this.#length = length), this.#allocator.malloc(T, capacity));
        } else if (ArrayBuffer.isView(T) && !(T instanceof DataView)) {
            if (
                Object.hasOwn(I, "length") &&
                Vector.#isOutOfBound(I.length, T.length)
            ) {
                throw new RangeError(
                    "length must be a non-negative integer less than or equal to capacity"
                );
            }
            this.#buffer = ((this.#length = I.length ?? T.length), T);
        } else {
            throw new TypeError(
                "Expected a TypedArray View or a TypedArray constructor"
            );
        }

        {
            const buffer = !this.#buffer.length
                ? new this.#buffer.constructor(
                      new ArrayBuffer(this.#buffer.BYTES_PER_ELEMENT)
                  )
                : this.#buffer;

            this.#NULL = buffer[0] ^ buffer[0];
        }
    }

    get length() {
        return this.#length;
    }

    set length(x) {
        this.resize(x, undefined);
    }

    get pointer() {
        return this.#buffer;
    }

    get capacity() {
        return this.#buffer.length;
    }

    destruct() {
        this.#length = 0x00;
        this.#allocator.free(this.#buffer);
        this.#buffer = null;
    }

    reserve(capacity) {
        if (capacity > this.#buffer.length) {
            this.#buffer = this.#allocator.realloc(
                this.#buffer,
                Math.max(capacity, this.#buffer.length << 1)
            );
        }
    }

    resize(n, ZeroInit) {
        if (!Number.isInteger(n)) return;
        if (n < 0 || n === this.#length) return;
        const $0 = this.#NULL;
        if (n > this.#length) {
            const c = Math.min(n, this.#buffer.length);
            if (n > this.#buffer.length) {
                this.#buffer = this.#allocator.realloc(
                    this.#buffer,
                    Math.max(n, this.#buffer.length << 1)
                );
            }
            if (ZeroInit !== Vector.#PrivilegedKey) {
                this.#buffer.fill($0, this.#length, c);
            }
        } /* else {
            this.#buffer.fill($0, this.#length, x);
        } */
        this.#length = n;
    }

    shrink_to_fit() {
        if (this.#buffer.length === 0 || this.#buffer.length === this.#length)
            return;
        this.#buffer = this.#allocator.realloc(this.#buffer, this.#length);
    }

    insert(address, pointee) {
        if (Vector.#isOutOfBound(address, this.#length)) {
            // throw new RangeError(
            //     "attempt to subscript vector with out-of-bounds index"
            // );
            return null;
        }
        if (pointee instanceof this.#buffer.constructor) {
            const memmov_head = address;
            const memmov_tail = this.#length;
            const memmov_target = address + pointee.length;
            this.reserve(this.#length + pointee.length);
            this.#buffer.copyWithin(memmov_target, memmov_head, memmov_tail);
            this.#buffer.set(pointee, address);
            this.#length += pointee.length;
        } else {
            if (this.length >= this.capacity) {
                this.#buffer = this.#allocator.realloc(
                    this.#buffer,
                    this.#buffer.length << 1 || 8
                );
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
        if (this.length >= this.capacity) {
            this.#buffer = this.#allocator.realloc(
                this.#buffer,
                this.#buffer.length << 1 || 8
            );
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
        this.resize(address + T.length, Vector.#PrivilegedKey);
        this.#buffer.set(T, address);
    }

    data() {
        return this.#buffer.subarray(0, this.#length);
    }

    [Symbol.iterator]() {
        return this.data()[Symbol.iterator]();
    }

    [Symbol.dispose]() {
        return void this.destruct();
    }
}
