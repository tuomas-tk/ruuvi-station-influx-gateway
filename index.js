/**
 * Ruuvi Station mobile application gateway API server implementation
 * https://ruuvi.com/manuals/station/app-settings/
 *
 * Unofficial open-source implementation with Node.js and Express
 * https://expressjs.com/en/api.html
 */

'use strict'

const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const express = require('express')
const { InfluxDB, Point, WritePrecision } = require('@influxdata/influxdb-client')

dotenv.config()

const application = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
}

const influx = {
  url: process.env.INFLUX_URL,
  token: process.env.INFLUX_TOKEN,
  org: process.env.INFLUX_ORG,
  bucket: process.env.INFLUX_BUCKET,
}

const app = express()

app.use(bodyParser.json())

const SKIP_VALUES = ['id', 'name', 'updateAt']

/**
 * Parse data from Ruuvi Station mobile application JSON payload
 * Push data to InfluxDB via configured environment
 */
app.post('/api/station', function (req, res) {
  console.debug('Received Ruuvi Station gateway API payload request')
  console.debug(req.body)

  const client = new InfluxDB({ url: influx.url, token: influx.token })
  const writeApi = client.getWriteApi(influx.org, influx.bucket, 'ms')

  const measurement = req.body
  for (const tag of measurement.tags) {
    const id = tag.id

    for (const key in tag) {
      if (SKIP_VALUES.includes(key)) continue;
      const value = tag[key]

      let point = new Point('ruuvi_measurement')
        .tag('id', id)
        .tag('deviceID', measurement.deviceID)
        .floatField('stationBatteryLevel', measurement.batteryLevel)
        .floatField('stationTime', measurement.time)
        .timestamp(new Date(tag.updateAt).getTime())

      if (tag.name) {
        point = point.tag('name', tag.name)
      }

      switch (typeof (value)) {
        case 'number':
          point = point.floatField(key, value)
          break
        case 'string':
          point = point.stringField(key, value)
          break
        case 'boolean':
          point = point.booleanField(key, value)
          break
        default:
          continue
      }

      console.debug(`Writing ${key}=${value} for Ruuvi tag ${id}`)
      writeApi.writePoint(point)
    }
  }

  writeApi.close()
    .then(() => {
      console.debug(`Wrote eventId ${measurement.eventId} to InfluxDB`)
    })
    .catch(e => {
      console.error(`Failed to write eventId ${measurement.eventId} to InfluxDB`)
      console.error(e)
    })

  res.json({ 'eventId': measurement.eventId })
})

app.get('/api/health', function (_, res) {
  console.debug('Received Ruuvi Station gateway API health check request')
  res.json({ 'status': 'OK' })
})

app.listen(application.port, application.host)
console.log(`Application listening for address ${application.host}:${application.port}`)
