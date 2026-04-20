const https = require('https')

const PKG = 'genstudio-org-viewer'
const INDEX_KEY = '__mappings_index'

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
    const ns = params.OW_NAMESPACE
    const auth = params.OW_AUTH
    const pkg = await owRequest(ns, auth)
    const annotations = pkg && pkg.annotations ? pkg.annotations : []
    const indexEntry = annotations.find(a => a.key === INDEX_KEY)
    const mappings = indexEntry ? JSON.parse(indexEntry.value) : []
    return respond(200, { mappings })
  } catch (e) {
    return respond(500, { error: e.message })
  }
}

function respond (statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

module.exports = { main }
