const https = require('https')
const crypto = require('crypto')

const PKG = 'genstudio-org-viewer'
const PASSWORD_KEY = '__viewer_password_hash'
const DEFAULT_PASSWORD = 'password'

function owRequest (method, path, auth, body) {
  return new Promise((resolve, reject) => {
    const authB64 = Buffer.from(auth).toString('base64')
    const data = body ? JSON.stringify(body) : null
    const req = https.request({
      hostname: 'adobeioruntime.net',
      path: `/api/v1/namespaces/${path}`,
      method,
      headers: {
        Authorization: `Basic ${authB64}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let raw = ''
      res.on('data', c => { raw += c })
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(raw) } })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function sha256 (str) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

function makeToken (hash) {
  return crypto.createHmac('sha256', hash).update('viewer-session').digest('hex')
}

async function getStoredHash (ns, auth) {
  const pkg = await owRequest('GET', `${ns}/packages/${PKG}`, auth)
  const annotations = (pkg && pkg.annotations) || []
  const entry = annotations.find(a => a.key === PASSWORD_KEY)
  return entry ? entry.value : null
}

async function setStoredHash (ns, auth, hash) {
  const pkg = await owRequest('GET', `${ns}/packages/${PKG}`, auth)
  const annotations = (pkg && pkg.annotations) || []
  const filtered = annotations.filter(a => a.key !== PASSWORD_KEY)
  filtered.push({ key: PASSWORD_KEY, value: hash })
  await owRequest('PUT', `${ns}/packages/${PKG}?overwrite=true`, auth, { annotations: filtered })
}

async function main (params) {
  try {
    const { password } = params
    const ns = params.OW_NAMESPACE
    const auth = params.OW_AUTH
    if (!password) return respond(400, { error: 'password is required' })

    let storedHash = await getStoredHash(ns, auth)

    // Bootstrap: no hash stored yet — accept default and store its hash
    if (!storedHash) {
      if (password !== DEFAULT_PASSWORD) return respond(401, { error: 'incorrect password' })
      storedHash = sha256(DEFAULT_PASSWORD)
      await setStoredHash(ns, auth, storedHash)
    }

    if (sha256(password) !== storedHash) return respond(401, { error: 'incorrect password' })

    const token = makeToken(storedHash)
    return respond(200, { token })
  } catch (e) {
    return respond(500, { error: e.message })
  }
}

function respond (statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

module.exports = { main }
