import { type ParsedArgs, isJson } from "../args.ts"

export async function runVersion(args: ParsedArgs): Promise<number> {
  const info = {
    hyper: "0.0.0",
    bun: typeof Bun !== "undefined" ? Bun.version : "unknown",
    platform: process.platform,
    arch: process.arch,
  }
  if (isJson(args.flags)) {
    console.log(JSON.stringify(info))
    return 0
  }
  console.log(`hyper ${info.hyper}  |  bun ${info.bun}  |  ${info.platform}-${info.arch}`)
  return 0
}
