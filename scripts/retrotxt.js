// filename: retrotxt.js
// These functions are used to apply and remove RetroTxt from browser tabs.
"use strict"

// For this to work using the chrome.management.getSelf() method in this page.
// Retrotxt requires the Management permission but which is currently not requested.
var RetroTxt = { developer: false, dump: false }
//<link rel="stylesheet" href="css/text_animation-off.css">
/**
 * Document Object Model (DOM) programming interface for HTML.
 * @class DOM
 */
class DOM {
  /**
   * Creates an instance of DOM.
   * @param [ecma48={}] ANSI data object
   * @param [palette=new HardwarePalette()] Colour palette object
   */
  constructor(ecma48 = {}, palette = new HardwarePalette()) {
    this.body = document.body
    this.cssLink = document.getElementById(`retrotxt-styles`)
    this.head = document.querySelector(`head`)
    this.headers = document.getElementsByTagName(`header`)
    this.iceColors = null
    this.main = document.querySelector(`main`)
    this.pre0 = document.getElementsByTagName(`pre`)[0]
    this.pre1 = document.getElementsByTagName(`pre`)[1]
    this.preCount = document.getElementsByTagName(`pre`).length
    this.storage = [
      `customBackground`,
      `customForeground`,
      `lineHeight`,
      `retroColor`,
      `retroFont`,
      `textBgScanlines`,
      `textBlinkAnimation`,
      `textCenterAlignment`,
      `textEffect`
    ]
    // parameters
    this.ecma48 = ecma48
    this.palette = palette
    // local storage results
    this.results
    this.backgroundColor = ``
  }
  /**
   * Constructs the Document Object Model needed to display RetroTxt.
   */
  async construct() {
    // build link tags
    const palette = new HardwarePalette()
    // make a <link> to point to the CSS for use with 1-bit colour themes (ASCII, NFO)
    // child 0
    this.head.appendChild(CreateLink(`../css/retrotxt.css`, `retrotxt-styles`))
    // child 1
    this.head.appendChild(CreateLink(`../css/layout.css`, `retrotxt-layout`))
    // make a <link> to point to the CSS for use with 1-bit colour themes (ASCII, NFO)
    // child 2
    this.head.appendChild(
      CreateLink(`../css/text_colors.css`, `retrotxt-theme`)
    )
    // load any CSS that are used to mimic colours by the text file
    let format
    if (typeof qunit === `undefined`) {
      if (typeof this.pre1 === `undefined`)
        format = FindControlSequences(this.pre0.textContent)
      else format = FindControlSequences(this.pre1.textContent)
    }
    // make <link> tags to point to CSS files for use with 4-bit colour text
    switch (format) {
      case `ecma48`:
        // child 2
        this.head.appendChild(
          CreateLink(palette.savedFilename(), `retrotxt-4bit`)
        )
        // child 3
        this.head.appendChild(
          CreateLink(`../css/text_colors_8bit.css`, `retrotxt-8bit`)
        )
        // child 4
        this.head.appendChild(CreateLink(`../css/text_ecma_48.css`, `ecma-48`))
        break
      case `pcboard`:
      case `wildcat`:
        // child 2
        this.head.appendChild(
          CreateLink(`../css/text_colors_pcboard.css`, `retrotxt-4bit`)
        )
        break
    }
    // disable links
    let i = this.head.children.length
    while (i--) {
      this.head.children[i].disabled = false
    }
  }
  /**
   * Display or hide the header UI.
   */
  headerUI() {
    const hide = document.getElementById(`h-ui-toggle-hide`)
    const show = document.getElementById(`h-ui-toggle-show`)
    if (hide !== null) {
      hide.onclick = () => this.header(true)
    }
    if (show !== null) {
      show.onclick = () => this.header(false)
    }
    switch (`${this.results.textFontInformation}`) {
      case `false`:
      case `true`:
        this.header(this.results.textFontInformation)
        break
      default:
        CheckError(
          `🖫 Could not obtain the required textFontInformation setting to reveal text font information.`,
          true
        )
    }
    // text render
    this.renderEffect()
    // palette event listener
    this.colorPalette()
    // ice colors toggle in the information header (only shows with EMCA48/ANSI documents)
    this.iceColors = document.getElementById(`ice-colors-toggle`)
    if (this.iceColors !== null) {
      this.iceColors.onclick = () => this.iCEColors()
      if (this.ecma48.iceColors === true)
        this.iceColors.childNodes[1].textContent = `On`
      else this.iceColors.childNodes[1].textContent = `Off`
    }
  }
  /**
   * Colour palette event listener.
   */
  async colorPalette() {
    const element = document.getElementById(`h-palette`)
    const palette = new HardwarePalette()
    if (element !== null && this.ecma48.colorDepth === 4) {
      element.onclick = () => {
        const css = document.getElementById(`retrotxt-4bit-ice`)
        // this cycles through to the next palette
        palette.key = palette.next(palette.saved())
        palette.set()
        element.textContent = palette.saved()
        // update link
        const link = chrome.extension.getURL(palette.savedFilename())
        document.getElementById(`retrotxt-4bit`).href = link
        // update ice colors link
        if (css !== null) {
          css.href = chrome.extension.getURL(palette.savedFilename(true))
        }
      }
    }
  }
  /**
   * Initialises run RetroTxt.
   */
  async initialize() {
    // context menu onclick listener
    chrome.runtime.onMessage.addListener(handleMessages)
    // monitor for any changed Options set by the user
    chrome.storage.onChanged.addListener(handleChanges)
    // switch between the original plain text and the HTML conversion
    if (this.cssLink !== null) {
      if (this.cssLink.disabled === true) this.html()
      else if (this.cssLink.disabled === false) this.textSwap()
      // end InvokeRetroTxt() function & tell a listener in eventpage.js that this tab's body has been modified
      return chrome.runtime.sendMessage({ retroTxtified: false })
    }
    // get and apply saved Options
    chrome.storage.local.get(this.storage, result => {
      const dom = new DOM()
      dom.results = result
      dom.restore()
    })
    // tell a listener in eventpage.js that the body of this tab has been modified
    chrome.runtime.sendMessage({ retroTxtified: true })
  }
  /**
   * Apply options fetched from localStorage.
   */
  restore() {
    const err = id => {
      CheckError(
        `Could not obtain the required ${id} setting to apply execute RetroTxt.`,
        true
      )
    }
    // line height choice
    if (typeof this.results.lineHeight === `string`)
      this.lineHeight(this.results.lineHeight)
    else err(`lineHeight`)
    // colour choices
    if (typeof this.results.retroColor === `string`) {
      this.backgroundColor = this.results.retroColor
      this.background()
    } else err(`retroColor`)
    // font selection
    // shift_jis requires the Mono font-family and overrides user font selection
    if (document.characterSet.toLowerCase() === `shift_jis`) {
      const fonts = new FontFamily(`MONA`)
      fonts.swap(this.pre0)
    } else {
      if (typeof this.results.retroFont === `string`) {
        const fonts = new FontFamily(this.results.retroFont)
        fonts.swap(this.pre0)
      } else err(`retroFont`)
    }
    // scan lines
    if (`${this.results.textBgScanlines}` === `true`)
      ToggleScanlines(this.results.textBgScanlines, this.body)
    else if (StringToBool(this.results.textBgScanlines) === null)
      err(`textBgScanlines`)
    // centre alignment of text
    if (`${this.results.textCenterAlignment}` === `true`) {
      this.main.style.margin = `auto`
      this.main.style.justifyContent = `true`
    } else if (`${this.results.textCenterAlignment}` === `false`) {
      this.main.style.margin = `initial`
      this.main.style.justifyContent = `left`
    } else if (StringToBool(this.results.textCenterAlignment) === null)
      err(`textCenterAlignment`)
    // text effect
    if (typeof this.results.textEffect === `string`)
      ToggleTextEffect(this.results.textEffect, this.main)
    else if (typeof this.results.textEffect !== `string`) err(`textEffect`)
    // blink animation
    if (`${this.results.textBlinkAnimation}` === `false`) this.blinkAnimation()
    else if (StringToBool(this.results.textBlinkAnimation) === null)
      err(`textBlinkAnimation`)
  }
  /**
   * Toggles a background colour to the body element.
   */
  async background() {
    try {
      this.body.className = ``
      this.main.className = ``
    } catch (err) {
      /* Some Firefox/Gecko versions throw a security error when handling file:/// */
    }
    // refresh scan lines and font shadows as they are effected by colour changes
    chrome.storage.local.get([`textBgScanlines`, `textEffect`], result => {
      if (!(`textBgScanlines` in result))
        CheckError(
          `🖫 Could not obtain the required textBgScanlines setting to apply the scanlines effect.`,
          true
        )
      if (!(`textEffect` in result))
        CheckError(
          `🖫 Could not obtain the required textEffect setting to apply text effects.`,
          true
        )
      const scanlines = result.textBgScanlines
      const textEffect = result.textEffect
      // scan lines on the page body
      if (typeof scanlines === `boolean` && scanlines === true)
        ToggleScanlines(true, this.body)
      // font shadowing applied to text in the page main tag
      if (typeof textEffect === `string` && textEffect === `shadowed`)
        ToggleTextEffect(`shadowed`, this.main)
    })
    // apply new colours
    const colorName = this.backgroundColor
    let colorId = colorName
    if (colorName.startsWith(`theme-`) === false) colorId = `theme-${colorName}`
    if (this.body.classList !== null) this.body.classList.add(`${colorName}-bg`)
    else return // error
    if (this.main.classList !== null) this.main.classList.add(`${colorName}-fg`)
    else return // error
    // cleanup custom colours
    if (colorName !== `theme-custom`) {
      this.body.removeAttribute(`style`)
      this.main.removeAttribute(`style`)
    }
    // handle color fixes
    const fixes = document.getElementById(`white-bg-fixes`)
    switch (colorId) {
      case `theme-atarist`:
      case `theme-windows`:
        if (fixes == null) {
          this.head.appendChild(
            CreateLink(
              `../css/text_colors_white_bg-fixes.css`,
              `white-bg-fixes`
            )
          )
        }
        break
      default:
        if (fixes != null) {
          fixes.remove()
        }
    }
    // handle theme-custom colours
    // this also loads stylesheet and applies CSS
    if (colorName === `theme-custom`) {
      chrome.storage.local.get(
        [`customBackground`, `customForeground`],
        result => {
          const body = this.body.style
          if (`customBackground` in result)
            body.backgroundColor = `${result.customBackground}`
          else body.backgroundColor = ``
          if (`customForeground` in result)
            body.color = `${result.customForeground}`
          else body.color = ``
        }
      )
    }
    // CSS used to invert the header's colours
    const cssFilter = colorId => {
      if (FindEngine() !== `blink`) return `invert(100%)`
      else {
        // work around for the Blink engine (Chrome)
        // handle custom colours
        if (colorId === `theme-custom`) {
          const contrast = new Contrast(
            `${localStorage.getItem(`customForeground`)}`,
            `${localStorage.getItem(`customBackground`)}`
          )
          const result = contrast.brighterTest()
          // dark background
          if (result === true) return `invert(100%)`
          // light background
          return `invert(0%)`
        }
        // handle all other themes
        switch (colorId) {
          // light backgrounds
          case `theme-windows`:
          case `theme-atarist`:
            return `invert(0%)`
          default:
            // light backgrounds
            if (colorId.includes(`-on-white`)) return `invert(0%)`
            // dark backgrounds
            return `invert(100%)`
        }
      }
    }
    // invert headers, white backgrounds need to be handled separately
    for (const header of this.headers) {
      // deal with varying browser support (http://caniuse.com/#feat=css-filters)
      if (header === null) continue
      if (`filter` in header.style) {
        // modern browsers
        header.style.filter = cssFilter(colorId)
      } else if (`webkitFilter` in header.style) {
        // Chrome <=57
        header.style.webkitFilter = cssFilter(colorId)
      }
    }
  }
  /**
   * Toggles the ability to disable all blinking animation within a tab.
   */
  async blinkAnimation() {
    if (this.results.textBlinkAnimation === `false`) {
      this.head.appendChild(
        CreateLink(`../css/text_animation-off.css`, `no-blink-animation`)
      )
    } else {
      const css = document.getElementById(`no-blink-animation`)
      if (css !== null) css.remove()
    }
  }
  /**
   * Toggle between the display of blinking ANSI text or static text with background iCE colors.
   */
  async iCEColors() {
    const css = document.getElementById(`retrotxt-4bit-ice`)
    const state = this.iceColors.childNodes[1].textContent
    const palette = new HardwarePalette()
    switch (state) {
      case `Off`: {
        const element = document.getElementById(`h-palette`)
        if (css !== null) return
        if (element !== null) {
          palette.key = element.textContent
          const saved = palette.set()
          if (saved === false) {
            palette.key = `IBM`
            palette.set()
          }
        }
        this.head.appendChild(
          CreateLink(palette.savedFilename(true), `retrotxt-4bit-ice`)
        ) // child 4
        this.iceColors.childNodes[1].textContent = `On`
        break
      }
      default: {
        if (css !== null) css.remove()
        this.iceColors.childNodes[1].textContent = `Off`
      }
    }
  }
  /**
   * Toggle any stylesheet fixes.
   */
  async cssFix() {
    // colour choices
    if (typeof this.results.retroColor === `string`) {
      const fixes = document.getElementById(`white-bg-fixes`)
      if (fixes == null) {
        switch (this.results.retroColor) {
          case `theme-atarist`:
          case `theme-windows`:
            this.head.appendChild(
              CreateLink(
                `../css/text_colors_white_bg-fixes.css`,
                `white-bg-fixes`
              )
            )
            break
        }
      }
    }
  }
  /**
   * Displays or hides the information header.
   * @param [display=true] show the header in the browser tab?
   */
  async header(display = true) {
    const parseDisplay = StringToBool(display)
    if (parseDisplay === null)
      CheckArguments(`display`, `boolean`, parseDisplay)
    switch (parseDisplay) {
      case false:
        // header-show
        this.headers[0].style.display = `none`
        // header-hide
        this.headers[1].style.display = `block`
        break
      case true:
        this.headers[0].style.display = `block`
        this.headers[1].style.display = `none`
        break
    }
  }
  /**
   * Display the RetroTxt processed and themed text document.
   */
  async html() {
    chrome.storage.local.get(`textFontInformation`, result => {
      const font = result.textFontInformation
      if (font === undefined)
        CheckError(
          `🖫 Could not obtain the required textFontInformation setting to apply text font information feature.`,
          true
        )
      else if (typeof font === `boolean`) this.header(font)
    })
    if (FindEngine() === `blink`) {
      // temporary workaround for issue where the previous background color of <body> is cached and not removed
      this.pre1.style.backgroundColor = ``
    }
    this.pre1.style.display = `none`
    this.pre0.style.display = `block`
    const links = Array.from(this.head.childNodes)
    links.forEach(link => (link.disabled = false))
    // hide spin loader
    BusySpinner(false)
  }
  /**
   * Toggles line height changes.
   * @param [lineHeight=`normal`] line height value
   */
  async lineHeight(lineHeight = `normal`) {
    if (typeof lineHeight !== `string`)
      CheckArguments(`lineHeight`, `string`, lineHeight)
    this.pre0.style.lineHeight = lineHeight
  }
  /**
   * Toggles between colour palettes.
   */
  async paletteSwap() {
    const depth = this.ecma48.colorDepth
    const url = chrome.extension.getURL
    switch (depth) {
      case 24:
      case 8:
        this.palette.key = `xterm`
        this.palette.set()
        document.getElementById(`retrotxt-4bit`).href = url(
          this.palette.savedFilename()
        )
        break
      case 3:
        document.getElementById(`retrotxt-4bit`).href = url(
          `../css/text_colors_cga_1.css`
        )
        break
      case 2:
        document.getElementById(`retrotxt-4bit`).href = url(
          `../css/text_colors_cga_0.css`
        )
        break
      case 1:
        document.getElementById(`retrotxt-4bit`).remove()
        break
      case 0:
        document.getElementById(`retrotxt-4bit`).href = url(
          `../css/text_colors_gray.css`
        )
        break
    }
    // handle 8-bit stylesheet
    switch (depth) {
      case 24:
      case 8:
        break
      default:
        document.getElementById(`retrotxt-8bit`).remove()
    }
    // iCE colors
    if (this.ecma48.iceColors === true) {
      this.head.appendChild(
        CreateLink(this.palette.savedFilename(true), `retrotxt-4bit-ice`)
      ) // child 4
    }
  }
  /**
   * Restore or display the original unmodified browser tab.
   */
  async textSwap() {
    const schemes = [`chrome-extension`, `moz-extension`]
    const scheme = window.location.protocol.split(`:`)[0]
    // skip any URLs that match ignore schemes
    for (const ignore of schemes) {
      if (scheme.includes(ignore)) return
    }
    // hide classes
    ToggleScanlines(false, this.body)
    // hide page style customisations
    if (this.preCount >= 2) {
      if (this.headers !== null) {
        for (const h of this.headers) {
          h.style.display = `none`
        }
      }
      this.pre0.style.display = `none`
      this.pre1.style.display = `block`
      if (FindEngine() === `blink`) {
        // temporary workaround for a Blink engine issue where the previous background color of <body> cached and not removed
        this.pre1.style.backgroundColor = `white`
      }
    } else if (typeof this.pre0 !== `undefined`) {
      this.pre0.style.display = `block`
    }
    // hide links
    const links = Array.from(this.head.childNodes)
    links.forEach(link => (link.disabled = true))
    // hide red alert messages
    DisplayAlert(false)
  }
  /**
   * Toggle text render effects.
   */
  async renderEffect() {
    const element = document.getElementById(`h-text-rend`)
    if (element !== null) {
      element.onclick = click => {
        switch (click.srcElement.textContent) {
          case `Normal`:
            ToggleTextEffect(`smeared`, this.body.childNodes[3])
            break
          case `Smeared`:
            ToggleTextEffect(`shadowed`, this.body.childNodes[3])
            break
          default:
            ToggleTextEffect(`normal`, this.body.childNodes[3])
        }
      }
    }
  }
}
/**
 * Builds metadata from plain text.
 * @class Input
 */
class Input {
  /**
   * Creates an instance of Input.
   * @param [encoding=``] document page encoding
   * @param [text=``] plain text
   */
  constructor(encoding = ``, text = ``) {
    const guess = new Guess(text)
    this.BOM = guess.byteOrderMark()
    this.characterSet = `${document.characterSet}`
    this.encoding = encoding
    this.format = FindControlSequences(text)
    this.length = text.length
    this.text = `${text}`
    // replace document page encoding
    if (this.BOM.length > 0) this.encoding = this.BOM
  }
}
/**
 * SAUCE metadata
 * Standard Architecture for Universal Comment Extensions
 * see: http://www.acid.org/info/sauce/sauce.htm
 *
 * To reduce the memory footprint when handling large text files.
 * We pass SAUCE text as an object pointing to the in-memory location
 * instead of duplicating the text using a primitive string.
 * @class SAUCE
 */
class SAUCE {
  /**
   * Creates an instance of SAUCE.
   * @param [input={}] Input class object.
   */
  constructor(input = { text: `` }) {
    this.text = input.text
    this.length = input.text.length
    this.commentLines = ``
    this.sliced = ``
    this.html = null
    // SAUCE items
    this.id = ``
    this.version = ``
    this.title = ``
    this.author = ``
    this.group = ``
    this.date = ``
    this.fileSize = ``
    this.dataType = ``
    this.fileType = ``
    this.TInfo1 = ``
    this.TInfo2 = ``
    this.TInfo3 = ``
    this.TInfo4 = ``
    this.comments = ``
    this.TFlags = ``
    this.TInfoS = ``
    // data containers
    this.configs = {
      flags: `00000000`,
      iceColors: `0`,
      letterSpacing: `00`,
      aspectRatio: `00`,
      codePage: ``,
      fontFamily: ``,
      fontName: ``,
      length: 0,
      width: 0
    }
    this.dates = {
      ccyymmdd: `00000000`,
      year: 0,
      month: 0,
      day: 0
    }
    this.positions = {
      length: null,
      sauceIndex: null,
      comntIndex: null
    }
    // rudimentary Map of ANSI/ASCII groups linked to textmod.es crew ids
    // it's not too useful as most artists don't include group metadata
    //cSpell:disable
    this.textmodes = new Map()
      .set(`acid`, `acid.production`)
      .set(`a.m.i.s.h`, `amish`)
      .set(`amish`, `amish`)
      .set(`apathy`, `apathy`)
      .set(`black maiden`, `black.maiden`)
      .set(`blender!`, `the.blender`)
      .set(`blocktronics`, `blocktronics`)
      .set(`cia`, `creators.of.intense.art`)
      .set(`eerie`, `~eerie`)
      .set(`fuel`, `fuel`)
      .set(`glue`, `glue`)
      .set(`ice`, `insane.creators.enterprise`)
      .set(`impure`, `impure!ascii.1940`)
      .set(`mistergirls`, `mistergirls`)
      .set(`mistigris`, `mistigris`)
      .set(`remorse`, `remorse.1981`)
      .set(`revival`, `revival`)
      .set(`sac`, `superior.art.creations`)
      .set(`seviin`, `seviin`)
      .set(`the legion`, `the.legion`)
      .set(`titan`, `titan`)
      .set(`zenith`, `zenith`)
    //cSpell:enable
    // match SAUCE font families to RetroTxt fonts
    this.sauceFonts = new Map()
      .set(`IBM VGA`, `vga8`) // 8px font
      .set(`IBM VGA50`, `vga50`) // 8x8 (as no 9×8 font found)
      .set(`IBM VGA25G`, `vgalcd`) // 8x19
      .set(`IBM EGA`, `ega8`) // 8×14
      // 'For the 8x8 font present in EGA/MCGA/VGA hardware, see the IBM PC BIOS'
      .set(`IBM EGA43`, `bios`)
      .set(`Amiga Topaz 1`, `topaza500`)
      .set(`Amiga Topaz 1+`, `topazplusa500`)
      .set(`Amiga Topaz 2`, `topaza1200`)
      .set(`Amiga Topaz 2+`, `topazplusa1200`)
      .set(`Amiga PoT-NOoDLE`, `p0tnoodle`)
      .set(`Amiga P0T-NOoDLE`, `p0tnoodle`)
      .set(`Amiga MicroKnight`, `microknight`)
      .set(`Amiga MicroKnight+`, `microknightplus`)
      .set(`Amiga mOsOul`, `mosoul`)
      .set(`C64 shifted`, `c64`)
      .set(`C64 unshifted`, `c64`)
      // Original ATASCII font (Atari 400, 800, XL, XE)
      .set(`Atari`, `atascii`)
    // initialise sauce metadata
    if (this.length > 500) {
      this.find()
      this.slice()
      this.fontFamily()
      this.fontCodePage()
    }
  }
  /**
   * Remove malformed metadata from data.
   * @param [data=``] text to clean
   * @returns string
   */
  clean(data = ``) {
    // do not delete the space in this regex or SAUCE embedded documents will fail
    return data.replace(/[^A-Za-z0-9 ]/g, ``)
  }
  /**
   * Discovers and parses any SAUCE metadata from text.
   */
  find() {
    // scan the last 500 characters of the text for a SAUCE identifier
    const search = this.text.slice(this.length - 500, this.length)
    const start = search.indexOf(`SAUCE00`) - 500
    const comntStart = search.lastIndexOf(`COMNT`)
    // data containers
    this.positions = {
      length: this.length,
      sauceIndex: this.length + start,
      comntIndex: this.length - comntStart
    }
    // when no COMNT found delete the position index
    if (comntStart === -1) this.positions.comntIndex = 0
    // binary zero is represented as unicode code point 65533 (�), named as 'replacement character'
    const rBin0 = new RegExp(String.fromCharCode(65533), `g`) // a pattern to find all binary zeros
    // search the 500 characters for a SAUCE record
    this.sliced = this.text.slice(start, this.length)
    this.extract()
    // when no SAUCE identifier is found
    if (this.id !== `SAUCE00`) {
      this.positions.length = 0
      this.positions.sauceIndex = 0
      this.positions.comntIndex = 0
      return this
    }
    // handle the date
    this.dates.ccyymmdd = this.date
    this.dates.year = parseInt(this.date.slice(0, 4))
    this.dates.month = parseInt(this.date.slice(4, 6))
    this.dates.day = parseInt(this.date.slice(6, 8))
    // handle ANSiFlags
    // see http://www.acid.org/info/sauce/sauce.htm#ANSiFlags
    this.configs.flags = this.TFlags.charCodeAt(0).toString(2) // get binary representation of character
    const len = this.configs.flags.length
    if (len < 8) {
      // pad with leading 0s to make an 8-bit binary string
      this.configs.flags = `0`.repeat(8 - len) + this.configs.flags
    }
    this.configs.iceColors = this.configs.flags.slice(-1)
    this.configs.letterSpacing = this.configs.flags.slice(-3, -1)
    this.configs.aspectRatio = this.configs.flags.slice(-5, -3)
    // handle font name
    this.configs.fontName = this.TInfoS.replace(rBin0, ``)
    // document length (ignored) & width
    if (typeof TextEncoder === `function`) {
      // see http://ourcodeworld.com/articles/read/164/how-to-convert-an-uint8array-to-string-in-javascript
      const uea = new TextEncoder(`ascii`).encode(
        this.TInfo1.replace(rBin0, ``)[0]
      )
      this.configs.width = parseInt(uea, 10)
    }
    // comment lines
    if (comntStart > -1 && comntStart - start < 255 * 64) {
      this.commentLines = search.slice(
        comntStart + `COMNT`.length,
        search.indexOf(`SAUCE00`)
      )
    }
  }
  /**
   * Determine the RetroTxt font family to use.
   */
  fontFamily() {
    if (this.version !== `00`) return
    const fontValue = `${this.configs.fontName}`
    // clean-up any malformed data
    let font = fontValue.replace(/[^A-Za-z0-9 +/-]/g, ``)
    // 9 pixel font exception
    if (font === `IBM VGA` && this.configs.letterSpacing === `10`)
      this.configs.fontFamily = `vga9`
    // default font family to use if no font information exists
    else if (fontValue === ``) this.configs.fontFamily = `vga8`
    // get local font
    else this.configs.fontFamily = this.sauceFonts.get(font)
  }
  /**
   * Returns a suitable codepage for use based on the supplied SAUCE font family.
   */
  fontCodePage() {
    const font = `${this.configs.fontName}`
    const fonts = new Map()
      .set(`Amiga`, `iso_8859_1➡`)
      .set(`Atari`, `cp_1252`)
      .set(`DOS`, `cp_437`)
      .set(`special`, `iso_8859_5`)
    const split = this.clean(font).split(` `)
    const fontName = split[0]
    let codePage = ``
    if (fonts.has(fontName)) codePage = fonts.get(fontName)
    if (fontName === `IBM`) {
      // Chrome/Blink special case for when it confuses CP437 ANSI as ISO-8859-5
      if (FindEngine() === `blink` && document.characterSet === `ISO-8859-5`)
        this.configs.codePage = fonts.get(`special`)
      if (split[2] === `819`) codePage = fonts.get(`Amiga`)
      // default
      codePage = fonts.get(`DOS`)
    }
    this.configs.codePage = codePage
  }
  /**
   * Parses SAUCE metadata into HTML for display.
   * @returns HTMLElement or `null`
   */
  divBlock() {
    const now = new Date()
    const months = [
      `January`,
      `February`,
      `March`,
      `April`,
      `May`,
      `June`,
      `July`,
      `August`,
      `September`,
      `October`,
      `November`,
      `December`
    ]
    const the = {
      year: this.dates.year,
      month: this.dates.month,
      day: this.dates.day,
      string: ``
    }
    let joiner = `by `
    let body = ``
    // parse SAUCE version
    if (this.version !== `00`) return null
    // title
    if (this.title.trim() !== ``) body += ` '${this.title}' `
    // authors
    if (this.author.trim() !== ``) {
      body += ` by '${this.author}' `
      joiner = `of `
    }
    // group
    const group = this.group.trim()
    if (group !== ``) body += ` ${joiner} ${group} `
    // date
    if (this.dates.ccyymmdd.trim() !== ``) {
      if (the.year > 1980 && the.year <= now.getFullYear()) {
        if (the.day > 0 && the.day <= 31 && the.month > 0 && the.month <= 12) {
          the.string = ` ${months[the.month - 1]} ${the.day} `
        }
        body = body.trim()
        if (body.length > 0) body += `, dated ${the.year} ${the.string}`
        else body = `Dated ${the.year} ${the.string}`
      }
    }
    // create elements
    const div = document.createElement(`div`)
    // sauce metadata
    const sauce = document.createElement(`span`)
    sauce.id = `SAUCE00-metadata`
    sauce.textContent = body.trim()
    // append textmod.es crew link
    if (this.textmodes.has(group.toLowerCase())) {
      const id = this.textmodes.get(group.toLowerCase())
      const link = document.createElement(`a`)
      const sp = document.createTextNode(` `)
      link.setAttribute(`href`, `https://pc.textmod.es/crew/${id}`)
      link.textContent = `textmod.es/crew/${id}`
      sauce.appendChild(sp)
      sauce.appendChild(link)
    }
    // author comments
    const commt = document.createElement(`span`)
    commt.id = `SAUCE00-comment`
    const em = document.createElement(`em`)
    em.textContent = this.commentLines.trim()
    commt.appendChild(em)
    if (body.length <= 0) return null
    div.appendChild(sauce)
    if (this.commentLines.trim() !== ``) {
      commt.style.display = `block`
      div.appendChild(commt)
    }
    return div
  }
  /**
   * Extracts SAUCE metadata from sliced text.
   */
  extract() {
    const text = this.sliced
    if (typeof text !== `string`)
      CheckArguments(`this.sliced`, `string`, this.sliced)
    this.id = text.slice(0, 7)
    if (this.id !== `SAUCE00`) return `` // err
    // string values
    this.version = text.slice(5, 7) // 2 bytes
    this.title = text.slice(7, 42).trim() // 35 bytes
    this.author = text.slice(42, 62).trim() // 20 bytes
    this.group = text.slice(62, 82).trim() // 20 bytes
    this.date = text.slice(82, 90).trim() // 8 bytes
    this.TInfoS = text.slice(106, 128) // 22 bytes
    this.cType = text.slice(90, 106) // 16 bytes
    // binary values
    // NOTE: these values are not always accurate due to the source files being read as text and not as binary data
    this.fileSize = text.slice(90, 94)
    this.dataType = text.slice(94, 95)
    this.fileType = text.slice(95, 96)
    this.TInfo1 = text.slice(96, 98)
    this.TInfo2 = text.slice(98, 100)
    this.TInfo3 = text.slice(100, 102)
    this.TInfo4 = text.slice(102, 104)
    this.comments = text.slice(104, 105)
    this.TFlags = text.slice(105, 106)
  }
  /**
   * Extracts text comments from SAUCE.
   */
  slice() {
    if (this.valid()) {
      // creates HTML
      this.html = this.divBlock()
      // remove sauce record from text
      if (
        this.positions.comntIndex > 0 &&
        this.positions.comntIndex < this.positions.sauceIndex
      ) {
        // re-evaluate location of COMNT and remove it from text
        const cmnt = this.text.lastIndexOf(`COMNT`)
        this.text = this.text.slice(0, cmnt)
      } else {
        // re-evaluate location of SAUCE and remove it from text
        const sauce = this.text.lastIndexOf(`SAUCE00`)
        this.text = this.text.slice(0, sauce)
      }
      // clean up lead padding can cause malformed escape sequences in ANSI text
      // look for a fixed DLE, SUB character sequence and trim the text
      // note: regex and indexOf doesn't work with C0 control characters
      const slice = this.text.slice(-6)
      if (slice.codePointAt(0) === 10 && slice.codePointAt(1) === 26) {
        this.text = this.text.slice(0, -6)
      } else if (slice.codePointAt(1) === 10 && slice.codePointAt(2) === 26) {
        this.text = this.text.slice(0, -5)
      }
    }
  }
  /**
   * Validate SAUCE record.
   */
  valid() {
    if (this.id === `SAUCE00`) return true
    else return false
  }
}
/**
 * HTML mark-up output.
 * @class Output
 */
class Output {
  /**
   * Creates an instance of Output.
   * @param [sauce={}] SAUCE class object
   * @param [dom={}] DOM class object
   */
  constructor(sauce = {}, dom = {}) {
    const config = new Configuration()
    this.encode = this.newSpan()
    this.encode.id = `h-doc-fmt`
    this.main = document.createElement(`main`)
    this.pre = document.createElement(`pre`)
    this.slice = sauce.text //`${inputText}`
    // assume 80 for all text formats
    this.columns = config.textRender.get(`columns`)
    this.rows = 0
    // Data objects
    this.data = {
      cs: ``,
      cp: {},
      errs: 0,
      html: ``,
      oths: 0,
      sauce: sauce.html
    }
    this.dom = dom
    this.ecma48 = {}
    this.sauce = sauce
  }

  newBold() {
    return document.createElement(`strong`)
  }
  newDiv() {
    return document.createElement(`div`)
  }
  newHead() {
    return document.createElement(`header`)
  }
  newSpan() {
    return document.createElement(`span`)
  }
  padding(count = 1) {
    const pad = ` `
    return document.createTextNode(`${pad.repeat(count)}`)
  }
  separator() {
    return document.createTextNode(` - `)
  }
  /**
   * Apply a blinking cursor.
   */
  cursor() {
    const cursor = this.newSpan()
    cursor.classList.add(`dos-cursor`)
    cursor.textContent = `_`
    this.pre.appendChild(cursor)
  }
  /**
   * Font size adjustment.
   */
  fontSize() {
    const bold = this.newBold()
    bold.id = `h-doc-text-adjust`
    bold.title = `Font size adjustment`
    bold.textContent = `1x`
    // create event listener
    bold.onclick = () => {
      switch (bold.textContent) {
        case `1x`:
          bold.textContent = `2x`
          this.pre.classList.add(`text-2x`)
          this.pre.classList.remove(`text-1x`)
          break
        case `2x`:
          bold.textContent = `1x`
          this.pre.classList.add(`text-1x`)
          this.pre.classList.remove(`text-2x`)
          break
      }
    }
    return bold
  }
  /**
   * Outputs ECMA48 error statistics to the browser console.
   */
  errorsECMA48() {
    if (this.data.oths > 0 || this.data.errs > 0) {
      // construct error message
      const errorCount = this.data.oths + this.data.errs
      let errors = ``
      if (this.data.oths > 0) {
        errors += `${this.data.oths} unsupported function`
        if (this.data.oths > 1) errors += `s`
      }
      if (this.data.oths > 0 && this.data.errs > 0) errors += ` and `
      if (this.data.errs > 0) {
        errors += `${this.data.errs} unknown control`
        if (this.data.errs > 1) errors += `s`
      }
      errors += ` found`
      // display as feedback
      if (errorCount <= 4) console.warn(errors)
      else {
        // display in console
        errors += `, the display of the ANSI is inaccurate`
        console.error(errors)
      }
    }
  }
  /**
   * Returns ECMA48 data.
   */
  getECMA48() {
    this.ecma48 = new BuildEcma48(this.data.html, this.sauce, false, false)
    this.statisticsECMA48()
    // font override
    sessionStorage.removeItem(`fontOverride`)
    if (this.ecma48.font === undefined) {
      CheckError(
        `🖫 'this.ecma48.font' should have returned a font value or 'null' but instead returned ${
          this.ecma48.font
        }.`
      )
    } else if (this.ecma48.font !== null) {
      const fonts = new FontFamily(this.ecma48.font)
      // this needs to run before setting the sessionStorage
      fonts.swap(this.pre)
      sessionStorage.setItem(`fontOverride`, `true`)
    }
    // color palette
    this.dom.ecma48 = this.ecma48
    this.dom.paletteSwap()
    // parse text & insert it into the browser tab
    if (typeof this.data.html === `string`) {
      const html = ParseToChildren(this.data.html)
      this.pre.appendChild(html)
    } else
      CheckError(
        `Expecting a string type for output.data.html but instead it is ${typeof this
          .data.html}.`
      )
    return this.ecma48
  }
  /**
   * Replace escaped characters because we're using <pre>.
   */
  htmlEscapes() {
    const reg1 = new RegExp(`&gt;`, `gi`)
    const reg2 = new RegExp(`&lt;`, `gi`)
    const reg3 = new RegExp(`&amp;`, `gi`)
    this.data.html = this.data.html.replace(reg1, `>`)
    this.data.html = this.data.html.replace(reg2, `<`)
    this.data.html = this.data.html.replace(reg3, `&`)
    this.pre.textContent = this.data.html
  }
  /**
   * Rebuild text with a new character encoding.
   */
  rebuildCharSet() {
    const characterSet = `${this.data.cs}`
    const sessionItem = sessionStorage.getItem(`transcode`)
    // Transcode() class is found in parse_dos.js
    const transcode = new Transcode(`${characterSet}`, `${this.slice}`)
    // count number of rows (lines of text)
    const rowCount = (text = this.data.html) => {
      return text.trim().split(/\r\n|\r|\n/).length
    }
    if (sessionItem !== null) {
      // Transcode text US-ASCII simply returns the input text
      // Other transcode selections require the text to be rebuild based on the sessionItem value
      if (sessionItem !== `us_ascii➡`) {
        transcode.rebuild()
      }
      this.data.html = transcode.text
      this.rows = rowCount()
      return
    }
    let newCodePage = characterSet
    if (characterSet.slice(-1) === `➡`) newCodePage = characterSet.slice(0, -1)
    // Characters() class is found in functions.js
    const characters = new Characters(newCodePage)
    // Normalise text where document.characterSet is supplied
    // ie WINDOWS-1250
    if (characters.supportedEncoding() === true) {
      const text = new DOSText(`${transcode.text}`, {
        codepage: `${characters.getEncoding(newCodePage)}`
      })
      this.data.html = text.normalize()
      this.rows = rowCount()
      return
    }
    // Normalise text where code page key is supplied
    // ie cp_1252
    if (characters.support() === true) {
      const text = new DOSText(`${transcode.text}`, { codepage: newCodePage })
      this.data.html = text.normalize()
      this.rows = rowCount()
      return
    }
    CheckError(
      `'${newCodePage}' is not a valid rebuildCharSet() identifier.`,
      false
    )
  }
  /**
   * Creates information on both the input/output codepage & text encoding.
   * @param input input text object
   * @param width <pre> element width
   */
  showTextFormat(input, width = ``) {
    // lock centring alignment to 640px columns
    this.pre.style.width = width
    this.pre.classList.add(`text-1x`)
    if (input.characterSet === null) return // exit
    const fonts = new FontFamily()
    const text = { in: ``, out: `` }
    const elements = {
      ansi: document.createElement(`span`),
      vs: document.createTextNode(` → `),
      in: document.createElement(`span`),
      out: document.createElement(`span`)
    }
    const stored = { item: null, text: `` }
    // obtain transcode setting
    stored.item = sessionStorage.getItem(`transcode`)
    // ==============================================
    // 'Document encoding determined by this browser'
    // ==============================================
    const inputEncoding = new BrowserEncodings(input.characterSet)
    const inputChars = new Characters(inputEncoding.label())
    text.in = inputChars.compactIn()
    elements.in.textContent = text.in
    elements.in.title = inputChars.titleIn(input.characterSet)
    if (inputEncoding.support() === false) {
      // this class hightlights the characterSet string
      elements.in.textContent = input.characterSet
      elements.in.classList.add(`unknown`)
      elements.in.title = `Unknown character set`
    }
    // ==============================================
    // 'Page encoding output'
    // ==============================================
    const outputChars = new Characters(`${this.data.cs}`)
    if (stored.item !== null) outputChars.key = `${stored.item}`
    const outputEncoding = new BrowserEncodings(outputChars.key)
    let outputKey = `${outputChars.key}`
    let outputTitle = ``
    // Matches Characters.output Map
    // ie iso_8859_1➡ that is supplied by this web-extension
    if (outputChars.outputs.has(outputKey)) {
      stored.text = outputChars.compactOut()
      text.out = outputChars.compactOut()
      outputTitle = outputChars.titleOut()
    }
    // Matches Document.characterSet property supplied by the browser
    // ie ISO-8859-1, UTF-8, WINDOWS-1252, etc
    else if (outputEncoding.support()) {
      // append an arrow to label
      // ie iso-8859-1➡
      const newLabel = `${outputEncoding.label()}➡`
      const inLabel = inputEncoding.label()
      // also make sure input encoding doesn't match output encoding
      // ie CP1252 → CP1252
      if (
        outputChars.outputs.has(newLabel) &&
        newLabel.slice(0, -1) !== inLabel
      ) {
        outputChars.key = outputEncoding.label()
      } else outputChars.key = `cp_437`
      stored.text = outputChars.compactOut()
      text.out = outputChars.compactOut()
      outputTitle = outputChars.titleOut()
    }
    // Matches Characters.labels Map that is supplied by SAUCE metadata
    // ie cp_437 etc
    else if (outputChars.support()) {
      stored.text = outputChars.compactOut()
      text.out = outputChars.compactOut()
      outputTitle = outputChars.titleOut()
    }
    elements.out.textContent = text.out
    elements.out.title = outputChars.titleOut(outputTitle)
    // ==============================================
    // handle codepages that require specific fonts
    // ==============================================
    switch (text.in) {
      // these will override user font choices for plain text files
      case `SHIFT_JIS`:
        elements.out.textContent = ``
        elements.out.title = ``
        fonts.key = `MONA`
        fonts.swap(this.pre)
        break
      // handle other codepage special cases
      default:
        switch (stored.item) {
          // Transcode text CP-1252 ↻ and ISO 8859-5 ↻ selections
          case `cp_1252`:
          case `iso_8859_5`:
            if (text.in === stored.text) {
              elements.in.style.textDecoration = `underline`
              elements.in.textContent = text.in
            } else {
              const old = document.createElement(`span`)
              old.textContent = text.in
              elements.in.appendChild(old)
              elements.in.textContent = stored.text
              elements.in.title = `Unable to transcode this text using '${
                stored.text
              } ↻'`
              elements.in.style.textDecoration = `line-through`
            }
            break
          // stored.item === null, Transcode text is set to Browser default
          default:
            if (text.in.length === 0) {
              // unsupported input
            } else if (text.out === `CP437`) {
              // standard output character set
            } else if (stored.text === text.out) {
              // Transcode text output enabled
              elements.out.style = `text-decoration: underline`
              elements.out.textContent = text.out
            } else if (stored.text !== ``) {
              // Transcode text selection unsupported (manual storage edit?)
              const old = document.createElement(`span`)
              old.textContent = text.out
              elements.out.appendChild(old)
              elements.out.textContent = stored.text
              elements.out.style.textDecoration = `line-through`
            }
        }
    }
    this.encode.appendChild(elements.in)
    if (input.format === `ecma48`) {
      this.encode.appendChild(elements.vs)
      this.encode.appendChild(elements.out)
      elements.ansi.title = `ECMA-48/ANSI X3.64 presentation control and cursor functions`
      elements.ansi.textContent = `ANSI`
      this.encode.appendChild(document.createTextNode(` `))
      this.encode.appendChild(elements.ansi)
    } else if (elements.out.textContent !== ``) {
      this.encode.appendChild(elements.vs)
      this.encode.appendChild(elements.out)
    }
    if (typeof qunit !== `undefined`) {
      return elements
    }
  }
  // returns ECMA48 statistics
  statisticsECMA48() {
    if (this.ecma48.columns === 999 && this.sauce.configs.width >= 180)
      this.columns = null
    else this.columns = this.ecma48.columns
    this.rows = this.ecma48.rows
    this.data.html = this.ecma48.htmlString
    this.data.oths = this.ecma48.otherCodesCount
    this.data.errs = this.ecma48.unknownCount
  }
}
/**
 * Information header.
 * Document and text details in a selectable header.
 * @class Information
 */
class Information extends Output {
  constructor(input = {}, output = {}, sauce = {}, ecma48 = {}) {
    super()
    // data class objects
    this.input = input
    this.output = output
    this.sauce = sauce
    this.ecma48 = ecma48
    // import html elements
    this.area = super.newSpan()
    this.font = super.newSpan()
    this.hide = super.newHead()
    this.hide.id = `header-hide`
    this.show = super.newHead()
    this.show.id = `header-show`
    this.size = super.newSpan()
  }
  /**
   * Document measurements.
   */
  setMeasurements() {
    const vs = document.createTextNode(`x`)
    const columns = document.createElement(`span`)
    const lines = document.createElement(`span`)
    columns.title = `Pixel width of text`
    columns.id = `width-of-text`
    lines.title = `Pixel length of text`
    lines.id = `length-of-text`
    columns.textContent = `?`
    lines.textContent = `?`
    this.area.appendChild(columns)
    this.area.appendChild(vs)
    this.area.appendChild(lines)
  }
  /**
   * Document size notice.
   */
  setDocumentSize() {
    this.size.title = `Number of characters contained in the text`
    this.size.textContent = HumaniseFS(this.input.length, 1000)
  }
  /**
   * Dynamic font in use notice.
   */
  setFontFamily() {
    const fonts = new FontFamily()
    if (this.input.characterSet.toLowerCase() === `shift_jis`) {
      fonts.key = `mona`
      fonts.set()
      this.setFont(fonts.family)
    } else if (
      typeof this.ecma48.font !== `undefined` &&
      this.ecma48.font !== null
    ) {
      // ecma48 encode text
      fonts.key = this.ecma48.font
      fonts.set()
      this.setFont(fonts.family)
    } else {
      // ascii encoded text
      switch (this.sauce.version) {
        case `00`: {
          // use font name contained in SAUCE metadata
          sessionStorage.removeItem(`fontOverride`)
          const sauceFont = this.sauce.configs.fontFamily
          if (sauceFont === ``)
            console.warn(
              `Could not obtain a font name from the SAUCE metadata.`
            )
          else {
            fonts.key = sauceFont.toUpperCase()
            fonts.set()
            fonts.swap(this.output.pre)
            sessionStorage.setItem(`fontOverride`, `true`)
            this.setFont(fonts.family)
          }
          break
        }
        default:
          // use the font selected in Options
          chrome.storage.local.get([`retroFont`], result => {
            if (!(`retroFont` in result))
              CheckError(
                `🖫 Could not obtain the required retroFont setting to apply the header.`,
                false
              )
            else {
              fonts.key = result.retroFont.toUpperCase()
              fonts.set()
              this.setFont(fonts.family)
            }
          })
      }
    }
  }
  /**
   * Font in use notice.
   * @param name font family
   */
  setFont(name) {
    const title = name => {
      switch (name.slice(0, 8)) {
        case `Tandy TV`:
          return `Tandy 1000 series TV composite${name.slice(8)}`
        case `Tandy 22`:
          return `Tandy 1000 series RGB${name.slice(9)}`
      }
      switch (name.slice(0, 6)) {
        case `ATASCI`:
          return `Atari 400 and 800`
        case `PETSCI`:
          return `Commodore 8-bit series`
        case `VGALCD`:
          return `Monochrome laptop, Video Graphics Array`
      }
      switch (name.slice(0, 4)) {
        case `BIOS`:
          return `IBM PC system BIOS${name.slice(4)}`
        case `PC15`:
          return `Amstrad PC15${name.slice(4)}`
        case `PS/2`:
          return `IBM Personal System/2${name.slice(4)}`
      }
      switch (name.slice(0, 3)) {
        case `CGA`:
          return `IBM Color Graphics Adapter${name.slice(3).toLowerCase()}`
        case `EGA`:
          return `IBM Enhanced Graphics Adapter ${name.slice(
            3,
            4
          )}-pixel${name.slice(4)}`
        case `ISO`:
          return `IBM ISO ${name.slice(3, 4)}-pixel`
        case `MDA`:
          return `IBM Monochrome Display Adapter`
        case `TOS`:
          return name
        case `VGA`:
          return `IBM Video Graphics Array ${name.slice(
            3,
            4
          )}-pixel${name.slice(4)}`
      }
      // assume all other fonts are Commodore Amiga
      return `Commodore Amiga ${name}`
    }
    this.font.id = `h-doc-font-family`
    this.font.title = `Font family used for display`
    if (title(name) !== name) this.font.title += `\n${title(name)} font`
    this.font.textContent = `${name}`
  }
  /**
   * Construct the information header.
   */
  async create() {
    this.toggle()
    this.pad()
    this.append(this.area)
    this.pad()
    this.append(this.size)
    this.sep()
    this.append(this.output.encode)
    this.sep()
    this.append(this.setRender())
    this.pad()
    this.append(this.output.fontSize())
    this.pad()
    this.append(this.font)
    if (this.input.format === `ecma48`) {
      this.sep()
      this.append(this.setPalette())
      switch (this.ecma48.colorDepth) {
        case 8:
          break // skip
        default:
          this.append(document.createTextNode(` palette`))
      }
      if (this.ecma48.iceColors === true) {
        this.setBlinking()
      }
      // append any ecma-48 errors
      const sum = this.ecma48.otherCodesCount + this.ecma48.unknownCount
      if (sum > 10) {
        this.append(this.setErrorBBS())
      } else if (sum > 0) {
        this.append(this.setWarningBBS())
      }
    }
  }
  /**
   * Display and hide header switch.
   */
  toggle() {
    // hidden <header> element object
    const show = document.createElement(`strong`)
    show.id = `h-ui-toggle-hide`
    show.title = `Reveal the information header`
    show.textContent = `▼`
    const hide = document.createElement(`strong`)
    hide.id = `h-ui-toggle-show`
    hide.title = `Hide this information header`
    hide.textContent = `▲`
    this.hide.appendChild(show)
    this.show.appendChild(hide)
  }
  /**
   * Appends a space character to the current element.
   */
  pad() {
    return this.append(document.createTextNode(` `))
  }
  /**
   * Append an element to the header.
   * @param element HTML object
   */
  append(element) {
    this.show.appendChild(element)
  }
  /**
   * Appends a dash separator to the current element.
   */
  sep() {
    return this.append(document.createTextNode(` - `))
  }
  /**
   * CSS text render method notice.
   */
  setRender() {
    const bold = super.newBold()
    bold.id = `h-text-rend`
    bold.title = `Switch between text render methods`
    return bold
  }
  /**
   * CSS palette notice.
   * @param [colorDepth=0] colour bit depth
   */
  setPalette(colorDepth = this.ecma48.colorDepth) {
    const palette = super.newBold()
    palette.id = `h-palette`
    if (colorDepth !== 4) palette.style.fontWeight = `normal`
    switch (colorDepth) {
      case 24:
        palette.title = `A range of 16.7 million ${chrome.i18n.getMessage(
          `color`
        )}s using the RGB true ${chrome.i18n.getMessage(`color`)} palette`
        palette.textContent = `RGB`
        break
      case 8:
        palette.title = `A range of 256 ${chrome.i18n.getMessage(
          `color`
        )}s using the xterm palette`
        palette.textContent = `xterm 8-bit`
        break
      case 4:
        palette.title = `Switch ANSI ${chrome.i18n.getMessage(
          `color`
        )} palettes`
        palette.textContent = `IBM`
        break
      case 2:
        palette.textContent = `4 ${chrome.i18n.getMessage(`color`)} magenta`
        break
      case 1:
        palette.textContent = `2 ${chrome.i18n.getMessage(`color`)} ASCII`
        break
      case 0:
        palette.textContent = `monochrome`
        break
    }
    return palette
  }
  /**
   * iCE colors notice.
   */
  setBlinking() {
    const bold = super.newBold()
    const span = super.newSpan()
    bold.textContent = `??`
    span.id = `ice-colors-toggle`
    span.title = `Toggle between blinking mode or static background ${chrome.i18n.getMessage(
      `color`
    )}`
    span.textContent = `iCE colors `
    span.appendChild(bold)
    this.show.appendChild(document.createTextNode(`, `))
    this.show.appendChild(span)
  }
  /**
   * ECMA48/ANSI errors notice.
   */
  setErrorBBS() {
    const div = super.newDiv()
    const span = super.newSpan()
    span.textContent = `Unfortunately, this work of animated BBS art is too complicated to replicate as HTML`
    div.appendChild(span)
    return div
  }
  setWarningBBS() {
    const div = super.newDiv()
    const span = super.newSpan()
    span.textContent = `This replication of BBS art to HTML is partly inaccurate`
    div.appendChild(span)
    return div
  }
}

/**
 * Swaps a browser tab between the RetroTxt output and the tab's text source output.
 * @class Invoke
 */
class Invoke {
  constructor() {
    this.dom = new DOM()
  }
  toggle() {
    if (this.dom.cssLink === null) return // raw text
    if (this.dom.main.style.display === `none`) return this.show()
    this.hide()
  }
  show() {
    if (RetroTxt.developer) console.log(`Invoke.show()`)
    let bodyClass = sessionStorage.getItem(`bodyClass`)
    if (bodyClass === null) bodyClass = `theme-msdos-bg`
    const bodyValues = bodyClass.split(` `)
    for (const name of bodyValues) {
      this.dom.body.classList.add(`${name}`)
    }
    let mainClass = sessionStorage.getItem(`mainClass`)
    if (mainClass === null) mainClass = `theme-msdos-fg`
    const mainValues = mainClass.split(` `)
    for (const name of mainValues) {
      this.dom.main.classList.add(`${name}`)
    }
    this.dom.pre0.style.display = `block`
    this.dom.pre1.style.display = `none`
    this.dom.main.style.display = `block`
    this.dom.headers[0].style.display = `block`
    return BusySpinner(false)
  }
  hide() {
    if (RetroTxt.developer) console.log(`Invoke.hide()`)
    const bodyClass = this.dom.body.classList.value
    const bodyValues = bodyClass.split(` `)
    sessionStorage.setItem(`bodyClass`, bodyClass)
    for (const name of bodyValues) {
      this.dom.body.classList.remove(`${name}`)
    }
    const mainClass = this.dom.main.classList.value
    sessionStorage.setItem(`mainClass`, mainClass)
    const mainValues = mainClass.split(` `)
    for (const name of mainValues) {
      this.dom.main.classList.remove(`${name}`)
    }
    this.dom.pre0.style.display = `none`
    this.dom.pre1.style.display = `block`
    this.dom.main.style.display = `none`
    this.dom.headers[0].style.display = `none`
    return BusySpinner(false)
  }
}

/**
 * Is triggered by an event handler when changes are made to the chrome.storage.
 * For example such as a different selection in the Options menu.
 * @param change chrome.storage onChanged event object
 */
function handleChanges(change) {
  if (typeof change !== `object`) CheckArguments(`change`, `object`, change)
  const changes = {
    alignment: change.textCenterAlignment,
    blink: change.textBlinkAnimation,
    color: change.retroColor,
    customBG: change.customBackground,
    customFG: change.customForeground,
    dosCtrls: change.textDosCtrlCodes,
    effect: change.textEffect,
    font: change.retroFont,
    iceColors: change.textAnsiIceColors,
    info: change.textFontInformation,
    lineHeight: change.lineHeight,
    scanlines: change.textBgScanlines,
    wrap80c: change.textAnsiWrap80c
  }
  if (RetroTxt.developer) {
    console.log(`🖫 handleChanges(change)`)
    Object.entries(changes).forEach(([key, value]) => {
      if (typeof value === `undefined`) return
      console.log(`🡲 ${key}`)
      console.log(value)
    })
  }
  const dom = new DOM()
  // handle objects that only need to set local storage
  if (changes.wrap80c) {
    localStorage.setItem(`textAnsiWrap80c`, changes.wrap80c.newValue)
  }
  if (changes.iceColors) {
    localStorage.setItem(`textAnsiIceColors`, changes.iceColors.newValue)
  }
  if (changes.dosCtrls) {
    localStorage.setItem(`textDosCtrlCodes`, changes.dosCtrls.newValue)
  }
  const centerAlignment = (toggle = `true`, dom = {}) => {
    // centre, vertical & horizontal alignment
    if (typeof dom === `object` && `${toggle}` === `true`) {
      dom.style.justifyContent = `true`
      dom.style.margin = `auto`
    } else {
      dom.style.justifyContent = `left`
      dom.style.margin = `initial`
    }
    return
  }
  // font
  if (changes.font) {
    const fonts = new FontFamily(`${changes.font.newValue}`)
    fonts.swap(dom.pre0)
    chrome.storage.local.get(`lineHeight`, result => {
      if (!(`lineHeight` in result))
        CheckError(
          `🖫 Could not obtain the required lineHeight setting to adjust the layout.`,
          true
        )
      else {
        dom.lineHeight(result.lineHeight)
      }
    })
    return
  }
  // custom colours
  if (changes.customBG || changes.customFG) {
    if (changes.customBG)
      localStorage.setItem(`customBackground`, changes.customBG.newValue)
    if (changes.customFG)
      localStorage.setItem(`customForeground`, changes.customFG.newValue)
    // custom colours are handled by DOM.background()
    {
      dom.backgroundColor = `theme-custom`
      return dom.background()
    }
  }
  // colour themes
  if (changes.color) {
    const newColor = changes.color.newValue
    dom.backgroundColor = newColor
    dom.background()
    // update font shadow and scan lines
    chrome.storage.local.get(
      [`textBgScanlines`, `textCenterAlignment`, `textEffect`],
      result => {
        const body = document.body
        const main = document.getElementsByTagName(`main`)[0]
        // need to update scan lines if background colour changes
        if (typeof result.textBgScanlines === `undefined`)
          CheckError(
            `🖫 Could not obtain the required textBgScanlines setting to handle changes (${typeof result.textBgScanlines}).`,
            true
          )
        else if (result.textBgScanlines === true && typeof body === `object`) {
          ToggleScanlines(true, body, newColor)
        }
        // need to update text effect colours
        if (typeof result.textEffect === `undefined`)
          CheckError(
            `🖫 Could not obtain the required textEffect setting to handle changes (${typeof result.textEffect}).`,
            true
          )
        else if (typeof main === `object`) {
          ToggleTextEffect(result.textEffect, main, newColor)
        }
        // need to update center alignment
        if (typeof result.textCenterAlignment === `undefined`)
          CheckError(
            `🖫 Could not obtain the required textCenterAlignment setting to handle changes (${typeof result.textCenterAlignment}).`,
            true
          )
        else if (typeof main === `object`) {
          centerAlignment(result.textCenterAlignment, main)
        }
      }
    )
    return
  }
  // text effect
  if (changes.effect && typeof dom.main === `object`) {
    return ToggleTextEffect(changes.effect.newValue, dom.main)
  }
  // line height
  if (changes.lineHeight) {
    return dom.lineHeight(changes.lineHeight.newValue)
  }
  // information text
  if (changes.info) {
    return dom.header(changes.info.newValue)
  }
  // blink animation
  if (changes.blink) {
    dom.results = { textBlinkAnimation: changes.blink.newValue }
    return dom.blinkAnimation()
  }
  // centre, vertical & horizontal alignment
  if (changes.alignment) {
    return centerAlignment(changes.alignment.newValue, dom.main)
  }
  // scan lines
  if (changes.scanlines) {
    const body = document.getElementsByTagName(`body`)[0]
    if (typeof body === `object`) {
      ToggleScanlines(changes.scanlines.newValue, body)
    }
    return
  }
}
/**
 * Handle messages passed on by functions in eventpage.js
 * @param message chrome.runtime onMessage event object
 */
// sending messages here from eventpage require the chrome.tabs.sendMessage method which includes the tabId.
// responding back to messages from eventpage requires the chrome.runtime.sendMessage method without tabId.
function handleMessages(message, sender) {
  const unexpected = () => {
    if (typeof qunit !== `undefined`) return false
    if (!RetroTxt.developer) return
    console.group(`✉ Unexpected message.`)
    console.log(message)
    console.log(sender)
    console.groupEnd()
  }
  if (!(`id` in message)) return unexpected()
  if (!RetroTxt.developer)
    console.log(`✉ Received '%s' for handleMessages().`, message.id)
  const invoke = new Invoke()
  switch (message.id) {
    case `invoked`:
      if (document.getElementById(`retrotxt-styles`) === null) {
        chrome.runtime.sendMessage({ invoked: false })
        if (RetroTxt.developer)
          console.log(`✉ 'invoked' message request 'false' response sent.`)
      } else {
        chrome.runtime.sendMessage({ invoked: true })
        if (RetroTxt.developer)
          console.log(`✉ 'invoked' message request 'true' response sent.`)
      }
      break
    case `toggle`:
      if (RetroTxt.developer === true)
        console.log(`✉ 'toggle' message received.`)
      return invoke.toggle()
    case `transcode`:
      if (message.action === `browserGuess➡`)
        sessionStorage.removeItem(`transcode`)
      else sessionStorage.setItem(`transcode`, message.action)
      window.location.reload() // reload the active tab
      if (RetroTxt.developer)
        console.log(`✉ 'transcode' message '%s' received.`, message.action)
      break
    case `CheckError`:
      if (RetroTxt.developer) console.log(`✉ 'CheckError' message received.`)
      return DisplayAlert() // display error alert box on active tab
    case `qunit`:
      return true
    default:
      return unexpected()
  }
}
/**
 * RetroTxt trigger used by the chrome.tabs executeScript method.
 * @param [tabId=0] browser tab id to invoke RetroTxt
 * @param [pageEncoding=`unknown`] page encoding used by the tab
 */
function InvokeRetroTxt(tabId = 0, pageEncoding = `unknown`) {
  if (typeof tabId !== `number`) CheckArguments(`tabId`, `number`, tabId)
  if (typeof pageEncoding !== `string`)
    CheckArguments(`pageEncoding`, `string`, pageEncoding)
  pageEncoding = pageEncoding.toLowerCase()
  // clean-up session items in case the tab was previously used by RetroTxt
  sessionStorage.removeItem(`fontOverride`)
  // create DOM object
  const dom = new DOM()
  dom.initialize()
  dom.construct()
  // defaults
  const config = new Configuration()
  const guess = new Guess()
  // text data objects
  let ecma48 = {}
  if (RetroTxt.dump)
    console.log(`InvokeRetroTxt('${tabId}', '${pageEncoding}')`)
  const input = new Input(pageEncoding, `${dom.pre0.textContent}`)
  if (RetroTxt.dump) console.log(input)
  const sauce = new SAUCE(input)
  if (RetroTxt.dump) console.log(sauce)
  const output = new Output(sauce, dom)
  if (RetroTxt.dump) console.log(output)
  // copy user settings to localStorage (active browser tab)
  config.setLocalStorage(`textBlinkAnimation`)
  config.setLocalStorage(`textDosCtrlCodes`)
  config.setLocalStorage(`textAnsiIceColors`)
  // determine and rebuilt character set
  if (sauce.valid()) {
    // attempt to use SAUCE metadata
    output.data.cs = sauce.configs.codePage
    if (pageEncoding === `unknown`) {
      output.data.cs = ``
    }
  }
  if (output.data.cs === ``) {
    // attempt to guess
    output.data.cs = guess.codePage(null, output)
  }
  output.rebuildCharSet()
  // handle non-ASCII text formatting
  switch (input.format) {
    case `ecma48`:
      // ECMA-48 aka ANSI encoded text
      console.info(
        `%c%cECMA-48%c control sequences in use.`,
        `font-weight: bold`,
        `font-weight: bold; color: green`,
        `font-weight: bold; color: initial`
      )
      ecma48 = output.getECMA48()
      break
    case `pcboard`:
    case `wildcat`: {
      // converts PCBoard and WildCat! BBS colour codes into HTML and CSS
      console.info(
        `%c%c${chrome.i18n.getMessage(input.format)} %c${chrome.i18n.getMessage(
          `color`
        )} codes.`,
        `font-weight: bold`,
        `font-weight: bold; color: green`,
        `font-weight: bold; color: initial`
      )
      const bbs = new BBS(`${output.data.html}`, `${input.format}`)
      output.pre = bbs.normalize()
      break
    }
    default: {
      output.htmlEscapes()
    }
  }
  // apply a blinking cursor
  output.cursor()
  // reveal the text font information header
  chrome.storage.local.get(`textFontInformation`, result => {
    dom.ecma48 = ecma48
    dom.palette = output.palette
    dom.results = result
    dom.headerUI()
  })
  // apply any stylesheet fixes
  chrome.storage.local.get([`retroColor`], result => {
    dom.results = result
    dom.cssFix()
  })
  // code page details for text font info.
  switch (input.format) {
    case `pcboard`:
    case `wildcat`:
      output.encode.title = `Special bulletin board system, text formatting`
      output.encode.textContent = `${chrome.i18n.getMessage(input.format)}`
      break
    case `ecma48`:
      // console output
      output.errorsECMA48()
    // fallthrough
    default:
      output.showTextFormat(input, config.cssWidth())
  }
  // information header
  const information = new Information(input, output, sauce, ecma48)
  // document measurements
  information.setMeasurements()
  // document size
  information.setDocumentSize()
  // font family
  information.setFontFamily()
  // output header
  information.create()
  // SAUCE records for text font info
  if (output.data.sauce !== null) information.append(output.data.sauce)
  // create red alert message at the top of the page
  if (window.checkedErr !== undefined && window.checkedErr === true)
    DisplayAlert(true)
  else DisplayAlert(false) // hide from view
  // hide original source text
  dom.pre0.style.display = `none`
  // mark tab's title with the RetroTxt ascii logo
  const title = document.createElement(`title`)
  if (window.location.protocol === `file:`) {
    title.textContent =
      `[··] ` +
      window.location.pathname
        .split(`/`)
        .filter(el => {
          return !!el
        })
        .pop()
  } else {
    title.textContent = `[··] ${window.location.host}${
      window.location.pathname
    }`
  }
  // set document language
  document.documentElement.lang = `en`
  // insert new tags into HTML DOM
  dom.head.appendChild(title)
  output.main.appendChild(output.pre)
  try {
    dom.body.insertBefore(information.show, dom.pre0)
    dom.body.insertBefore(information.hide, dom.pre0)
    dom.body.insertBefore(output.main, dom.pre0)
  } catch (error) {
    CheckError(`⚠ Unexpected DOM.body HTMLElement Node error.`)
    const errorDiv = document.getElementById(`CheckError`)
    errorDiv.textContent = `Oops, it looks like the HTML has failed to render! Are the RetroTxt Unit Tests (QUnit) loaded in another tab? Try closing it and reload this.`
  }
  // hide spin loader
  BusySpinner(false)
  // need to delay getting calculated element size
  // otherwise the received client values are incorrect
  setTimeout(() => {
    const m = document.getElementsByTagName(`main`)[0]
    const w = document.getElementById(`width-of-text`)
    const h = document.getElementById(`length-of-text`)
    h.textContent = m.clientHeight
    w.textContent = m.clientWidth
  }, 500)
}
// eslint no-unused-var fix
if (typeof InvokeRetroTxt !== `undefined`) {
  void 0
}
