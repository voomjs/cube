require('dotenv/config')

const Fs = require('fs')
const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const Hapi = require('@hapi/hapi')
const Stream = require('get-stream')
const FormData = require('form-data')

const Plugin = require('../lib')

const { expect } = Code
const { describe, it } = exports.lab = Lab.script()

const defaults = {
  connection: {
    access: process.env.CUBE_ACCESS,
    secret: process.env.CUBE_SECRET,
    bucket: process.env.CUBE_BUCKET,
    region: process.env.CUBE_REGION,
    endpoint: process.env.CUBE_ENDPOINT
  },
  location: {
    path: true
  }
}

async function withServer (options) {
  const server = Hapi.Server()

  await server.register({
    plugin: Plugin,
    options: Object.assign({}, defaults, options)
  })

  return server
}

describe('plugin', function () {
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

    await server.cube().bucket.create()

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
        const name = 'file.txt'
        const file = request.payload.file

        const res = await request.cube().put(name, file)

        expect(res.raw).to.be.an.object()

        const { exists } = await request.cube().exists(name)

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

    await server.cube().bucket.delete()
  })

  it('handles an hapi file from stream', async function () {
    const server = await withServer()

    await server.cube().bucket.create()

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
        const name = 'file.txt'
        const file = request.payload.file

        const res = await request.cube().put(name, file)

        expect(res.raw).to.be.an.object()

        const { exists } = await request.cube().exists(name)

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

    await server.cube().bucket.delete()
  })

  it('puts a file from string', async function () {
    const server = await withServer()

    await server.cube().bucket.create()

    const name = 'file.txt'
    const data = 'hello world'

    const res = await server.cube().put(name, data)

    expect(res.raw).to.be.an.object()

    const { exists } = await server.cube().exists(name)

    expect(exists).to.be.true()

    await server.cube().bucket.delete()
  })

  it('puts a file from buffer', async function () {
    const server = await withServer()

    await server.cube().bucket.create()

    const name = 'file.txt'
    const data = Buffer.from('hello world', 'utf-8')

    const res = await server.cube().put(name, data)

    expect(res.raw).to.be.an.object()

    const { exists } = await server.cube().exists(name)

    expect(exists).to.be.true()

    await server.cube().bucket.delete()
  })

  it('puts a file from stream', async function () {
    const server = await withServer()

    await server.cube().bucket.create()

    const name = 'file.txt'
    const data = Fs.createReadStream(__filename)

    const res = await server.cube().put(name, data)

    expect(res.raw).to.be.an.object()

    const { exists } = await server.cube().exists(name)

    expect(exists).to.be.true()

    await server.cube().bucket.delete()
  })

  it('gets a file as stream', async function () {
    const server = await withServer()

    await server.cube().bucket.create()

    const name = 'file.txt'
    const data = 'hello world'

    await server.cube().put(name, data)

    const res = await server.cube().get(name)

    expect(res.raw).to.be.an.object()

    const buffer = await Stream.buffer(res.stream)

    expect(buffer.toString('utf-8')).to.be.equal(data)

    await server.cube().bucket.delete()
  })

  it('gets a file that does not exist', async function () {
    const server = await withServer()

    await server.cube().bucket.create()

    try {
      await server.cube().get('missing.txt')

      Code.fail()
    } catch (e) {
      expect(e.message).to.be.equal('NoSuchKey')
    }

    await server.cube().bucket.delete()
  })

  it('gets a file metadata', async function () {
    const server = await withServer()

    await server.cube().bucket.create()

    const name = 'file.txt'
    const data = 'hello world'

    await server.cube().put(name, data)

    const res = await server.cube().meta(name)

    expect(res.raw).to.be.an.object()

    expect(res.size).to.be.equal(data.length)

    await server.cube().bucket.delete()
  })

  it('gets a file path - path style', async function () {
    const server = await withServer({
      location: {
        path: true,
        base: 'base'
      }
    })

    const { bucket } = defaults.connection

    expect(server.cube().path('file.txt')).to.be.equal(`base/${bucket}/file.txt`)
    expect(server.cube().path('avatars/1')).to.be.equal(`base/${bucket}/avatars/1`)
  })

  it('gets a file path - virtual hosted style', async function () {
    const server = await withServer({
      location: {
        path: false,
        base: '{bucket}.{region}.base'
      }
    })

    const { bucket, region } = defaults.connection

    expect(server.cube().path('file.txt')).to.be.equal(`${bucket}.${region}.base/file.txt`)
    expect(server.cube().path('avatars/1')).to.be.equal(`${bucket}.${region}.base/avatars/1`)
  })

  it('moves a file', async function () {
    const server = await withServer()

    await server.cube().bucket.create()

    const orig = 'orig/file.txt'
    const copy = 'copy/file.txt'

    await server.cube().put(orig, 'hello world')

    const { exists: one } = await server.cube().exists(copy)

    expect(one).to.be.false()

    await server.cube().move(orig, copy)

    const { exists: two } = await server.cube().exists(orig)

    expect(two).to.be.false()

    const { exists: three } = await server.cube().exists(copy)

    expect(three).to.be.true()

    await server.cube().bucket.delete()
  })

  it('copies a file', async function () {
    const server = await withServer()

    await server.cube().bucket.create()

    const orig = 'orig/file.txt'
    const copy = 'copy/file.txt'

    await server.cube().put(orig, 'hello world')

    const { exists: one } = await server.cube().exists(copy)

    expect(one).to.be.false()

    await server.cube().copy(orig, copy)

    const { exists: two } = await server.cube().exists(orig)

    expect(two).to.be.true()

    const { exists: three } = await server.cube().exists(copy)

    expect(three).to.be.true()

    await server.cube().bucket.delete()
  })

  it('deletes a file', async function () {
    const server = await withServer()

    await server.cube().bucket.create()

    const name = 'file.txt'
    const data = 'hello world'

    await server.cube().put(name, data)

    const res = await server.cube().delete(name)

    expect(res.raw).to.be.an.object()

    const { exists } = await server.cube().exists(name)

    expect(exists).to.be.false()

    await server.cube().bucket.delete()
  })
})
