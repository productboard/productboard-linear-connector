const { LinearClient } = require('@linear/sdk')
const axios = require('axios')
const TurndownService = require('turndown')
const gql = require('graphql-tag')

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
  const matched = integrations.data.data.find(el => el.type === identifier)

  if (matched) {
    return matched
  } else {
    const res = await productboard.post('https://api.productboard.com/plugin-integrations', payload)

    return res.data
  }
}
const pluginIntegration = upsertPluginIntegration()

/**
 * Ensures the webhook in Linear exists
 * - listen on Issue status changes => change pb status column label
 * - listen on Issue deletions => unlink pb connection
 * - listen on Attachment deletion => unlink pb connection
 */
const registerWebhook = async () => {
  const webhookUrl = baseUrl + '/linear'
  // linear SDK is broken here, it's asking for an invalid field on the API (teamIds)
  const query = gql`query Webhooks($cursor: String) {
    webhooks(first: 50, after: $cursor) {
      nodes {
        id
        url
        label
        team { id }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
  `

  const findWebhook = w => w.url === webhookUrl && w.team.id === team

  let webhooks = (await linear.client.request(query, { cursor: null })).webhooks

  let webhook = webhooks.nodes.find(findWebhook)
  if (webhook) {
    console.log("Found webhook registered in linear", webhookUrl)
    return webhook
  }

  while (webhooks.pageInfo.hasNextPage) {
    webhooks = await (await linear.client.request(query, { cursor: webhooks.pageInfo.endCursor })).webhooks
    webhook = webhooks.nodes.find(findWebhook)
    if (webhook) {
      return webhook
    }
  }

  console.log('Linear webhook not found, creating', webhookUrl)
  linear.webhookCreate({
    teamId: team,
    url: webhookUrl,
    label: 'Productboard integration',
    resourceTypes: ['Issue', 'Attachment']
  })
}
registerWebhook()

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

    const attachmentCreate = await linear.attachmentLinkURL(issue.id, pbLink.html, { title: 'Feature in Productboard' })
    const attachment = await attachmentCreate.attachment

    // We store the connection link in the attachment metadata
    // The GraphQL doesn't expose that field in the call above, so a 2nd call is neeeded
    await linear.attachmentUpdate(attachment.id, { title: 'Feature in Productboard', metadata: { connection: connectionLink } })

    const { label, color } = mapLinearState(await issue.state)

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

    productboard.put(connectionLink, payload)

    return payload
  } else {
    console.error(issueCreate.Error)
    throw issueCreate.Error
  }
}

const unlinkIssue = async (pbLink, connectionLink) => {
  const query = gql`query AttachmentForURL($pbLink: String!) {
    attachmentsForURL(url: $pbLink) {
      nodes {
        id
        metadata
      }
    }
  }`
  const attachments = (await linear.client.request(query, { pbLink })).attachmentsForURL
  // The call below is better typed but does not return metadata by default
  // const attachments = await linear.attachmentsForURL(pbLink)
  for (const attachment of attachments.nodes) {
    if (attachment?.metadata?.connection === connectionLink) {
      console.log('Deleting attachment', attachment.id)
      linear.attachmentDelete(attachment.id)
    }
  }
}

const mapLinearState = (state) => {
  return {
    label: state.name.substring(0, 20),
    color: nearestColor(state.color).name
  }
}

const unlinkFeatureByConnection = async (connectionLink) => {
  try {
    await productboard.delete(connectionLink)
  } catch (e) {
    // The feature connection won't exist if it was Productboard unlinking that triggered the attachment delete
    if (!e.response || e.response.status !== 404) {
      throw e
    }
  }
}

const unlinkFeatureByIssueId = async (id) => {
  const issue = await linear.issue(id)
  const connection = await findConnection(issue.url)
  if (connection) {
    console.log('Unlinking connection', connection.links.self)
    await unlinkFeatureByConnection(connection.links.self)
  }
}

const findConnection = async (targetUrl) => {
  const initial = `https://api.productboard.com/plugin-integrations/${(await pluginIntegration).id}/connections`
  const paginate = async (url) => {
    const response = await productboard.get(url)
    const body = response.data

    const connection = body.data.find(c => c?.connection?.targetUrl === targetUrl)

    if (connection) {
      console.log('Found connection for issue', targetUrl)
      return connection
    } else if (body.links.next) {
      return await paginate(body.links.next)
    } else {
      console.log('No connection found for issue', targetUrl)
      return connection
    }
  }

  return await paginate(initial)
}

const updateFeatureStatus = async (issueId, newState) => {
  // the linear SDK does not return metadata on attachments by default, we need to issue our own query
  const query = gql`query IssueWithMetadata($issueId: String!) {
    issue(id: $issueId) {
      identifier
      url
      attachments {
        nodes {
          metadata
        }
      }
    }
  }`

  const response = await linear.client.request(query, { issueId })
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

module.exports = {
  linkIssue,
  unlinkFeatureByConnection,
  unlinkFeatureByIssueId,
  updateFeatureStatus,
  unlinkIssue
}
