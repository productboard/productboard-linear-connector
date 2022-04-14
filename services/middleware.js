const express = require('express')
const { body, query } = require('express-validator')
const apis = require('./apis')

const router = express.Router()

const catchAsync = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}

// The path in the URL indicates from which system the request originates
// Productboard: https://developer.productboard.com/
// Linear: https://developers.linear.app/

// Verification webhook when the plugin integration is registered
router.get(
  '/productboard*',
  query('validationToken').exists(),
  catchAsync((req, res) => {
    console.log('[productboard] received validation token')
    res.send(req.query.validationToken)
  })
)

// A button has been pushed, webhook from plugin integration
router.post(
  '/productboard/integration',
  body('data.trigger').exists(),
  catchAsync(async (req, res) => {
    const data = req.body.data
    const trigger = data.trigger

    console.log('[productboard] received connection push notification', trigger)

    if (trigger === 'button.dismiss') {
      // potentially delete all issues w/ attachment URL = pb url
      // reset pb connection state to initial (unlinked)
      console.log('[productboard] resetting connection to initial state on error dismiss')
      res.json({ data: { connection: { state: 'initial' } } })
    } else if (trigger === 'button.push') {
      // create issue in linear
      console.log('[productboard] pushed new issue to linear')
      // send data early since linkIssue can take more than 5s which Productboard doesn't like
      res.json({ data: { connection: { state: 'progress' } } })
      await apis.linkIssue(data.feature.links, data.links.connection)
    } else if (trigger === 'button.unlink') {
      console.log('[productboard] unlinked issue in linear')
      await apis.unlinkIssue(data.feature.links.html, data.links.connection)
      res.json({ data: { connection: { state: 'initial' } } })
    } else {
      console.error('[productboard] received unknown trigger', trigger)
      res.status(404).send()
    }
  })
)

// Productboard sent a webhook on feature updated/deleted
router.post(
  '/productboard/webhook',
  body('data.eventType').exists(),
  catchAsync(async (req, res) => {
    const event = req.body.data.eventType

    if (event === 'feature.deleted') {
      console.log('[productboard] unlink linear issue on feature delete')
      await apis.unlinkIssueByFeatureId(req.body.data.id)
    }

    res.status(200).send()
  })
)

// Linear sent a webhook an issue or attachment has been changed
router.post(
  '/linear',
  body('type').exists(),
  body('action').exists(),
  catchAsync(async (req, res) => {
    const body = req.body

    console.log('[linear] received webhook', body.type, body.action)

    switch (body.type) {
      case 'Attachment':
        if (body.action === 'remove') {
          // an attachment has been removed from a linear issue, check if it's a pb linking connection
          if (body?.data?.metadata?.connection?.startsWith('https://api.productboard.com/plugin-integrations')) {
            console.log('[linear] pb connection link attachment removed', body.data.metadata.connection)
            await apis.unlinkFeatureByConnection(body.data.metadata.connection)
          }
        }
        break
      case 'Issue':
        if (body.action === 'update') {
          const prevStateId = body?.updatedFrom?.stateId
          const stateId = body?.data?.state?.id

          // status has changed
          if (stateId && prevStateId !== stateId) {
            console.log('[linear] issue status updated, updating pb feature', body.data.id, prevStateId, stateId)
            await apis.updateFeatureStatus(body.data.id, body.data.state)
          }
        }

        if (body.action === 'remove') {
          console.log('[linear] issue deleted in linear, unlinking in pb')
          await apis.unlinkFeatureByIssueId(body.data.id)
        }
        break
    }

    res.status(200).send()
  })
)

module.exports = router
