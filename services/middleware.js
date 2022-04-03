const express = require('express')
const apis = require('./apis')

const router = express.Router()

const integration = apis.upsertPluginIntegration()
// const webhook = apis.registerWebhook()

// The path in the URL indicates from which system the request originates
// Productboard: https://developer.productboard.com/
// Linear: https://developers.linear.app/

// Verification webhook when the plugin integration is registered
router.get('/productboard', (req, res) => {
  res.send(req.query.validationToken)
})

// A button has been pushed
router.post('/productboard', async (req, res) => {
  console.log(JSON.stringify(req.headers))
  console.dir(req.body, { depth: null })

  const data = req.body.data
  const trigger = data.trigger

  if (trigger === 'button.dismiss') {
    // potentially delete all issues w/ attachment URL = pb url
    // reset pb connection state to initial (unlinked)
    res.json({ data: { connection: { state: 'initial' } } })
  } else if (trigger === 'button.push') {
    // create issue in linear
    res.json(await apis.linkIssue(data.feature.links, data.links.connection))
  } else if (trigger === 'button.unlink') {
    // not implemented yet in Productboard
    res.json({ data: { connection: { state: 'initial' } } })
  } else {
    res.status(404).send('Unknown trigger')
  }
})

// Linear sent a webhook an issue or attachment has been changed
router.post('/linear', async (req, res) => {
  console.log(req.body)
  const body = req.body

  switch (body.type) {
    case 'Attachment':
      if (body.action === 'remove') {
        // an attachment has been removed from a linear issue, check if it's a pb linking connection
        if (body?.data?.metadata?.connection?.startsWith('https://api.productboard.com/plugin-integrations')) {
          await apis.unlinkFeature(body.data.metadata.connection)
        }
      }
      break
    case 'Issue':
      if (body.action === 'update') {
        const prevStateId = body?.updatedFrom?.stateId
        const stateId = body?.data?.state?.id

        // status has changed
        if (stateId && prevStateId !== stateId) {
          console.log('Updating status', body.data.id, prevStateId, stateId)
          await apis.updateFeatureStatus(body.data.id, body.data.state)
        }
      }

      if (body.action === 'delete') {
        // TODO unlink issue in Productboard
      }
      break
  }

  res.status(200).send()
})

module.exports = router
