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

async function validateToken (params) {
  if (params.GATE_ENABLED !== 'true') return true
  try {
    const token = params.token
    if (!token) return false
    const ns = params.OW_NAMESPACE
    const auth = params.OW_AUTH
    if (!ns || !auth) return false
    let hash = await getStoredHash(ns, auth)
    if (!hash) hash = sha256(DEFAULT_PASSWORD)
    return token === makeToken(hash)
  } catch (e) {
    return false
  }
}

module.exports = { validateToken }
