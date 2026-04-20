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

async function main (params) {
  try {
    const { currentPassword, newPassword } = params
    const ns = params.OW_NAMESPACE
    const auth = params.OW_AUTH

    if (!currentPassword || !newPassword) return respond(400, { error: 'currentPassword and newPassword are required' })
    if (newPassword.length < 6) return respond(400, { error: 'newPassword must be at least 6 characters' })

    const pkg = await owRequest('GET', `${ns}/packages/${PKG}`, auth)
    const annotations = (pkg && pkg.annotations) || []
    const entry = annotations.find(a => a.key === PASSWORD_KEY)

    const storedHash = entry ? entry.value : sha256(DEFAULT_PASSWORD)

    if (sha256(currentPassword) !== storedHash) return respond(401, { error: 'current password is incorrect' })

    const newHash = sha256(newPassword)
    const filtered = annotations.filter(a => a.key !== PASSWORD_KEY)
    filtered.push({ key: PASSWORD_KEY, value: newHash })
    await owRequest('PUT', `${ns}/packages/${PKG}?overwrite=true`, auth, { annotations: filtered })

    return respond(200, { success: true })
  } catch (e) {
    return respond(500, { error: e.message })
  }
}

function respond (statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

module.exports = { main }
