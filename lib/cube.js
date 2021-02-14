const Bucket = require('./bucket')
const { S3 } = require('@aws-sdk/client-s3')
const { Upload } = require('@aws-sdk/lib-storage')

class Cube {
  /**
   * Create a new Cube instance.
   *
   * @param {Object} options
   */
  constructor (options) {
    this.location = options.location
    this.connection = options.connection

    this.driver = new S3(this.config)
    this.bucket = new Bucket(this.connection.bucket, this.driver)
  }

  /**
   * Get the bucket configuration.
   *
   * @return {Object}
   */
  get config () {
    return {
      region: this.connection.region,
      endpoint: this.connection.endpoint,
      forcePathStyle: this.location.path,
      credentials: this.credentials
    }
  }

  /**
   * Get the bucket credentials.
   *
   * @return {Object}
   */
  get credentials () {
    return {
      accessKeyId: this.connection.access,
      secretAccessKey: this.connection.secret
    }
  }

  /**
   * Get the bucket root.
   *
   * @return {String}
   */
  get root () {
    const { base, path } = this.location
    const { bucket, region } = this.connection

    if (path) return [base, bucket].join('/')

    return base
      .replace('{bucket}', bucket)
      .replace('{region}', region)
  }

  /**
   * Write the contents of a file.
   *
   * @param {String} location
   * @param {Object} content
   * @return {Object}
   */
  async put (location, content) {
    const params = { Bucket: this.bucket.name, Key: location, Body: content }

    const res = await new Upload({ client: this.driver, params }).done()

    return { raw: res }
  }

  /**
   * Get the contents of a file.
   *
   * @param {String} location
   * @return {Object}
   */
  async get (location) {
    const res = await this.driver.getObject({ Bucket: this.bucket.name, Key: location })

    return { stream: res.Body, raw: res }
  }

  /**
   * Copy a file to a new location.
   *
   * @param {String} from
   * @param {String} to
   */
  async copy (from, to) {
    const src = `/${this.bucket.name}/${from}`

    const res = await this.driver.copyObject({ Bucket: this.bucket.name, Key: to, CopySource: src })

    return { raw: res }
  }

  /**
   * Move a file to a new location.
   *
   * @param {String} from
   * @param {String} to
   */
  async move (from, to) {
    await this.copy(from, to)
    await this.delete(from)
  }

  /**
   * Get the file metadata of a given file.
   *
   * @param {String} location
   * @return {Object}
   */
  async meta (location) {
    const res = await this.driver.headObject({ Bucket: this.bucket.name, Key: location })

    return { size: res.ContentLength, modified: res.LastModified, raw: res }
  }

  /**
   * Delete the file at a given location.
   *
   * @param {String} location
   * @return {Object}
   */
  async delete (location) {
    const res = await this.driver.deleteObject({ Bucket: this.bucket.name, Key: location })

    return { raw: res }
  }

  /**
   * Determine if a file exists.
   *
   * @param {String} location
   * @return {Object}
   */
  async exists (location) {
    try {
      const res = await this.meta(location)

      return { exists: true, ...res }
    } catch (e) {
      return { exists: false, raw: e }
    }
  }

  /**
   * Get the full path for the file at the given location.
   *
   * @param {String} location
   * @return {String}
   */
  path (location) {
    return [this.root, location].join('/')
  }
}

module.exports = Cube
