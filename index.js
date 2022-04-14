const express = require('express')

const middleware = require('./services/middleware')

const PORT = process.env.PORT || 3001

express()
  .use(require('morgan')('dev'))
  .use(express.json())
  .use('/', middleware)
  .use((err, req, res, next) => {
    console.error(err.stack)
    res.sendStatus(500)
  })
  .listen(PORT, () => console.log(`Listening on ${PORT}`))
