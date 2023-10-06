function extractCodes(filename) {
  const regex = /\[([^\]]+)\]/g
  return [...filename.matchAll(regex)].map(match => match[1])
}

function sortFilenamesByNumberPriority(filenames) {
  return filenames.sort((filename1, filename2) => {
    function extractNumbers(filename) {
      const regex = /\d+/g
      return (filename.match(regex) || []).map(Number)
    }

    const numbers1 = extractNumbers(filename1)
    const numbers2 = extractNumbers(filename2)

    //we need to account for things like [h#+#C] e.g.: [f1+2C], idea was to treat as decimal incrememnts
    // the logic might actually hold in the face of the range!
    const value1 = numbers1.reduce((acc, num, index) => acc + num / Math.pow(10, index), 0)
    const value2 = numbers2.reduce((acc, num, index) => acc + num / Math.pow(10, index), 0)

    return value2 - value1
  })
}

function sortFilenamesBySpecialCodes(filenames) {
  const priorityOrder = { '!': 0, p: 1, a: 2, f: 3, h: 4 }

  return filenames.sort((filename1, filename2) => {
    const getPriority = code => priorityOrder[code[1]] || 5
    const code1 = extractCodes(filename1)
    const code2 = extractCodes(filename2)

    return getPriority(code1) - getPriority(code2)
  })
}

/*
* highest weighting given to finding the countrycode on its own 
* second run where we try and match a combination of codes, slightly lower weighting since lower confidence that its a combo of our choices
* third run with even lower weighting seeking just one of our countrycodes accompanied by other chars that might represent country codes that we did not choose (this still might be the best-choice rom) 
*/
function sortFilenamesByCountryCodes(filenames, countryCodes) {
  function evaluateCountryCodes(filename, countryWeights) {
    if (filename.includes('(F)') && filename.includes('Genesis')) fallbacks.push('F')
    console.log(`looking for matching countrycodes:,`, { filename })
    let score = 0
    // Stage 1: Highest priority - Exact match of country codes in parentheses
    for (const code in countryWeights) {
      const regex = new RegExp(`\\((${code})\\)`, 'i')

      if (regex.test(filename)) {
        console.log(`   stage 1 matched:`, code, `with`, regex, `assigning score:`, countryWeights[code] * 3)
        score += countryWeights[code] * 3 // Higher weight for exact matches
      }
    }

    // Stage 2: Combination of codes in parentheses
    for (const code1 in countryWeights) {
      for (const code2 in countryWeights) {
        if (code1 !== code2) {
          const regex = new RegExp(`\\((${code1}.*${code2})\\)`, 'i')
          if (regex.test(filename)) {
            console.log( `    stage 2 matched:`, code1, `and`, code2, `with`, regex, `assigning score:`, countryWeights[code1] + countryWeights[code2]) // prettier-ignore
            score += countryWeights[code1] + countryWeights[code2]
          }
        }
      }
    }

    // Stage 3: Single code with other characters in parentheses
    for (const code in countryWeights) {
      const regex = new RegExp(`\\((${code})[^${Object.keys(countryWeights).join('')}]*\\)`, 'i')
      if (regex.test(filename)) {
        console.log(`   stage 3 matched:`, code, `with`, regex, `assigning score:`, countryWeights[code] / 2)
        score += countryWeights[code] / 2 // Lower weight for potential matches
      }
    }
    console.log(` final country score:`, [filename, score])
    //if the score is less than 3

    return score
  }

  return filenames.sort((filename1, filename2) => {
    const countryScore1 = evaluateCountryCodes(filename1, countryCodes)
    const countryScore2 = evaluateCountryCodes(filename2, countryCodes)

    return countryScore2 - countryScore1
  })
}

function sortFilenamesByStandardCodes(filenames) {
  function evaluateStandardCodes(filename) {
    const priorityCodes = ['h', 'p', 'a', 'f', '!']
    const regex = /\[([^\]]+)\]/g
    const standardCodes = [...filename.matchAll(regex)].map(match => match[1])

    if (standardCodes.length === 1 && standardCodes[0].includes('!')) {
      return 100 // Return the highest priority for [!]
    }

    let maxPriority = 0

    for (const standard of standardCodes) {
      for (const priority of priorityCodes) {
        if (standard.startsWith(priority)) {
          if (priority === '!') {
            return 15
          } else {
            const priorityValue = priorityCodes.indexOf(priority) + 1
            if (priorityValue > maxPriority) {
              maxPriority = priorityValue
            }
          }
        }
      }
    }

    return maxPriority
  }

  return filenames.sort((filename1, filename2) => {
    const standardScore1 = evaluateStandardCodes(filename1)
    const standardScore2 = evaluateStandardCodes(filename2)

    return standardScore2 - standardScore1
  })
}

function chooseGoodMergeRom(filenames, countryCodes) {
  const sortedByNumberPriority = sortFilenamesByNumberPriority([...filenames])
  console.log('Sorted by number priority:')
  console.log(sortedByNumberPriority)
  const sortedBySpecialCodes = sortFilenamesBySpecialCodes(sortedByNumberPriority)
  console.log('Sorted by special codes:')
  console.log(sortedBySpecialCodes)
  const sortedByCountryCodes = sortFilenamesByCountryCodes(sortedBySpecialCodes, countryCodes)
  console.log('Sorted by country codes:')
  console.log(sortedByCountryCodes)
  const sortedByStandardCodes = sortFilenamesByStandardCodes(sortedByCountryCodes)
  console.log('Sorted by Standard Codes:')
  console.log(sortedByStandardCodes)

  return sortedByStandardCodes[0]
}

// Example usage
const filenames = [
  'After Burner II (J) [!].gen',
  'After Burner II (J) [h1C].gen',
  'After Burner II (J) [p1][!].gen',
  'After Burner II (J) [p2][!].gen',
  'After Burner II (UE) [!].gen',
  'After Burner II (UE) [b1].gen',
  'After Burner II (UE) [b2].gen',
  'After Burner II (UE) [h1C].gen',
  'After Burner II (UE) [h2C].gen',
  'After Burner II (UE) [h3C].gen',
  'After Burner II (UE) [h4C].gen',
  'After Burner II (UE) [h5C].gen',
  'After Burner II (UE) [T+Por].gen'
]

const fallbackCountryCodes = { PD: 1, Unl: 2, Unk: 3 }
const countryCodePrefs = { B: 4, A: 5, 4: 6, U: 7, W: 8, E: 9, UK: 10 }
const countryCodes = { ...fallbackCountryCodes, ...countryCodePrefs }
const pickedRom = chooseGoodMergeRom(filenames, countryCodes)
console.log(`computer picked this rom:`, pickedRom)

/* first attempt with only two sorts
function extractCodes(filename) {
  const regex = /\[([^\]]+)\]/g
  return [...filename.matchAll(regex)].map(match => match[1])
}

function sortFilenamesByNumberPriority(filenames) {
  return filenames.sort((filename1, filename2) => {
    const codes1 = extractCodes(filename1)
    const codes2 = extractCodes(filename2)

    function extractNumber(code) {
      const match = code.match(/\d+/)
      return match ? parseInt(match[0]) : -1
    }

    const number1 = Math.max(...codes1.map(code => extractNumber(code)))
    const number2 = Math.max(...codes2.map(code => extractNumber(code)))

    return number2 - number1
  })
}

function chooseGoodMergeRom(filenames, countryCodes) {
  const priorityCodes = ['!', 'p', 'a', 'f', 'h'] // Priority order: ! > p > a > f > h

  function evaluateCountryCodes(filename, countryWeights) {
    let score = 0

    for (const code in countryWeights) {
      const regex = new RegExp(`\\((${code})\\)`, 'i')

      if (regex.test(filename)) {
        score += countryWeights[code] * 3 // Higher weight for exact matches
      }
    }

    for (const code1 in countryWeights) {
      for (const code2 in countryWeights) {
        if (code1 !== code2) {
          const regex = new RegExp(`\\((${code1}.*${code2})\\)`, 'i')
          if (regex.test(filename)) {
            score += countryWeights[code1] + countryWeights[code2]
          }
        }
      }
    }

    for (const code in countryWeights) {
      const regex = new RegExp(`\\((${code})[^${Object.keys(countryWeights).join('')}]*\\)`, 'i')
      if (regex.test(filename)) {
        score += countryWeights[code] / 2 // Lower weight for potential matches
      }
    }

    return score
  }

  function evaluateStandardCodes(filename) {
    const standardCodes = extractCodes(filename)
    let standardScore = 0
    let foundAnExclamationMark = false
    let alreadyParsedAnotherCodeThatWasntExclamationMark = false
    let highestFCode = 0

    for (const standard of standardCodes) {
      for (const priority of priorityCodes) {
        if (standard.startsWith(priority)) {
          if (priority === '!') {
            foundAnExclamationMark = true
          } else {
            alreadyParsedAnotherCodeThatWasntExclamationMark = true
          }

          if (foundAnExclamationMark && priority.startsWith('f')) {
            const fixedNum = priority.replace('f', '')
            if (typeof fixedNum === 'number' && fixedNum > highestFCode) highestFCode = fixedNum
            if (highestFCode !== 0) standardScore += highestFCode
          }

          if (priority.startsWith('!') && !alreadyParsedAnotherCodeThatWasntExclamationMark) {
            standardScore = +15
          } else {
            standardScore += priorityCodes.indexOf(priority) + 1
          }
        }
      }
    }

    return standardScore
  }

  const sortedByNumberPriority = sortFilenamesByNumberPriority([...filenames])
  const sortedByStandardCodes = sortedByNumberPriority.sort(
    (a, b) => evaluateStandardCodes(b) - evaluateStandardCodes(a)
  )
  const sortedByCountryCodes = sortedByStandardCodes.sort(
    (a, b) => evaluateCountryCodes(b, countryCodes) - evaluateCountryCodes(a, countryCodes)
  )

  return sortedByCountryCodes[0] // Return the most matching ROM
}

// Example usage
const fallbackCountryCodes = { PD: 1, Unl: 2, Unk: 3 }
const countryCodePrefs = { B: 4, A: 5, 4: 6, U: 7, W: 8, E: 9, UK: 10 }
const countryCodes = { ...fallbackCountryCodes, ...countryCodePrefs }
const pickedRom = chooseGoodMergeRom(filenames, countryCodes)
console.log(`computer picked this rom:`, pickedRom)
*/

/* INDIVIDUAL FNS
// Priority sorting function for standard codes
function prioritySort(a, b) {
  const priorityOrder = ['!', 'a', 'f', 'p', 'h']

  const aPriority = priorityOrder.indexOf(a[0])
  const bPriority = priorityOrder.indexOf(b[0])

  if (aPriority !== -1 && bPriority !== -1) {
    return aPriority - bPriority
  }

  if (aPriority !== -1) return -1
  if (bPriority !== -1) return 1

  return 0
}

// Example usage
const filenames = [
  'Adventures of Batman and Robin, The (U) [p1][!].gen',
  'Adventures of Batman and Robin, The (U) [p2][!].gen',
  'Adventures of Batman and Robin, The (U) [!].gen',
  'Adventures of Batman and Robin, The (U) [f1].gen',
  'Adventures of Batman and Robin, The (U) [f2+C].gen',
  'Adventures of Batman and Robin, The (U) [f1+2C].gen',
  'Adventures of Batman and Robin, The (U) [f1+1C].gen',
  'Adventures of Batman and Robin, The (U) [f2].gen',
  'Adventures of Batman and Robin, The (U) [b4].gen',
  'Adventures of Batman and Robin, The (U) [b3].gen',
  'Adventures of Batman and Robin, The (U) [b2].gen',
  'Adventures of Batman and Robin, The (U) [b1].gen'
]

const sortedFilenames = [...filenames].sort(prioritySort)

console.log(sortedFilenames)

// Region sorting function
function regionSort(a, b) {
  const regionOrder = ['E', 'U', 'J', 'A', 'B', 'C', 'F', 'G', 'H', 'I', 'K', 'NL', 'S', 'Sw', 'PD', 'Unk', 'Unl']

  const aRegion = a.match(/\(([^)]+)\)/)[1]
  const bRegion = b.match(/\(([^)]+)\)/)[1]

  const aPriority = regionOrder.indexOf(aRegion)
  const bPriority = regionOrder.indexOf(bRegion)

  return aPriority - bPriority
}

// Example usage
const sortedByRegion = sortedFilenames.sort(regionSort)

console.log(sortedByRegion)

// ! sorting function
function exclamationSort(a, b) {
  const aHasExclamation = /\[!\]/.test(a)
  const bHasExclamation = /\[!\]/.test(b)

  if (aHasExclamation && !bHasExclamation) {
    return -1
  } else if (!aHasExclamation && bHasExclamation) {
    return 1
  } else {
    return 0
  }
}

// Example usage
const sortedByExclamation = sortedByRegion.sort(exclamationSort)

console.log(sortedByExclamation)

// Incrementing number sorting function
function numberSort(a, b) {
  const getNumbers = filename => {
    const matches = /\[(\d+)\]/g
    const numbers = []
    let match
    while ((match = matches.exec(filename))) {
      numbers.push(parseInt(match[1], 10))
    }
    return numbers
  }

  const numbersA = getNumbers(a)
  const numbersB = getNumbers(b)

  if (numbersA.length > 0 && numbersB.length > 0) {
    // Sort in descending order, as you mentioned higher numbers should have higher priority
    return numbersB[numbersB.length - 1] - numbersA[numbersA.length - 1]
  } else if (numbersA.length > 0) {
    return -1
  } else if (numbersB.length > 0) {
    return 1
  } else {
    return 0
  }
}

// Example usage
const sortedByNumbers = sortedByRegion.sort(numberSort)

console.log(sortedByNumbers)

function sortFilenamesByNumberPriority(filenames) {
  return filenames.sort((filename1, filename2) => {
    const codes1 = extractCodes(filename1)
    const codes2 = extractCodes(filename2)

    // Function to extract the number from the code
    function extractNumber(code) {
      const match = code.match(/\d+/)
      return match ? parseInt(match[0]) : -1 // Default to -1 if no number found
    }

    const number1 = Math.max(...codes1.map(code => extractNumber(code)))
    const number2 = Math.max(...codes2.map(code => extractNumber(code)))

    return number2 - number1 // Sort in descending order
  })
}
const numberSortedFilenames = sortFilenamesByNumberPriority(filenames)
console.log(numberSortedFilenames)
*/

//OLD CODE not based on sorting arrays
// const countryMap = {
//   //TODO: do I need this in the backend at all?
//   J: 'Japan & Korea',
//   A: 'Australia',
//   B: 'non USA (Genesis)',
//   C: 'China',
//   E: 'Europe',
//   F: 'France',
//   //removed F: 'World (Genesis)', - deal with it below
//   G: 'Germany',
//   GR: 'Greece',
//   HK: 'Hong Kong',
//   H: 'Holland',
//   FC: 'French Canadian',
//   FN: 'Finland',
//   I: 'Italy',
//   K: 'Korea',
//   NL: 'Netherlands',
//   PD: 'Public Domain',
//   S: 'Spain',
//   SW: 'Sweden',
//   U: 'USA',
//   UK: 'England',
//   Unk: 'Unknown Country',
//   Unl: 'Unlicensed'
// }

// function evaluateCountryCodes(filename, countryWeights) {
//   if (filename.includes('(F)') && filename.includes('Genesis')) fallbacks.push('F')
//   console.log(`looking for matching countrycodes:,`, { filename })
//   let score = 0
//   // Stage 1: Highest priority - Exact match of country codes in parentheses
//   for (const code in countryWeights) {
//     const regex = new RegExp(`\\((${code})\\)`, 'i')

//     if (regex.test(filename)) {
//       console.log(`   stage 1 matched:`, code, `with`, regex, `assigning score:`, countryWeights[code] * 3)
//       score += countryWeights[code] * 3 // Higher weight for exact matches
//     }
//   }

//   // Stage 2: Combination of codes in parentheses
//   for (const code1 in countryWeights) {
//     for (const code2 in countryWeights) {
//       if (code1 !== code2) {
//         const regex = new RegExp(`\\((${code1}.*${code2})\\)`, 'i')
//         if (regex.test(filename)) {
//           console.log( `    stage 2 matched:`, code1, `and`, code2, `with`, regex, `assigning score:`, countryWeights[code1] + countryWeights[code2]) // prettier-ignore
//           score += countryWeights[code1] + countryWeights[code2]
//         }
//       }
//     }
//   }

//   // Stage 3: Single code with other characters in parentheses
//   for (const code in countryWeights) {
//     const regex = new RegExp(`\\((${code})[^${Object.keys(countryWeights).join('')}]*\\)`, 'i')
//     if (regex.test(filename)) {
//       console.log(`   stage 3 matched:`, code, `with`, regex, `assigning score:`, countryWeights[code] / 2)
//       score += countryWeights[code] / 2 // Lower weight for potential matches
//     }
//   }
//   console.log(` final country score:`, [filename, score])
//   //if the score is less than 3

//   return score
// }

// function evaluateStandardCodes(filename) {
//   const priorityCodes = ['h', 'p', 'a', 'f', '!']
//   const regex = /\[([^\]]+)\]/g
//   const standardCodes = [...filename.matchAll(regex)].map(match => match[1])
//   console.log(`standardCodes`, standardCodes)
//   // Check if the filename contains any of the priority codes
//   let standardScore = 0
//   let foundAnExclamationMark = false
//   let alreadyParsedAnotherCodeThatWasntExclamationMark = false
//   let highestFCode = 0
//   for (const standard of standardCodes) {
//     for (const priority of priorityCodes) {
//       if (standard.startsWith(priority)) {
//         console.log(`Standard code '${standard}' starts with priority character '${priority}'`)
//         if (priority === '!') {
//           foundAnExclamationMark = true
//         } else {
//           alreadyParsedAnotherCodeThatWasntExclamationMark = true
//         }
//         //goal here is to bump up priority of a ! plus f*, where the higest f number will get run
//         // I think all other standard codes don't have this effect, a single ! SHOULD trump everything otherwise
//         if (foundAnExclamationMark && priority !== '!') {
//           //we already found our !, let's hope all roms put this FIRST - NO data shows they dont: 'Alisia Dragoon (U) [p1][!].gen', but maybe that doesn't matter here?
//           if (priority.startsWith('f')) {
//             // Find the highest number following [f]
//             const fixedNum = priority.replace('f', '')
//             if (typeof fixedNum === 'number') {
//               if (fixedNum > highestFCode) highestFCode = fixedNum
//             }
//             if (highestFCode !== 0) {
//               standardScore += highestFCode
//             }
//           }
//         }
//         //if the priroty code is a !, make it really important
//         if (priority.startsWith('!') && !alreadyParsedAnotherCodeThatWasntExclamationMark) {
//           standardScore = +15
//         } else {
//           standardScore += priorityCodes.indexOf(priority) + 1
//         }
//       }
//     }
//   }
//   //and then its what to do about the multiplier: ultimately i'd rather run a (J)[!] than an (E)[*], we want to priorise anything that will work,
//   // and so ! trumps everything, but we need to check firstly if we have a rom from a region we WANT that has a !,
//   // and secondly if we've a fixed rom (from the region we want) that's a !
//   // If none of the priority codes are found, check if 'b' is the only option
//   // [update] do we need this anymore? If there's only one rom, it'll get run, hmm...but if the choices are all [b] we still want to pick the most fitting
//   // if (!standardCodes || (standardCodes.length === 1 && standardCodes[0] === '[b]')) {
//   //   return 6 // Return a low priority level for 'b'
//   // }
//   return standardScore // Return 0 if none of the priority conditions are met
// }

// export function chooseGoodMergeRom(filenames, countryCodes) {
//   const filesByCountryScore = new Set()
//   for (const filename of filenames) {
//     const countryScore = evaluateCountryCodes(filename, countryCodes)
//     filesByCountryScore.add({ [filename]: countryScore })
//   }
//   console.log(`filesByCountryScore`, filesByCountryScore)

//   for (const filename of filenames) {
//     const standardScore = evaluateStandardCodes(filename)
//     console.log(`standardScore`, { filename, standardScore })
//   }
//   // for (const filename of filenames) {
//   let bestScore = -1
//   let bestFilename = null
//   //   const countryScore = evaluateCountryCodes(filename, countryCodes)
//   //   filesByCountryScore.add({ [filename]: countryScore })

//   //   const standardScore = evaluateStandardCodes(filename)
//   //   // Combine scores (e.g., using weighted averages if needed)
//   //   const combinedScore = countryScore + standardScore

//   //   if (combinedScore > bestScore) {
//   //     bestScore = combinedScore
//   //     bestFilename = filename
//   //   }
//   // }

//   //   return bestFilename
// }

// Example usage
// const filenames = ['rom_Japan_A!.rom', 'rom_Australia.rom', 'rom_Europe_T.rom', 'rom_Unknown.rom']
// const countryCodes = ['A', 'U', 'GR']
// const standardCodes = ['!', 'T', 'p']

// const chosenRom = chooseFittingRom(filenames, countryCodes, standardCodes)
// console.log(chosenRom)

/* updated version found at https://github.com/asfdfdfd/GoodCodes/blob/master/GoodCodes%20(U)%20%5B!%5D.txt
see also https://emulation.gametechwiki.com/index.php/GoodTools
..................
...............: STANDARD CODES ::...............
:                                               :\
:   [a?] Alternate       [p?] Pirate            :\
:   [b?] Bad Dump        [t?] Trained           :\
:   [f?] Fixed           [T-] OldTranslation    :\
:   [o?] Overdump        [T+] NewerTranslation  :\
:   [h?] Hack            (-) Unknown Year       :\
:   [!p] Pending Dump    [!] Verified Good Dump :\
:  (M#) Multilanguage (# of Languages)          :\
: (###) Checksum       (??k) ROM Size           :\
:                      (Unl) Unlicensed         :\
:...............................................:\
 \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

                .................
................: SPECIAL CODES ::...............
:                                               :\
: .-----Gameboy-----.  .----Super Nintendo----. :\
: [  [C] Color      ]  [ (BS) BS ROMs         ] :\
: [  [S] Super      ]  [ (ST) Sufami Turbo    ] :\
: [ [BF] Bung Fix   ]  [ (NP) Nintendo Power  ] :\
: `-----------------'  `----------------------' :\
:                      .--------Atari---------. :\
: .-----Genesis-----.  [ (PAL) Euro Version   ] :\
: [ (1) Japan       ]  `----------------------' :\
: [ (4) USA         ]  .---------GBA----------. :\
: [ (5) NTSC Only   ]  [ [hI??] Intro hacks   ] :\
: [ [R-] Countries  ]  [ [f_?] EEPROMV124 fix ] :\
: [ (8) PAL Only    ]  `----------------------' :\
: [ (B) non USA     ]  .--------Coleco--------. :\
: [ [c] Checksum    ]  [ (Adam) ADAM Version  ] :\
: [ [x] Bad Checksum]  `----------------------' :\
: `-----------------'                           :\
:                      .--------NES/FC--------. :\
: .--NeoGeo Pocket--.  [ (PC10) PlayChoice 10 ] :\
: [ [M] Mono Only   ]  [   (VS) Versus        ] :\
: `-----------------'  [ [hFFE] FFE Copier fmt] :\
:                      `----------------------' :\
:...............................................:\
 \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

                .................
................: COUNTRY CODES ::...............
:                                               :\
:   (1) Japan & Korea      (4) USA & BrazilNTSC :\
:   (A) Australia          (J) Japan            :\
:   (B) non USA (Genesis)  (K) Korea            :\
:   (C) China             (NL) Netherlands      :\
:   (E) Europe            (PD) Public Domain    :\
:   (F) France             (S) Spain            :\
:  (FC) French Canadian   (Sw) Sweden           :\
:  (FN) Finland            (U) USA              :\
:   (G) Germany           (UK) England          :\
:  (GR) Greece           (Unk) Unknown Country  :\
:  (HK) Hong Kong          (I) Italy		:\
:  (D)  Dutch            (Unl) Unlicensed       :\
:...............................................:\
 \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

             .......................
.............: STANDARD CODE NOTES ::............
:                                               :\
: [a] This is simply an alternate version of a  :\
:     ROM. Many games have been re-released to  :\
:     fix bugs or even to eliminate Game Genie  :\
:     codes (Yes, Nintendo hates that device).  :\
:             -------------------               :\
: [b] A bad dump often occurs with an older     :\
:     game or a faulty dumper (bad connection). :\
:     Another common source of [b] ROMs is a    :\
:     corrupted upload to a release FTP.        :\
:             -------------------               :\
: [f] A fixed game has been altered in some way :\
:     so that it will run better on a copier    :\
:     or emulator.                              :\
:             -------------------               :\
: [h] Something in this ROM is not quite as it  :\
:     should be. Often a hacked ROM simply has  :\
:     a changed header or has been enabled to   :\
:     run in different regions. Other times it  :\
:     could be a release group intro, or just   :\
:     some kind of cheating or funny hack.      :\
:             -------------------               :\
: [o] An overdumped ROM image has more data     :\
:     than is actually in the cart. The extra   :\
:     information means nothing and is removed  :\
:     from the true image.                      :\
:             -------------------               :\
: [t] A trainer is special code which executes  :\
:     before the game is begun. It allows you   :\
:     to access cheats from a menu.             :\
:             -------------------               :\
: [!] Verified good dump. Thank God for these!  :\
:...............................................:\
 \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

             ......................
.............: SPECIAL CODE NOTES ::.............
:                                               :\
: **** SNES ****                                :\
: (BS) These Japanese ROMs were distributed     :\
:      through a satellite system in Japan      :\
:      known as the Broadcast Satellaview.      :\
:      They were transmitted along with a TV    :\
:      show which was connected to the game in  :\
:      some way. These games were only playable :\
:      during the show, and thus stop after an  :\
:      hour, and many were timed so that only   :\
:      certain time periods were playable.      :\
:             -------------------               :\
: (ST) The Sufami Turbo device allowed two      :\
:      GameBoy sized carts to be plugged into   :\
:      the SNES. Certain carts combined into    :\
:      new games much like the Sonic & Knuckles :\
:      lock-on technology by Sega.              :\
:             -------------------               :\
: (NP) Nintendo Power has been known to release :\
:      games only available to its subscribers. :\
:      Most of these ROMs are Japanese, as this :\
:      practice occured mainly in Japan.        :\
:             -------------------               :\
:                                               :\
: **** Genesis ****                             :\
:  (1) Carts with this code will run on both    :\
:      Japanese and Korean machines.            :\
:             -------------------               :\
:  (4) While this code is technically the same  :\
:      as a (U) code, it is a newer header      :\
:      format and represents that the cart will :\
:      run on USA and Brazil NTSC machines.     :\
:             -------------------               :\
:  (B) This country code indicates that the     :\
:      cart will run on any non US machine.     :\
:             -------------------               :\
:  [c] This code represents a cart with known   :\
:      faulty checksum routines.                :\
:             -------------------               :\
:                                               :\
: **** GameBoy ****                             :\
: [BF] Bung released a programmable cartridge   :\
:      compatable with the GameBoy which could  :\
:      hold any data you wished to play.        :\
:      However, many games do not function on   :\
:      Bung v1.0 carts and have to be 'fixed.'  :\
:             -------------------               :\
:                                               :\
: **** Nintendo ****                            :\
: PC10 The PlayChoice 10 was an arcade unit     :\
:      which played exact copies of NES games   :\
:      in an arcade cabinet. The machines had a :\
:      choice of 10 games to choose from and    :\
:      ran for about 3 minutes on 25 cents.     :\
:             -------------------               :\
:                                               :\
:   VS The Versus system ran on similar hard-   :\
:      ware to the PC10 machines, but simply    :\
:      allowed you to play against each other.  :\
:...............................................:\
 \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

                   ...........
...................: Credits ::..................
:                                               :\
: Document written by Psych0phobiA / q^-o|o-^p  :\
:                                               :\
: All codes developed by Cowering for the       :\
: Goodxxxx series ROM file renaming utilities.  :\
:                                               :\
: Visit #rareroms on UnitedUsers in IRC!        :\ 
:                                               :\
: Document version: 1.0.0                       :\
:...............................................:\
 \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
*/
