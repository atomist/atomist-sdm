<p align="center">
  <img src="{{package.json readme.logo}}">
</p>

# {{package.json readme.name}} - `{{package.json name}}`

[![atomist sdm goals](http://badge.atomist.com/T29E48P34/atomist/sdm/64ac86ca-3c46-4742-9e41-a42c14560af9)](https://app.atomist.com/workspace/T29E48P34)
[![npm version](https://img.shields.io/npm/v/{{package.json readme.name}}.svg)](https://www.npmjs.com/package/{{package.json readme.name}})

{{docs/description.md}}

## Getting Started

See the [Developer Quick Start][atomist-quick] to jump straight to
creating an SDM.

[atomist-quick]: https://docs.atomist.com/quick-start/ "Atomist - Developer Quick Start"

## Contributing

Contributions to this project from community members are encouraged
and appreciated. Please review the [Contributing
Guidelines](CONTRIBUTING.md) for more information. Also see the
[Development](#development) section in this document.

## Code of conduct

This project is governed by the [Code of
Conduct](CODE_OF_CONDUCT.md). You are expected to act in accordance
with this code by participating. Please report any unacceptable
behavior to code-of-conduct@atomist.com.

## Documentation

Please see [docs.atomist.com][atomist-doc] for
[developer][atomist-sdm] documentation.

-   API docs on this project: [{{package.json readme.name}} TypeDoc][typedoc]
-   List of third-party OSS licenses: [{{package.json readme.name}} OSS licenses][licenses]

[atomist-sdm]: https://docs.atomist.com/developer/sdm/ "Atomist - SDM"
[typedoc]: https://atomist.github.io/{{repo.name}}/ "{{package.json readme.name}} typedoc"
[licenses]: legal/THIRD_PARTY.md "{{package.json readme.name}} typedoc"

## Connect

Follow [@atomist][atomist-twitter] and [The Composition][atomist-blog]
blog related to SDM.

[atomist-twitter]: https://twitter.com/atomist "Atomist on Twitter"
[atomist-blog]: https://the-composition.com/ "The Composition - The Official Atomist Blog"

## Support

General support questions should be discussed in the `#support`
channel in the [Atomist community Slack workspace][slack].

If you find a problem, please create an [issue][].

[issue]: https://github.com/{{repo.owner}}/{{repo.name}}/issues

## Development

You will need to install [Node.js][node] to build and test this
project.

[node]: https://nodejs.org/ "Node.js"

### Build and test

Install dependencies.

```
$ npm install
```

Use the `build` package script to compile, test, lint, and build the
documentation.

```
$ npm run build
```

### Release

Releases are handled via the [Atomist SDM][atomist-sdm]. Just press
the 'Approve' button in the Atomist dashboard or Slack.

[atomist-sdm]: https://github.com/atomist/atomist-sdm "Atomist Software Delivery Machine"

---

Created by [Atomist][atomist].
Need Help? [Join our Slack workspace][slack].

[atomist]: https://atomist.com/ "Atomist - How Teams Deliver Software"
[slack]: https://join.atomist.com/ "Atomist Community Slack"
