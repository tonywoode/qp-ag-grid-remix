const countryMap = {
  //TODO: do I need this in the backend at all?
  J: 'Japan & Korea',
  A: 'Australia',
  B: 'non USA (Genesis)',
  C: 'China',
  E: 'Europe',
  F: 'France',
  //removed F: 'World (Genesis)', - deal with it below
  G: 'Germany',
  GR: 'Greece',
  HK: 'Hong Kong',
  H: 'Holland',
  FC: 'French Canadian',
  FN: 'Finland',
  I: 'Italy',
  K: 'Korea',
  NL: 'Netherlands',
  PD: 'Public Domain',
  S: 'Spain',
  SW: 'Sweden',
  U: 'USA',
  UK: 'England',
  Unk: 'Unknown Country',
  Unl: 'Unlicensed'
}

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

function evaluateStandardCodes(filename) {
  const priorityCodes = ['!', 'f', 'a', 'p', 'h']

  // Extract standard codes from the filename
  const standardCodes = filename.match(/\[.\]/g)

  // Check if the filename contains any of the priority codes
  for (const code of priorityCodes) {
    if (standardCodes && standardCodes.includes(`[${code}]`)) {
      return priorityCodes.indexOf(code) + 1 // Return priority level (1 for highest, 5 for lowest)
    }
  }

  // If none of the priority codes are found, check if 'b' is the only option
  if (!standardCodes || (standardCodes.length === 1 && standardCodes[0] === '[b]')) {
    return 6 // Return a low priority level for 'b'
  }

  return 0 // Return 0 if none of the priority conditions are met
}

export function chooseGoodMergeRom(filenames, countryCodes) {
  const filesByCountryScore = new Set()

  for (const filename of filenames) {
    const countryScore = evaluateCountryCodes(filename, countryCodes)
    filesByCountryScore.add({ [filename]: countryScore })
  }
  console.log(`filesByCountryScore`, filesByCountryScore)

  // for (const filename of filenames) {
  let bestScore = -1
  let bestFilename = null
  //   const countryScore = evaluateCountryCodes(filename, countryCodes)
  //   filesByCountryScore.add({ [filename]: countryScore })

  //   const standardScore = evaluateStandardCodes(filename)
  //   // Combine scores (e.g., using weighted averages if needed)
  //   const combinedScore = countryScore + standardScore

  //   if (combinedScore > bestScore) {
  //     bestScore = combinedScore
  //     bestFilename = filename
  //   }
  // }

  //   return bestFilename
}

// Example usage
// const filenames = ['rom_Japan_A!.rom', 'rom_Australia.rom', 'rom_Europe_T.rom', 'rom_Unknown.rom']
// const countryCodes = ['A', 'U', 'GR']
// const standardCodes = ['!', 'T', 'p']

// const chosenRom = chooseFittingRom(filenames, countryCodes, standardCodes)
// console.log(chosenRom)

/*
               ..................
...............: STANDARD CODES ::...............
:                                               :\
:   [a] Alternate        [p] Pirate             :\
:   [b] Bad Dump         [t] Trained            :\
:   [f] Fixed            [T] Translation        :\
:   [h] Hack             (-) Unknown Year       :\
:   [o] Overdump         [!] Verified Good Dump :\
:  (M#) Multilanguage (# of Languages)          :\
: (###) Checksum       (??k) ROM Size           :\
:  ZZZ_ Unclassified   (Unl) Unlicensed		:\
:   (-) Unknown Year                            :\
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
: .-----Genesis-----.  [ (PAL) Euro  Version  ] :\
: [ (1) Japan       ]  `----------------------' :\
: [ (4) USA         ]  .-----Thomson MO5------. :\
: [ (5) NTSC Only   ]  [ (Y) Year unknown     ] :\
: [ (8) PAL Only    ]  `----------------------' :\
: [ (B) non USA     ]  .--------Coleco--------. :\
: [ [c] Checksum    ]  [ (Adam) ADAM Version  ] :\
: [ [x] Bad Checksum]  `----------------------' :\
: [ [R-] Countries  ]                           :\
: `-----------------'                           :\
:                      .-------Nintendo-------. :\
: .--NeoGeo Pocket--.  [ (PC10) PlayChoice 10 ] :\
: [ [M] Mono Only   ]  [   (VS) Versus        ] :\
: `-----------------'  `----------------------' :\
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
:   (F) World (Genesis)                         :\
:  (FC) French Canadian   (SW) Sweden           :\
:  (FN) Finland            (U) USA              :\
:   (G) Germany           (UK) England          :\
:  (GR) Greece           (Unk) Unknown Country  :\
:  (HK) Hong Kong          (I) Italy		:\
:  (H)  Holland          (Unl) Unlicensed       :\
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
: Visit #rareroms on NewNet in IRC!             :\ 
:...............................................:\
 \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
*/
