# Productboard - Linear connector

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## Configuration

| ENV variable         | Value                                                                                                                                            |
|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| LINEAR_API_KEY       | Personal API token from Linear.app                                                                                                               |
| PRODUCTBOARD_API_KEY | API Key from Productboard settings                                                                                                               |
| LINEAR_TEAM_ID       | UUID of Linear.app team to create issues in. Run `JSON.parse(localStorage.getItem('userSettings')).activeTeamId` in Linear web console to fetch  |

## Todo
- [x] Issue linking can exceed timeout
- [ ] Error handling pretty much everywhere
- [x] Delete Linear attachment on PB feature deleted
- [x] Delete Linear attachment on PB connection unlinked
- [ ] Update title and/or description in Linear if updated in PB
- [x] Unlink Productboard connection on Linear issue attachment deleted
- [x] Unlink Productboard connection on Linear issue deleted
- [ ] Restore Productboard connection on restoring Linear issue from Trash

## Demo

![Demo of 2-way status sync](demo.gif)