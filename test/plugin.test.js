require('dotenv/config')

const Fs = require('fs')
const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const Hapi = require('@hapi/hapi')
const Stream = require('get-stream')
const FormData = require('form-data')
const AWS = require('@aws-sdk/client-s3')

const Plugin = require('../lib')

const { expect } = Code
const { describe, it, beforeEach, afterEach } = exports.lab = Lab.script()

const defaults = {
  key: process.env.CUBE_KEY,
  secret: process.env.CUBE_SECRET,
  bucket: process.env.CUBE_BUCKET,
  region: process.env.CUBE_REGION,
  endpoint: process.env.CUBE_ENDPOINT
}

const s3 = new AWS.S3({
  region: defaults.region,
  endpoint: defaults.endpoint,
  credentials: {
    accessKeyId: defaults.key,
    secretAccessKey: defaults.secret
  }
})

async function withServer (options) {
  const server = Hapi.Server()

  await server.register({
    plugin: Plugin,
    options: Object.assign({}, defaults, options)
  })

  return server
}

describe('plugin', function () {
  beforeEach(async function () {
    try {
      await s3.headBucket({ Bucket: defaults.bucket })
    } catch (e) {
      await s3.createBucket({ Bucket: defaults.bucket })
    }
  })

  afterEach(async function () {
    const res = await s3.listObjects({ Bucket: defaults.bucket })

    for (const file of (res.Contents || [])) {
      await s3.deleteObject({ Bucket: defaults.bucket, Key: file.Key })
    }

    await s3.deleteBucket({ Bucket: defaults.bucket })
  })

  it('throws an error when options are missing', async function () {
    const server = Hapi.Server()

    await expect(server.register(Plugin)).to.reject()
  })

  it('exposes cube instance', async function () {
    const server = await withServer()

    expect(server.cube).to.be.a.function()

    server.route({
      method: 'GET',
      path: '/plugin',
      handler (request, h) {
        expect(request.cube).to.be.a.function()
        expect(request.cube()).to.be.equal(server.cube())

        return h.response().code(200)
      }
    })

    const res = await server.inject('/plugin')

    expect(res.statusCode).to.be.equal(200)
  })

  it('handles an hapi file from buffer', async function () {
    const server = await withServer()

    server.route({
      method: 'POST',
      path: '/plugin',
      options: {
        payload: {
          output: 'data',
          multipart: true
        }
      },
      async handler (request, h) {
        const { cube } = request
        const { file } = request.payload

        const name = 'file.txt'

        const res = await cube().put(name, file)

        expect(res.raw).to.be.an.object()

        const { exists } = await cube().exists(name)

        expect(exists).to.be.true()

        return h.response().code(204)
      }
    })

    const form = new FormData()

    form.append('name', 'spri')
    form.append('file', Fs.createReadStream(__filename))

    const payload = await Stream.buffer(form)

    const res = await server.inject({
      method: 'POST',
      url: '/plugin',
      payload: payload,
      headers: form.getHeaders()
    })

    expect(res.statusCode).to.be.equal(204)
  })

  it('handles an hapi file from stream', async function () {
    const server = await withServer()

    server.route({
      method: 'POST',
      path: '/plugin',
      options: {
        payload: {
          output: 'stream',
          multipart: true
        }
      },
      async handler (request, h) {
        const { cube } = request
        const { file } = request.payload

        const name = 'file.txt'

        const res = await cube().put(name, file)

        expect(res.raw).to.be.an.object()

        const { exists } = await cube().exists(name)

        expect(exists).to.be.true()

        return h.response().code(204)
      }
    })

    const form = new FormData()

    form.append('name', 'spri')
    form.append('file', Fs.createReadStream(__filename))

    const payload = await Stream.buffer(form)

    const res = await server.inject({
      method: 'POST',
      url: '/plugin',
      payload: payload,
      headers: form.getHeaders()
    })

    expect(res.statusCode).to.be.equal(204)
  })

  it('puts a file from string', async function () {
    const server = await withServer()

    const { cube } = server

    const name = 'file.txt'
    const data = 'hello world'

    const res = await cube().put(name, data)

    expect(res.raw).to.be.an.object()

    const { exists } = await cube().exists(name)

    expect(exists).to.be.true()
  })

  it('puts a file from buffer', async function () {
    const server = await withServer()

    const { cube } = server

    const name = 'file.txt'
    const data = Buffer.from('hello world', 'utf-8')

    const res = await cube().put(name, data)

    expect(res.raw).to.be.an.object()

    const { exists } = await cube().exists(name)

    expect(exists).to.be.true()
  })

  it('puts a file from stream', async function () {
    const server = await withServer()

    const { cube } = server

    const name = 'file.txt'
    const data = Fs.createReadStream(__filename)

    const res = await cube().put(name, data)

    expect(res.raw).to.be.an.object()

    const { exists } = await cube().exists(name)

    expect(exists).to.be.true()
  })

  it('gets a file as stream', async function () {
    const server = await withServer()

    const { cube } = server

    const name = 'file.txt'
    const data = 'hello world'

    await cube().put(name, data)

    const res = await cube().get(name)

    expect(res.raw).to.be.an.object()

    const buffer = await Stream.buffer(res.stream)

    expect(buffer.toString('utf-8')).to.be.equal(data)
  })

  it('gets a file that does not exist', async function () {
    const server = await withServer()

    const { cube } = server

    try {
      await cube().get('missing.txt')

      Code.fail()
    } catch (e) {
      expect(e.message).to.be.equal('NoSuchKey')
    }
  })

  it('gets a file metadata', async function () {
    const server = await withServer()

    const { cube } = server

    const name = 'file.txt'
    const data = 'hello world'

    await cube().put(name, data)

    const res = await cube().meta(name)

    expect(res.raw).to.be.an.object()

    expect(res.size).to.be.equal(data.length)
  })

  it('gets a file path', async function () {
    const server = await withServer({ url: 'url', bucket: 'bucket' })

    const { cube } = server

    expect(cube().path('file.txt')).to.be.equal('url/bucket/file.txt')
    expect(cube().path('avatars/1')).to.be.equal('url/bucket/avatars/1')
  })

  it('moves a file', async function () {
    const server = await withServer()

    const { cube } = server

    const orig = 'orig/file.txt'
    const copy = 'copy/file.txt'

    await cube().put(orig, 'hello world')

    const { exists: one } = await cube().exists(copy)

    expect(one).to.be.false()

    await cube().move(orig, copy)

    const { exists: two } = await cube().exists(orig)

    expect(two).to.be.false()

    const { exists: three } = await cube().exists(copy)

    expect(three).to.be.true()
  })

  it('copies a file', async function () {
    const server = await withServer()

    const { cube } = server

    const orig = 'orig/file.txt'
    const copy = 'copy/file.txt'

    await cube().put(orig, 'hello world')

    const { exists: one } = await cube().exists(copy)

    expect(one).to.be.false()

    await cube().copy(orig, copy)

    const { exists: two } = await cube().exists(orig)

    expect(two).to.be.true()

    const { exists: three } = await cube().exists(copy)

    expect(three).to.be.true()
  })

  it('deletes a file', async function () {
    const server = await withServer()

    const { cube } = server

    const name = 'file.txt'
    const data = 'hello world'

    await cube().put(name, data)

    const res = await cube().delete(name)

    expect(res.raw).to.be.an.object()

    const { exists } = await cube().exists(name)

    expect(exists).to.be.false()
  })
})
