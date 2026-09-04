// Shared validation helpers

const MAX_TEXT_LENGTH = 200
const MAX_NOTE_LENGTH = 1000
const ALLOWED_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']

function required(value, name) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    return `${name} is required.`
  }
  return null
}

function maxLength(value, max, name) {
  if (value && typeof value === 'string' && value.length > max) {
    return `${name} must be ${max} characters or fewer.`
  }
  return null
}

function email(value, name = 'Email') {
  if (!value || typeof value !== 'string') return null
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(value.trim())) return `${name} is not a valid email address.`
  return null
}

function uuid(value, name = 'ID') {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!re.test(value)) return `${name} is not a valid UUID.`
  return null
}

function dateString(value, name = 'Date') {
  if (!value || typeof value !== 'string') return null
  const iso = /^\d{4}-\d{2}-\d{2}$/
  if (!iso.test(value)) return `${name} must be in YYYY-MM-DD format.`
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12) return `${name} has an invalid month.`
  const daysInMonth = new Date(y, m, 0).getDate()
  if (d < 1 || d > daysInMonth) return `${name} has an invalid day.`
  return null
}

function enumValue(value, allowed, name = 'Value') {
  if (value && !allowed.includes(value)) return `${name} must be one of: ${allowed.join(', ')}.`
  return null
}

function isBoolean(value, name = 'Value') {
  if (typeof value !== 'boolean') return `${name} must be a boolean.`
  return null
}

function isObject(value, name = 'Body') {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return `${name} must be a JSON object.`
  return null
}

function checkFieldsConfig(value) {
  const valueErr = isObject(value)
  if (valueErr) return valueErr
  for (const [key, field] of Object.entries(value)) {
    const fieldErr = isObject(field)
    if (fieldErr) return `Field "${key}" must be an object.`
    if (field.enabled !== undefined && typeof field.enabled !== 'boolean')
      return `Field "${key}".enabled must be a boolean.`
    if (field.locked !== undefined && typeof field.locked !== 'boolean')
      return `Field "${key}".locked must be a boolean.`
    if (field.label !== undefined && typeof field.label !== 'string')
      return `Field "${key}".label must be a string.`
  }
  return null
}

// Which side of the card each field prints on.
//   front / back — printed on that side only
//   both         — printed on both sides
//   none         — not printed at all; the field is kept in the record and in
//                  the QR payload, it just has no place on the physical card
const FIELD_SIDE_VALUES = ['front', 'back', 'both', 'none']

function checkFieldSidesConfig(value) {
  const valueErr = isObject(value)
  if (valueErr) return valueErr
  for (const [key, side] of Object.entries(value)) {
    if (typeof side !== 'string' || !FIELD_SIDE_VALUES.includes(side)) {
      return `Field "${key}" side must be one of: ${FIELD_SIDE_VALUES.join(', ')}.`
    }
  }
  return null
}

function checkLayoutConfig(value) {
  const valueErr = isObject(value)
  if (valueErr) return valueErr
  for (const [key, item] of Object.entries(value)) {
    if (!item || typeof item !== 'object') continue
    const itemErr = isObject(item)
    if (itemErr) return `Layout item "${key}" must be an object.`
    if (item.type && !['text', 'image'].includes(item.type))
      return `Layout item "${key}".type must be 'text' or 'image'.`
    if (item.x !== undefined && typeof item.x !== 'number')
      return `Layout item "${key}".x must be a number.`
    if (item.y !== undefined && typeof item.y !== 'number')
      return `Layout item "${key}".y must be a number.`
  }
  return null
}

function firstError(...checks) {
  for (const c of checks) {
    if (c) return typeof c === 'string' ? c : c.error || c.message || 'Validation failed.'
  }
  return null
}

module.exports = {
  required,
  maxLength,
  email,
  uuid,
  dateString,
  enumValue,
  isBoolean,
  isObject,
  checkFieldsConfig,
  checkFieldSidesConfig,
  checkLayoutConfig,
  firstError,
  FIELD_SIDE_VALUES,
  MAX_TEXT_LENGTH,
  MAX_NOTE_LENGTH,
  ALLOWED_YEARS,
}
