const Joi = require('joi')
const Cube = require('./cube')

class Plugin {
  /**
   * Plugin package.
   *
   * @return {Object}
   */
  static get package () {
    return require('../package.json')
  }

  /**
   * Plugin registration.
   *
   * @param {...Object} options
   */
  static async register (...options) {
    return new Plugin(...options).register()
  }

  /**
   * Plugin as Object.
   *
   * @return {Object}
   */
  static asObject () {
    return { pkg: this.package, register: this.register }
  }

  /**
   * Create a new Plugin instance.
   *
   * @param {Object} server
   * @param {Object} options
   */
  constructor (server, options) {
    this.server = server
    this.options = Joi.attempt(options, this.schema)
  }

  /**
   * Plugin instance registration.
   */
  async register () {
    this.cube = new Cube(this.options)

    this.server.decorate('server', 'cube', () => this.cube)
    this.server.decorate('request', 'cube', () => this.cube)
  }

  /**
   * Options schema.
   *
   * @return {Object}
   */
  get schema () {
    return Joi.object({
      connection: Joi.object().required().keys({
        access: Joi.string().required(),
        secret: Joi.string().required(),
        bucket: Joi.string().required(),
        region: Joi.string().required(),
        endpoint: Joi.string()
      }),
      location: Joi.object().default().keys({
        base: Joi.string().default('https://{bucket}.s3.amazonaws.com'),
        path: Joi.boolean().default(false)
      })
    })
  }
}

module.exports = Plugin
