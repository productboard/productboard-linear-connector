# Productboard - Linear connector

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Configuration

| ENV variable         | Value                                                                                                                                            |
|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| LINEAR_API_KEY       | Personal API token from Linear.app                                                                                                               |
| PRODUCTBOARD_API_KEY | API Key from Productboard settings                                                                                                               |
| LINEAR_TEAM_ID       | UUID of Linear.app team to create issues in. Run `JSON.parse(localStorage.getItem('userSettings')).activeTeamId` in Linear web console to fetch  |

## Todo
- [ ] Issue linking can exceed timeout
- [ ] Delete Linear attachment on PB feature deleted
- [ ] Update title and/or description in Linear if updated in PB
- [ ] Unlink Productboard connection on Linear issue attachment deleted
- [ ] Unlink Productboard connection on Linear issue deleted


## Demo

![Demo of 2-way status sync](demo.gif)