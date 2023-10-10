const fs = require('fs').promises

/**
 * Consider that some people remove all temp dirs on their system, either you can rename your extraction dir, or try this...
 */
export async function createDirIfNotExist(dirPath: string) {
  const fnName = createDirIfNotExist.name
  try {
    const stats = await fs.stat(dirPath)
    if (stats.isDirectory()) console.log(`extraction Dir: ${dirPath}`)
    else console.error(`${fnName}: ${dirPath} exists but is not a dir`)
  } catch (error) {
    if (error.code === 'ENOENT') {
      try {
        await fs.mkdir(dirPath, { recursive: true })
        console.log(`${fnName}: Dir ${dirPath} didn't preexist: created successfully`)
      } catch (mkdirError) {
        console.error(`${fnName}: Error creating dir: ${mkdirError}`)
      }
    } else console.error(`${fnName}: Error accessing dir: ${error}`)
  }
}
