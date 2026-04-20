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

async function getPkg (ns, auth) {
  return owRequest('GET', `${ns}/packages/${PKG}`, auth)
}

async function putAnnotations (ns, auth, annotations) {
  return owRequest('PUT', `${ns}/packages/${PKG}?overwrite=true`, auth, { annotations })
}

async function main (params) {
  try {
    const { key, data } = params
    const ns = params.OW_NAMESPACE
    const auth = params.OW_AUTH
    if (!key) return respond(400, { error: 'key is required' })
    if (data === undefined) return respond(400, { error: 'data is required' })

    const pkg = await getPkg(ns, auth)
    const annotations = pkg.annotations ? [...pkg.annotations] : []

    const dataKey = `data_${key}`
    const dataIdx = annotations.findIndex(a => a.key === dataKey)
    const dataEntry = { key: dataKey, value: JSON.stringify(data) }
    if (dataIdx >= 0) annotations[dataIdx] = dataEntry
    else annotations.push(dataEntry)

    const indexIdx = annotations.findIndex(a => a.key === INDEX_KEY)
    const index = indexIdx >= 0 ? JSON.parse(annotations[indexIdx].value) : []
    const ei = index.findIndex(e => e.key === key)
    const meta = { key, label: data.orgName || key, savedAt: new Date().toISOString() }
    if (ei >= 0) index[ei] = meta
    else index.push(meta)
    const indexEntry = { key: INDEX_KEY, value: JSON.stringify(index) }
    if (indexIdx >= 0) annotations[indexIdx] = indexEntry
    else annotations.push(indexEntry)

    await putAnnotations(ns, auth, annotations)
    return respond(200, { success: true, key })
  } catch (e) {
    return respond(500, { error: e.message })
  }
}

function respond (statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

module.exports = { main }
