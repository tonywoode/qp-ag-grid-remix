import fs from 'fs'
import path from 'path'
import electron from '~/electron.server'

//loads the logger template from the correct location depending on environment
export function loadLoggerTemplate() {
  try {
    let templatePath
    
    if (process.env.NODE_ENV === 'development') {
      // In development, use the file at project root
      templatePath = path.join(__dirname, '../loggerConfig_template.json')
    } else {
      // In production, use the file from extraResources
      templatePath = path.join(process.resourcesPath, 'loggerConfig_template.json')
    }
    
    console.log('Loading logger template from:', templatePath)
    const templateData = fs.readFileSync(templatePath, 'utf-8')
    return JSON.parse(templateData)
  } catch (error) {
    console.error('FATAL: Failed to load logger template:', error)
    throw new Error(`Logger template file missing or invalid. This indicates a problem with the application installation.`)
  }
}