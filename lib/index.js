/* eslint no-invalid-this: 0 */
import pseudos from './pseudos.js'
import popular from './popular.js'

import {
  classPrefix,
  createClass,
  setDebug,
  getSheet,
  getRules,
  insert
} from './sheet'

import {
  hyphenToCamelCase,
  vendorValuePrefix,
  lowercaseFirst,
  objectToRules,
  selectorSplit,
  cssProperties,
  stylesToCss,
  vendorRegex,
  vendorMap,
  sanitize,
  initials,
  memoize,
  assign,
  add
} from './utils'

const shorts = Object.create(null)

function bss(input, value) {
  const b = chain(bss)
  input && assign(b.__style, parse.apply(null, arguments))
  return b
}

function setProp(prop, value) {
  Object.defineProperty(bss, prop, {
    configurable: true,
    value
  })
}

Object.defineProperties(bss, {
  __style: {
    configurable: true,
    writable: true,
    value: {}
  },
  valueOf: {
    configurable: true,
    writable: true,
    value: function ValueOf() {
      return '.' + this.class
    }
  }
})

setProp('setDebug', setDebug)

setProp('$keyframes', keyframes)
setProp('$media', $media)
setProp('$import', $import)
setProp('$nest', $nest)
setProp('getSheet', getSheet)
setProp('getRules', getRules)
setProp('helper', helper)
setProp('css', css)
setProp('classPrefix', classPrefix)

function chain(instance) {
  const newInstance = Object.create(bss, {
    __style: {
      value: assign({}, instance.__style)
    },
    style: {
      enumerable: true,
      get: function() {
        return Object.keys(this.__style).reduce((acc, key) => {
          if (typeof this.__style[key] === 'number' || typeof this.__style[key] === 'string')
            acc[key.replace(/^!/, '')] = this.__style[key]
          return acc
        }, {})
      }
    }
  })

  if (instance === bss)
    bss.__style = {}

  return newInstance
}

cssProperties.forEach(prop => {
  const vendor = prop.match(vendorRegex)
  if (vendor) {
    const unprefixed = lowercaseFirst(prop.replace(vendorRegex, '$2'))
    if (cssProperties.indexOf(unprefixed) === -1) {
      if (unprefixed === 'flexDirection')
        vendorValuePrefix.flex = '-' + vendor[1].toLowerCase() + '-flex'

      vendorMap[unprefixed] = prop
      setProp(unprefixed, setter(prop))
      setProp(short(unprefixed), bss[unprefixed])
      return
    }
  }

  setProp(prop, setter(prop))
  setProp(short(prop), bss[prop])
})

setProp('content', function Content(arg) {
  const b = chain(this)
  b.__style.content = '"' + arg + '"'
  return b
})

Object.defineProperty(bss, 'class', {
  set: function(value) {
    this.__class = value
  },
  get: function() {
    return this.__class || createClass(this.__style)
  }
})

function $media(value, style) {
  const b = chain(this)
  if (value)
    b.__style['@media ' + value] = parse(style)

  return b
}

function $import(value) {
  if (value)
    insert('@import ' + value + ';', 0)

  return chain(this)
}

function $nest(selector, properties) {
  const b = chain(this)
  if (arguments.length === 1)
    Object.keys(selector).forEach(x => addNest(b.__style, x, selector[x]))
  else if (selector)
    addNest(b.__style, selector, properties)

  return b
}

function addNest(style, selector, properties) {
  style[
    selector.split(selectorSplit).map(x => {
      x = x.trim()
      return (x.charAt(0) === ':' || x.charAt(0) === '[' ? '' : ' ') + x
    }).join(',&')
  ] = parse(properties)
}

pseudos.forEach(name =>
  setProp('$' + hyphenToCamelCase(name.replace(/:/g, '')), function Pseudo(value, style) {
    const b = chain(this)
    if (value || style)
      b.__style[name + (style ? '(' + value + ')' : '')] = parse(style || value)
    return b
  })
)

function setter(prop) {
  return function CssProperty(value) {
    const b = chain(this)
    if (!value && value !== 0)
      delete b.__style[prop]
    else if (arguments.length > 0)
      add(b.__style, prop, Array.prototype.slice.call(arguments))

    return b
  }
}

function css(selector, style) {
  if (arguments.length === 1)
    Object.keys(selector).forEach(key => addCss(key, selector[key]))
  else
    addCss(selector, style)

  return chain(this)
}

function addCss(selector, style) {
  objectToRules(parse(style), selector, '', true).forEach(insert)
}

function helper(name, styling) {
  if (arguments.length === 1)
    return Object.keys(name).forEach(key => helper(key, name[key]))

  delete bss[name] // Needed to avoid weird get calls in chrome

  if (typeof styling === 'function') {
    helper[name] = styling
    Object.defineProperty(bss, name, {
      configurable: true,
      value: function Helper() {
        const b = chain(this)
        const result = styling.apply(null, arguments)
        assign(b.__style, result.__style)
        return b
      }
    })
  } else {
    helper[name] = parse(styling)
    Object.defineProperty(bss, name, {
      configurable: true,
      get: function() {
        const b = chain(this)
        assign(b.__style, parse(styling))
        return b
      }
    })
  }
}

bss.helper('$animate', (value, props) =>
  bss.animation(bss.$keyframes(props) + ' ' + value)
)

function short(prop) {
  const acronym = initials(prop)
      , short = popular[acronym] && popular[acronym] !== prop ? prop : acronym

  shorts[short] = prop
  return short
}

const stringToObject = memoize(string => {
  let last = ''
    , prev

  return string.trim().split(/;|\n/).reduce((acc, line) => {
    line = last + line.trim()
    last = line.charAt(line.length - 1) === ',' ? line : ''
    if (last)
      return acc

    if (line.charAt(0) === ',') {
      acc[prev] += line
      return acc
    }

    const [key, ...tokens] = line.replace(/[ :]+/, ' ').split(' ')

    if (!key)
      return acc

    const prop = key.charAt(0) === '-' && key.charAt(1) === '-'
      ? key
      : hyphenToCamelCase(key)

    prev = shorts[prop] || prop

    if (prop in helper) {
      typeof helper[prop] === 'function'
        ? assign(acc, helper[prop](...tokens).__style)
        : assign(acc, helper[prop])
    } else if (tokens.length > 0) {
      add(acc, prev, tokens)
    }

    return acc
  }, {})
})

let count = 0
const keyframeCache = {}

function keyframes(props) {
  const content = Object.keys(props).reduce((acc, key) =>
    acc + key + '{' + stylesToCss(parse(props[key])) + '}'
  , '')

  if (content in keyframeCache)
    return keyframeCache[content]

  const name = classPrefix + count++
  keyframeCache[content] = name
  insert('@keyframes ' + name + '{' + content + '}')

  return name
}

function parse(input, value) {
  if (typeof input === 'string') {
    if (typeof value === 'string' || typeof value === 'number')
      return ({ [input] : value })

    return stringToObject(input)
  } else if (Array.isArray(input) && typeof input[0] === 'string') {
    let str = ''
    for (let i = 0; i < input.length; i++)
      str += input[i] + (arguments[i + 1] || '')
    return stringToObject(str)
  }

  return input.__style || sanitize(input)
}

export default bss
