# @voom/cube

#### [S3](https://aws.amazon.com/s3) wrapper for [Hapi](https://hapi.dev).

This plugin exposes a cube instance within your server.

## Installation

```shell script
npm install @voom/cube
```

## Usage

```js
const Hapi = require('@hapi/hapi')
const Cube = require('@voom/cube')

async function start () {
  const server = Hapi.Server()

  await server.register({
    plugin: Cube,
    options: {
      connection: {
        access: 'access',
        secret: 'secret',
        bucket: 'bucket',
        region: 'region'
      },
      location: {
        base: 'https://{bucket}.s3.amazonaws.com',
        path: false
      }
    }
  })

  await server.start()

  // Store a file
  await server.cube().put('avatars/1', file)

  // Retrieve a file
  const { stream } = await server.cube().get('avatars/1')

  // Determine if a file exists
  const { exists } = await server.cube().exists('avatars/1')

  // Get the metadata for a file
  const { size } = await server.cube().meta('avatars/1')

  // Get the path for a file
  const path = server.cube().path('avatars/1')

  // Delete a file
  await server.cube().delete('avatars/1')
}

start()
```

### Upload a file

Here is a basic route to handle a single file:

```js
server.route({
  method: 'POST',
  path: '/upload',
  options: {
    payload: {
      output: 'stream',
      multipart: true
    }
  },
  async handler (request) {
    const { file } = request.payload

    const name = file.hapi.filename

    await request.cube().put(name, file)

    return request.cube().path(name)
  }
})
```
