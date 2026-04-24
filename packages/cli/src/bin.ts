#!/usr/bin/env bun
import { parseArgs } from "./args.ts"
import { runAdd } from "./commands/add.ts"
import { runBench } from "./commands/bench.ts"
import { runBuild } from "./commands/build.ts"
import { runClient } from "./commands/client.ts"
import { runDev } from "./commands/dev.ts"
import { runDiff } from "./commands/diff.ts"
import { runEnvCheck } from "./commands/env.ts"
import { HELP_TEXT, runHelp } from "./commands/help.ts"
import { runInit } from "./commands/init.ts"
import { runMcp } from "./commands/mcp.ts"
import { runOpenapi } from "./commands/openapi.ts"
import { runRoutes } from "./commands/routes.ts"
import { runSecurity } from "./commands/security.ts"
import { runTest } from "./commands/test.ts"
import { runTypecheck } from "./commands/typecheck.ts"
import { runVersion } from "./commands/version.ts"

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  if (args.flags.help === true || args.flags.h === true || !args.command) {
    return runHelp()
  }
  switch (args.command) {
    case "init":
      return runInit(args)
    case "dev":
      return runDev(args)
    case "build":
      return runBuild(args)
    case "test":
      return runTest(args)
    case "typecheck":
      return runTypecheck(args)
    case "env":
      return runEnvCheck(args)
    case "routes":
      return runRoutes(args)
    case "client":
      return runClient(args)
    case "mcp":
      return runMcp(args)
    case "openapi":
      return runOpenapi(args)
    case "add":
      return runAdd(args)
    case "diff":
      return runDiff(args)
    case "bench":
      return runBench(args)
    case "security":
      return runSecurity(args)
    case "version":
    case "--version":
    case "-v":
      return runVersion(args)
    case "help":
      return runHelp()
    default:
      console.error(`unknown command: ${args.command}\n`)
      console.error(HELP_TEXT)
      return 2
  }
}

main().then((code) => {
  process.exit(code)
})
