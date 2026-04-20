const https = require('https')

const PKG = 'genstudio-org-viewer'
const INDEX_KEY = '__mappings_index'

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

async function main (params) {
  try {
    const { key } = params
    const ns = params.OW_NAMESPACE
    const auth = params.OW_AUTH
    if (!key) return respond(400, { error: 'key is required' })

    const pkg = await owRequest('GET', `${ns}/packages/${PKG}`, auth)
    const annotations = pkg && pkg.annotations ? pkg.annotations : []

    const filtered = annotations.filter(a => a.key !== `data_${key}`)
    const indexIdx = filtered.findIndex(a => a.key === INDEX_KEY)
    if (indexIdx >= 0) {
      const index = JSON.parse(filtered[indexIdx].value).filter(e => e.key !== key)
      filtered[indexIdx] = { key: INDEX_KEY, value: JSON.stringify(index) }
    }

    await owRequest('PUT', `${ns}/packages/${PKG}?overwrite=true`, auth, { annotations: filtered })
    return respond(200, { success: true, key })
  } catch (e) {
    return respond(500, { error: e.message })
  }
}

function respond (statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

module.exports = { main }
