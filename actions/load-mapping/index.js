const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const { validateToken } = require('../_utils/auth')

function s3(params) {
  return new S3Client({
    region: params.AWS_REGION || 'us-east-1',
    credentials: { accessKeyId: params.AWS_ACCESS_KEY_ID, secretAccessKey: params.AWS_SECRET_ACCESS_KEY }
  })
}

async function streamToString(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf-8')
}

async function main(params) {
  try {
    const valid = await validateToken(params)
    if (!valid) return respond(401, { error: 'Unauthorized' })

    const { key } = params
    if (!key) return respond(400, { error: 'key is required' })

    const client = s3(params)
    const bucket = params.AWS_BUCKET || 'genstudio-org-mapping'

    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: `mappings/${key}.json` }))
    const data = JSON.parse(await streamToString(res.Body))
    return respond(200, { data })
  } catch (e) {
    if (e.name === 'NoSuchKey') return respond(404, { data: null })
    return respond(500, { error: e.message })
  }
}

function respond(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

module.exports = { main }
