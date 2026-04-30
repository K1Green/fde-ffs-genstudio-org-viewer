const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3')
const { validateToken } = require('../_utils/auth')

function s3(params) {
  return new S3Client({
    region: params.AWS_REGION || 'us-east-1',
    credentials: { accessKeyId: params.AWS_ACCESS_KEY_ID, secretAccessKey: params.AWS_SECRET_ACCESS_KEY }
  })
}

async function main(params) {
  try {
    const valid = await validateToken(params)
    if (!valid) return respond(401, { error: 'Unauthorized' })

    const client = s3(params)
    const bucket = params.AWS_BUCKET || 'genstudio-org-mapping'

    const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'mappings/' }))
    const mappings = (res.Contents || [])
      .filter(o => o.Key.endsWith('.json'))
      .map(o => {
        const key = o.Key.replace('mappings/', '').replace('.json', '')
        return { key, label: key.replace(/_/g, ' '), savedAt: o.LastModified }
      })
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))

    return respond(200, { mappings })
  } catch (e) {
    return respond(500, { error: e.message })
  }
}

function respond(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

module.exports = { main }
