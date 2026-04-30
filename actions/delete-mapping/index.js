const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3')
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

    const { key } = params
    if (!key) return respond(400, { error: 'key is required' })

    const client = s3(params)
    const bucket = params.AWS_BUCKET || 'genstudio-org-mapping'

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: `mappings/${key}.json` }))
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: `csv/${key}.csv` }))

    return respond(200, { success: true, key })
  } catch (e) {
    return respond(500, { error: e.message })
  }
}

function respond(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

module.exports = { main }
