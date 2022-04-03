const { LinearClient } = require('@linear/sdk')
const axios = require('axios')
const TurndownService = require('turndown')

const turndown = new TurndownService()

const linear = new LinearClient({ apiKey: process.env.LINEAR_API_KEY })
const team = process.env.LINEAR_TEAM_ID

const productboard = axios.create({
  headers: {
    common: {
      Authorization: 'Bearer ' + process.env.PRODUCTBOARD_API_KEY,
      'X-Version': 1
    }
  }
})

const baseUrl = 'https://pbvv.ngrok.io'
const identifier = 'com.productboard.community.linear.' + team

// https://nucleus.productboard.net/components/?path=/story/foundation-color-status-color--page
const colors = {
  gray: '#d4dbe1',
  blue: '#2693ff',
  green: '#79ce17',
  yellow: '#ffc600',
  orange: '#fb8f37',
  red: '#ff4747',
  purple: '#9c46f1'
}
const nearestColor = require('nearest-color').from(colors)

/**
 * Ensures the plugin integration exists in Productboard
 *
 * The integration ID is needed to process Linear webhooks, so the upsert happens on every startup of this middleware
 * and the ID is stored in memory for pairing purposes
 */
const upsertPluginIntegration = async () => {
  const url = '/productboard'

  const payload = {
    data: {
      integrationStatus: 'enabled',
      type: identifier,
      name: 'Linear',
      initialState: {
        label: 'To Linear'
      },
      action: {
        url: url,
        version: 1,
        headers: {
          authorization: team
        }
      }
    }
  }

  const integrations = await productboard.get('https://api.productboard.com/plugin-integrations')
  const integration = integrations.data.data.find(el => el.type === identifier)

  if (integration) {
    return integration
  } else {
    const res = await productboard.post('https://api.productboard.com/plugin-integrations', payload)

    return res.data
  }
}

/**
 * Ensures the webhook in Linear exists
 * - listen on Issue status changes => change pb status column label
 * - listen on Issue deletions => unlink pb connection
 * - listen on Attachment deletion => unlink pb connection
 */
const registerWebhook = async () => {
  try {
    // linear SDK is broken here, it's asking for an invalid field on the API (teamIds)
    // we issue a raw query instead
    // const webhook = await linear.webhook(identifier)
    // TODO: Use proper GrapHQL variables
    const query = `query {
      webhook(id: "${identifier}") {
        id
      }
    }`
    const response = await linear.client.request(query)
    console.log('Webhook found', response)
  } catch (e) {
    linear.webhookCreate({
      id: identifier,
      teamId: team,
      url: baseUrl + '/linear',
      label: 'Productboard integration',
      resourceTypes: ['Issue', 'Attachment']
    })
  }
}

/**
 * - Creates an issue in Linear
 *   - converts HTML to Markdown
 * - Links the Productboard URL as an attachment
 * - Stores the integration connection in the attachment metadata
 */
const linkIssue = async (pbLink, connectionLink) => {
  const feature = (await productboard.get(pbLink.self)).data.data

  const issueCreate = await linear.issueCreate({
    teamId: team,
    title: feature.name,
    description: turndown.turndown(feature.description)
  })

  if (issueCreate.success) {
    const issue = await issueCreate.issue
    console.log(issue)

    const attachmentCreate = await linear.attachmentLinkURL(issue.id, pbLink.html, { title: 'Feature in Productboard' })
    const attachment = await attachmentCreate.attachment

    // We store the connection link in the attachment metadata
    // The GraphQL doesn't expose that field in the call above, so a 2nd call is neeeded
    await linear.attachmentUpdate(attachment.id, { title: 'Feature in Productboard', metadata: { connection: connectionLink } })

    const { label, color } = mapLinearState(await issue.state)

    return {
      data: {
        connection: {
          state: 'connected',
          label,
          hoverLabel: issue.identifier,
          tooltip: issue.identifier,
          color,
          targetUrl: issue.url
        }
      }
    }
  } else {
    console.error(issueCreate.Error)
    throw issueCreate.Error
  }
}

const mapLinearState = (state) => {
  return {
    label: state.name.substring(0, 20),
    color: nearestColor(state.color).name
  }
}

const unlinkFeature = async (connectionLink) => {
  await productboard.delete(connectionLink)
}

const updateFeatureStatus = async (issueId, newState) => {
  // the linear SDK does not return metadata on attachments by default, we need to issue our own query
  // TODO: Use proper GraphQL variables
  const query = `query {
    issue(id: "${issueId}") {
      identifier
      url
      attachments {
        nodes {
          metadata
        }
      }
    }
  }`

  const response = await linear.client.request(query)
  const issue = response.issue
  const attachments = response.issue.attachments

  for (const a of attachments.nodes) {
    if (a?.metadata?.connection?.startsWith('https://api.productboard.com/plugin-integrations')) {
      const { label, color } = mapLinearState(newState)
      const payload = {
        data: {
          connection: {
            state: 'connected',
            label,
            hoverLabel: issue.identifier,
            tooltip: issue.identifier,
            color,
            targetUrl: issue.url
          }
        }
      }

      await productboard.put(a.metadata.connection, payload)
    }
  }
}

module.exports = { linkIssue, upsertPluginIntegration, registerWebhook, unlinkFeature, updateFeatureStatus }
