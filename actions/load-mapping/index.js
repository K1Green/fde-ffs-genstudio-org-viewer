const https = require('https')

const PKG = 'genstudio-org-viewer'

function owRequest (ns, auth) {
  return new Promise((resolve, reject) => {
    const authB64 = Buffer.from(auth).toString('base64')
    https.get({
      hostname: 'adobeioruntime.net',
      path: `/api/v1/namespaces/${ns}/packages/${PKG}`,
      headers: { Authorization: `Basic ${authB64}` }
    }, res => {
      let raw = ''
      res.on('data', c => { raw += c })
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(null) } })
    }).on('error', reject)
  })
}

async function main (params) {
  try {
    const { key } = params
    const ns = params.OW_NAMESPACE
    const auth = params.OW_AUTH
    if (!key) return respond(400, { error: 'key is required' })

    const pkg = await owRequest(ns, auth)
    const annotations = pkg && pkg.annotations ? pkg.annotations : []
    const entry = annotations.find(a => a.key === `data_${key}`)
    const data = entry ? JSON.parse(entry.value) : null
    return respond(200, { data })
  } catch (e) {
    return respond(500, { error: e.message })
  }
}

function respond (statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

module.exports = { main }
