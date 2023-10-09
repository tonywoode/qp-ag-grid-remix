const sharedScores = {} // Initialize an object to store the scores

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

    const value1 = numbers1.reduce((acc, num, index) => acc + num / Math.pow(10, index), 0)
    const value2 = numbers2.reduce((acc, num, index) => acc + num / Math.pow(10, index), 0)

    return value2 - value1
  })
}

function sortFilenamesByCountryCodes(filenames, countryCodes) {
  function evaluateCountryCodes(filename, countryWeights) {
    let score = 0

    for (const code in countryWeights) {
      const regex = new RegExp(`\\((${code})\\)`, 'i')
      if (regex.test(filename)) score += countryWeights[code] * 3
    }

    for (const code1 in countryWeights) {
      for (const code2 in countryWeights) {
        if (code1 !== code2) {
          const regex = new RegExp(`\\((${code1}.*${code2})\\)`, 'i')
          if (regex.test(filename)) score += countryWeights[code1] + countryWeights[code2]
        }
      }
    }

    for (const code in countryWeights) {
      const regex = new RegExp(`\\((${code})[^${Object.keys(countryWeights).join('')}]*\\)`, 'i')
      if (regex.test(filename)) score += countryWeights[code] / 2
    }

    return score
  }

  return filenames.sort((filename1, filename2) => {
    const countryScore1 = evaluateCountryCodes(filename1, countryCodes)
    const countryScore2 = evaluateCountryCodes(filename2, countryCodes)

    sharedScores[filename1] = countryScore1 // Store the scores for later use
    sharedScores[filename2] = countryScore2

    return countryScore2 - countryScore1
  })
}

function sortFilenamesByStandardCodes(filenames) {
  const logAndReturn = (filename, score) => {
    //console.log(filename, score)
    return score
  }
  function evaluateStandardCodes(filename) {
    const priorityCodes = ['h', 'p', 'a', 'f', '!']
    const regex = /\[([^\]]+)\]/g
    const standardCodes = [...filename.matchAll(regex)].map(match => match[1])
    const hasBCode = standardCodes.some(code => /^b\d*$/.test(code))
    if (hasBCode) return -1 //deprioritize any and all [b*] entries
    if (standardCodes.length === 0) return logAndReturn(filename, sharedScores[filename]) //Return country score if no standard codes: i'd sooner try to run Batman (E) over Batman (J)[!]
    if (standardCodes.length === 1 && standardCodes[0].includes('!')) {
      const bestPossibleScore = 100 //if a [!] is on its own
      if (sharedScores[filename] > 0) return logAndReturn(filename, bestPossibleScore)
      else {
        const oneForArrayIndexOneToMakeItMoreImportant = 2
        const moreImportant = priorityCodes.indexOf('!') + oneForArrayIndexOneToMakeItMoreImportant
        return logAndReturn(filename, moreImportant)
      }
    }
    // having dealt with the best and worst cases, rate other individual standard codes
    let maxPriority = 0
    for (const standard of standardCodes) {
      for (const priority of priorityCodes) {
        if (standard.startsWith(priority)) {
          const priorityValue = priorityCodes.indexOf(priority) + 1
          if (priorityValue > maxPriority) {
            maxPriority = priorityValue
            if (sharedScores[filename] > 0) return maxPriority + sharedScores[filename]
          }
        }
      }
    }

    return logAndReturn(filename, maxPriority)
  }

  return filenames.sort((filename1, filename2) => {
    const standardScore1 = evaluateStandardCodes(filename1)
    const standardScore2 = evaluateStandardCodes(filename2)

    return standardScore2 - standardScore1
  })
}

export function chooseGoodMergeRom(filenames, countryCodes) {
  const sortedByNumberPriority = sortFilenamesByNumberPriority([...filenames])
  console.log('Sorted by number priority:', sortedByNumberPriority)
  const sortedByCountryCodes = sortFilenamesByCountryCodes(sortedByNumberPriority, countryCodes)
  console.log('Sorted by country codes:', sortedByCountryCodes)
  const sortedByStandardCodes = sortFilenamesByStandardCodes(sortedByCountryCodes)
  console.log('Sorted by Standard Codes:', sortedByStandardCodes)

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

/* updated version found at https://github.com/asfdfdfd/GoodCodes/blob/master/GoodCodes%20(U)%20%5B!%5D.txt
see also https://emulation.gametechwiki.com/index.php/GoodTools
or the subtely different: https://en-academic.com/dic.nsf/enwiki/400631
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
