import * as fs from 'fs'
import * as readline from 'readline'

export async function convertSystems(inputFile: string, outputFile: string): Promise<boolean> {
  const fileStream = fs.createReadStream(inputFile)

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  let systems = []

  for await (const line of rl) {
    systems.push(line)
  }

  fs.writeFileSync(outputFile, JSON.stringify(systems, null, 2))
  return true
}
