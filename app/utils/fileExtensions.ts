// unordered list of archive filetypes (from 7Zips homepage) that we'll support
export const sevenZipFileExtensions = [
  '.7z',
  '.bzip2',
  '.dmg',
  '.gzip',
  '.lzma',
  '.rar',
  '.rar5',
  '.tar',
  '.xar',
  '.zip',
  '.zipx'
]

/**
 * Decodes Delphi-style hex-encoded TStringList compression support strings
 * from emulators.json Compression field
 */
export function decodeCompressionSupport(hexString: string) {
  // Return empty object for empty strings
  if (!hexString) return { zip: false, rar: false, ace: false, '7z': false };
  
  try {
    // Convert hex to ASCII
    const bytes = [];
    for (let i = 0; i < hexString.length; i += 2) {
      bytes.push(parseInt(hexString.substr(i, 2), 16));
    }
    const text = String.fromCharCode(...bytes);
    
    // Parse the key-value pairs
    const result = {
      zip: false,
      rar: false,
      ace: false,
      '7z': false
    };
    
    // Split by line breaks and process each line
    text.split(/\r\n/).forEach(line => {
      if (!line) return;
      
      const [key, value] = line.split('=');
      if (!key || value === undefined) return;
      
      // Extract the extension name without the dot
      const extName = key.startsWith('.') ? key.substring(1) : key;
      
      // In Delphi, -1 or "True" means true
      const isSupported = value === '-1' || value.toLowerCase() === 'true';
      
      // Add to result if it's one of our tracked formats
      if (extName === 'zip' || extName === 'rar' || extName === 'ace' || extName === '7z') {
        result[extName] = isSupported;
      }
    });
    
    return result;
  } catch (e) {
    console.error('Error decoding compression support:', e);
    return { zip: false, rar: false, ace: false, '7z': false };
  }
}
