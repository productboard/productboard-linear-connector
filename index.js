const express = require('express')

const middleware = require('./services/middleware')

const PORT = process.env.PORT || 3001

express()
  .use(require('morgan')('dev'))
  .use(express.json())
  .use('/', middleware)
  .listen(PORT, () => console.log(`Listening on ${PORT}`))
