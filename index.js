const express = require('express')
const { isUUID, isURL, isEmpty } = require('validator')

const middleware = require('./services/middleware')

const PORT = process.env.PORT || 3001

const requiredConfig = {
  BASE_URL: val => isURL(val, { protocols: ['https'], require_protocol: true, allow_fragments: false, allow_query_components: false }),
  LINEAR_TEAM_ID: isUUID,
  PRODUCTBOARD_API_KEY: val => !isEmpty(val),
  LINEAR_API_KEY: val => !isEmpty(val)
}

for (const [key, validator] of Object.entries(requiredConfig)) {
  if (!process.env[key]) {
    console.error('Missing required config env var, check README: ', key)
    process.exit(1)
  }

  if (!validator(process.env[key])) {
    console.error('Misconfigured config env var, check README: ', key)
    process.exit(1)
  }
}

express()
  .use(require('morgan')('dev'))
  .use(express.json())
  .use('/', middleware)
  .use((err, req, res, next) => {
    console.error(err.stack)
    res.sendStatus(500)
  })
  .listen(PORT, () => console.log(`Listening on ${PORT}`))
