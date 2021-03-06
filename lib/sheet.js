import {
  objectToRules
} from './utils.js'

const styleSheet = typeof document === 'object' && document.createElement('style')
styleSheet && document.head && document.head.appendChild(styleSheet)

const sheet = styleSheet && styleSheet.sheet

let debug = false
let classes = Object.create(null, {})
let rules = []
let count = 0

export const classPrefix = 'b' + ('000' + ((Math.random() * 46656) | 0).toString(36)).slice(-3) +
                    ('000' + ((Math.random() * 46656) | 0).toString(36)).slice(-3)

export function setDebug(d) {
  debug = d
}

export function getSheet() {
  const content = rules.join('')
  rules = []
  classes = Object.create(null, {})
  count = 0
  return content
}

export function getRules() {
  return rules
}

export function insert(rule, index) {
  rules.push(rule)

  if (debug)
    return styleSheet.textContent = rules.join('\n')

  sheet && sheet.insertRule(rule, arguments.length > 1
    ? index
    : sheet.cssRules.length
  )
}

export function createClass(style) {
  const json = JSON.stringify(style)

  if (json in classes)
    return classes[json]

  const className = classPrefix + (++count)
      , rules = objectToRules(style, '.' + className)

  for (let i = 0; i < rules.length; i++)
    insert(rules[i])

  classes[json] = className

  return className
}
