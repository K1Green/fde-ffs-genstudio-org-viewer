const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { validateToken } = require('../_utils/auth')

const BUCKET = process.env.AWS_BUCKET || 'genstudio-org-mapping'

function s3(params) {
  return new S3Client({
    region: params.AWS_REGION || 'us-east-1',
    credentials: { accessKeyId: params.AWS_ACCESS_KEY_ID, secretAccessKey: params.AWS_SECRET_ACCESS_KEY }
  })
}

function toCSV(data) {
  const headers = ['Customer Name','USER Name','Title','Persona','GenStudio Role',
    'Campaign identification','Brands / products setup','Add media assets','Template design',
    'Assemble ad variations','Review & approval','Activation to channel','Insights dashboard',
    'Economic Buyer (Y/N)','Reports To']
  const esc = v => `"${String(v||'').replace(/"/g,'""')}"`
  const rows = (data.users||[]).map(u => [
    data.orgName, u.name, u.title, u.persona, u.role,
    u.campaign?'Y':'N', u.brands?'Y':'N', u.assets?'Y':'N', u.template?'Y':'N',
    u.assemble?'Y':'N', u.review?'Y':'N', u.activation?'Y':'N', u.insights?'Y':'N',
    u.economicBuyer?'Y':'N', u.reportsTo
  ].map(esc).join(','))
  return [headers.join(','), ...rows].join('\n')
}

async function main(params) {
  try {
    const valid = await validateToken(params)
    if (!valid) return respond(401, { error: 'Unauthorized' })

    const { key, data } = params
    if (!key) return respond(400, { error: 'key is required' })
    if (data === undefined) return respond(400, { error: 'data is required' })

    const client = s3(params)
    const bucket = params.AWS_BUCKET || BUCKET

    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: `mappings/${key}.json`,
      Body: JSON.stringify(data), ContentType: 'application/json'
    }))

    await client.send(new PutObjectCommand({
      Bucket: bucket, Key: `csv/${key}.csv`,
      Body: toCSV(data), ContentType: 'text/csv'
    }))

    return respond(200, { success: true, key })
  } catch (e) {
    return respond(500, { error: e.message })
  }
}

function respond(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

module.exports = { main }
