class Bucket {
  /**
   * Create a new Bucket instance.
   *
   * @param {String} bucket
   * @param {Object} driver
   */
  constructor (bucket, driver) {
    this.bucket = bucket
    this.driver = driver
  }

  /**
   * Get the bucket name.
   *
   * @return {String}
   */
  get name () {
    return this.bucket
  }

  /**
   * Create a bucket.
   */
  async create () {
    try {
      await this.driver.headBucket({ Bucket: this.name })
    } catch (e) {
      await this.driver.createBucket({ Bucket: this.name })
    }
  }

  /**
   * Empty a bucket.
   */
  async empty () {
    const res = await this.driver.listObjects({ Bucket: this.name })

    for (const file of res.Contents || []) {
      await this.driver.deleteObject({ Bucket: this.name, Key: file.Key })
    }
  }

  /**
   * Delete a bucket.
   */
  async delete () {
    await this.empty()
    await this.driver.deleteBucket({ Bucket: this.name })
  }
}

module.exports = Bucket
