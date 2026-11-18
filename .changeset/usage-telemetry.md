---
"@siebix/create-effect": minor
---

Each run that creates a project or adds a feature is now counted, and the [website](https://effect.siebix.com) shows how many projects were created and with which options. A run reports the options that were chosen, the version of the CLI and the operating system. It never reports the project's name or a path, and the CLI says so whenever it reports. `DO_NOT_TRACK=1` or `CREATE_EFFECT_TELEMETRY=0` turns it off, and nothing is reported from CI.
