# Productboard - Linear connector

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Configuration

| ENV variable         | Value                                                                                                                                            |
|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| LINEAR_API_KEY       | Personal API token from Linear.app                                                                                                               |
| PRODUCTBOARD_API_KEY | API Key from Productboard settings                                                                                                               |
| LINEAR_TEAM_ID       | UUID of Linear.app team to create issues in. Run `JSON.parse(localStorage.getItem('userSettings')).activeTeamId` in Linear web console to fetch  |
| BASE_URL             | URL where this integration can be found, including protocol, excluding trailing slash. e.g. `https://pblinear.herokuapp.com` |

## Todo
- [ ] Update title and/or description in Linear if updated in PB
- [ ] Restore Productboard connection on restoring Linear issue from Trash
- [ ] Webhook authentication using secrets

## Demo

![Demo of 2-way status sync](demo.gif)