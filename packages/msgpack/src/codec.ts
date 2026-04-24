/**
 * Minimal MessagePack encoder/decoder.
 *
 * Covers the subset Hyper traffic uses in practice:
 *   nil, bool, int (8/16/32/64 signed), float64, string, bin, array, map.
 *
 * Not a drop-in for `@msgpack/msgpack` — no extensions, timestamps, or
 * BigInts. If your payload needs more than this, plug in the full codec
 * via `app({ encoders: { "application/msgpack": custom } })`.
 */

export function encode(value: unknown): Uint8Array {
  const buf: number[] = []
  write(buf, value)
  return Uint8Array.from(buf)
}

export function decode(bytes: Uint8Array): unknown {
  const cursor = { i: 0 }
  const v = read(bytes, cursor)
  return v
}

function write(buf: number[], v: unknown): void {
  if (v === null || v === undefined) {
    buf.push(0xc0)
    return
  }
  if (typeof v === "boolean") {
    buf.push(v ? 0xc3 : 0xc2)
    return
  }
  if (typeof v === "number") {
    if (Number.isInteger(v)) {
      writeInt(buf, v)
    } else {
      writeFloat64(buf, v)
    }
    return
  }
  if (typeof v === "string") {
    writeStr(buf, v)
    return
  }
  if (v instanceof Uint8Array) {
    writeBin(buf, v)
    return
  }
  if (Array.isArray(v)) {
    writeArray(buf, v)
    return
  }
  if (typeof v === "object") {
    writeMap(buf, v as Record<string, unknown>)
    return
  }
  throw new Error(`msgpack: unsupported type: ${typeof v}`)
}

function writeInt(buf: number[], n: number): void {
  if (n >= 0 && n <= 0x7f) {
    buf.push(n)
  } else if (n < 0 && n >= -0x20) {
    buf.push(n & 0xff)
  } else if (n >= 0 && n <= 0xff) {
    buf.push(0xcc, n)
  } else if (n >= 0 && n <= 0xffff) {
    buf.push(0xcd, (n >> 8) & 0xff, n & 0xff)
  } else if (n >= 0 && n <= 0xffffffff) {
    buf.push(0xce, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff)
  } else if (n >= -0x80 && n <= 0x7f) {
    buf.push(0xd0, n & 0xff)
  } else if (n >= -0x8000 && n <= 0x7fff) {
    buf.push(0xd1, (n >> 8) & 0xff, n & 0xff)
  } else if (n >= -0x80000000 && n <= 0x7fffffff) {
    buf.push(0xd2, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff)
  } else {
    // Fallback: encode as float64 — preserves precision up to 2^53.
    writeFloat64(buf, n)
  }
}

function writeFloat64(buf: number[], n: number): void {
  buf.push(0xcb)
  const b = new ArrayBuffer(8)
  new DataView(b).setFloat64(0, n, false)
  const view = new Uint8Array(b)
  for (let i = 0; i < 8; i++) buf.push(view[i]!)
}

function writeStr(buf: number[], s: string): void {
  const bytes = new TextEncoder().encode(s)
  const n = bytes.length
  if (n <= 31) buf.push(0xa0 | n)
  else if (n <= 0xff) buf.push(0xd9, n)
  else if (n <= 0xffff) buf.push(0xda, (n >> 8) & 0xff, n & 0xff)
  else buf.push(0xdb, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff)
  for (let i = 0; i < bytes.length; i++) buf.push(bytes[i]!)
}

function writeBin(buf: number[], b: Uint8Array): void {
  const n = b.length
  if (n <= 0xff) buf.push(0xc4, n)
  else if (n <= 0xffff) buf.push(0xc5, (n >> 8) & 0xff, n & 0xff)
  else buf.push(0xc6, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff)
  for (let i = 0; i < b.length; i++) buf.push(b[i]!)
}

function writeArray(buf: number[], arr: readonly unknown[]): void {
  const n = arr.length
  if (n <= 15) buf.push(0x90 | n)
  else if (n <= 0xffff) buf.push(0xdc, (n >> 8) & 0xff, n & 0xff)
  else buf.push(0xdd, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff)
  for (const v of arr) write(buf, v)
}

function writeMap(buf: number[], o: Record<string, unknown>): void {
  const keys = Object.keys(o)
  const n = keys.length
  if (n <= 15) buf.push(0x80 | n)
  else if (n <= 0xffff) buf.push(0xde, (n >> 8) & 0xff, n & 0xff)
  else buf.push(0xdf, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff)
  for (const k of keys) {
    writeStr(buf, k)
    write(buf, o[k])
  }
}

function read(bytes: Uint8Array, c: { i: number }): unknown {
  const b = bytes[c.i++]!
  if (b <= 0x7f) return b
  if (b >= 0xe0) return b - 0x100
  if (b === 0xc0) return null
  if (b === 0xc2) return false
  if (b === 0xc3) return true
  if (b === 0xcc) return bytes[c.i++]!
  if (b === 0xcd) {
    const v = (bytes[c.i]! << 8) | bytes[c.i + 1]!
    c.i += 2
    return v
  }
  if (b === 0xce) {
    const v =
      bytes[c.i]! * 0x1000000 + ((bytes[c.i + 1]! << 16) | (bytes[c.i + 2]! << 8) | bytes[c.i + 3]!)
    c.i += 4
    return v
  }
  if (b === 0xd0) {
    const v = bytes[c.i++]!
    return v > 0x7f ? v - 0x100 : v
  }
  if (b === 0xd1) {
    const v = (bytes[c.i]! << 8) | bytes[c.i + 1]!
    c.i += 2
    return v > 0x7fff ? v - 0x10000 : v
  }
  if (b === 0xd2) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset + c.i, 4)
    const v = dv.getInt32(0, false)
    c.i += 4
    return v
  }
  if (b === 0xcb) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset + c.i, 8)
    const v = dv.getFloat64(0, false)
    c.i += 8
    return v
  }
  if (b >= 0xa0 && b <= 0xbf) return readStr(bytes, c, b & 0x1f)
  if (b === 0xd9) return readStr(bytes, c, bytes[c.i++]!)
  if (b === 0xda) {
    const n = (bytes[c.i]! << 8) | bytes[c.i + 1]!
    c.i += 2
    return readStr(bytes, c, n)
  }
  if (b === 0xdb) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset + c.i, 4)
    const n = dv.getUint32(0, false)
    c.i += 4
    return readStr(bytes, c, n)
  }
  if (b === 0xc4) return readBin(bytes, c, bytes[c.i++]!)
  if (b >= 0x90 && b <= 0x9f) return readArr(bytes, c, b & 0x0f)
  if (b === 0xdc) {
    const n = (bytes[c.i]! << 8) | bytes[c.i + 1]!
    c.i += 2
    return readArr(bytes, c, n)
  }
  if (b >= 0x80 && b <= 0x8f) return readMap(bytes, c, b & 0x0f)
  if (b === 0xde) {
    const n = (bytes[c.i]! << 8) | bytes[c.i + 1]!
    c.i += 2
    return readMap(bytes, c, n)
  }
  throw new Error(`msgpack: unexpected byte 0x${b.toString(16)}`)
}

function readStr(bytes: Uint8Array, c: { i: number }, n: number): string {
  const s = new TextDecoder().decode(bytes.subarray(c.i, c.i + n))
  c.i += n
  return s
}
function readBin(bytes: Uint8Array, c: { i: number }, n: number): Uint8Array {
  const v = bytes.slice(c.i, c.i + n)
  c.i += n
  return v
}
function readArr(bytes: Uint8Array, c: { i: number }, n: number): unknown[] {
  const out: unknown[] = []
  for (let i = 0; i < n; i++) out.push(read(bytes, c))
  return out
}
function readMap(bytes: Uint8Array, c: { i: number }, n: number): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (let i = 0; i < n; i++) {
    const k = read(bytes, c) as string
    out[k] = read(bytes, c)
  }
  return out
}
