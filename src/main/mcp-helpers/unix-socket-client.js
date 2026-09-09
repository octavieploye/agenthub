'use strict'

const net = require('net')

/**
 * Send a JSON payload over a Unix socket and receive a JSON response.
 * @param {string} socketPath
 * @param {object} payload
 * @param {number} timeoutMs
 * @returns {Promise<object>}
 */
async function socketRequest(socketPath, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let timer = null
    const client = net.createConnection(socketPath, () => {
      client.write(JSON.stringify(payload) + '\n')
      client.end()
    })

    let buf = ''
    client.on('data', (chunk) => { buf += chunk.toString() })
    client.on('end', () => {
      if (timer) clearTimeout(timer)
      try {
        resolve(JSON.parse(buf))
      } catch {
        reject(new Error(`invalid JSON response: ${buf}`))
      }
    })
    client.on('error', (err) => {
      if (timer) clearTimeout(timer)
      reject(new Error(`socket connection failed: ${err.message}`))
    })

    timer = setTimeout(() => {
      client.destroy()
      reject(new Error(`socket timeout after ${timeoutMs}ms`))
    }, timeoutMs)
  })
}

module.exports = { socketRequest }
