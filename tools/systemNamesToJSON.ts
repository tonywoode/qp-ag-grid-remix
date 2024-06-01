const fs = require('fs')
const readline = require('readline')

async function convertFile(inputFile, outputFile) {
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
}

convertFile('test/example_inputs/systems.dat', 'test/example_outputs/systems.json')
