# @atomist/atomist-sdm

Instance of an Atomist Software Delivery Machine that can be used to
automate delivery of Atomist automatiom-client projects, like SDMs.

## Running

See the [Atomist documentation][atomist-docs] for information on how
to configure and run SDMs like this.

[atomist-docs]: https://docs.atomist.com/ (Atomist Documentation)

## Using the SDM

Once this SDM is running, here are some things to do:

### Push to an existing repository

If you have any Java or Node projects in your GitHub org, try linking
one to a Slack channel (`@atomist link repo`), and then push to it.
You'll see Atomist react to the push, and the SDM might have some
Goals it can complete.

### Customize

Every organization has a different environment and different
needs. Your software delivery machine is yours: change the code and do
what helps you.

> Atomist is about developing your development experience by using
> your coding skills. Change the code, restart, and see your new
> automations and changed behavior across all your projects, within
> seconds.

### Kubernetes

This SDM is able to deploy to your Kubernetes cluster, using
[k8-automation](https://github.com/atomist/k8-automation), which you
must run in your cluster.  See the [Atomist Kubernetes
documentation][atomist-kube] for information on how to set this up.

[atomist-kube]: https://docs.atomist.com/user/kubernetes/ (Atomist Kubernetes Documentation)

## Support

General support questions should be discussed in the `#support`
channel in our community Slack team
at [atomist-community.slack.com][slack].

If you find a problem, please create an [issue][].

[issue]: https://github.com/atomist/splunk-sdm/issues

## Development

See the [Atomist developer documentation][atomist-dev] for information
on how to write your own SDM features and automations.

[atomist-dev]: https://docs.atomist.com/developer/ (Atomist Developer Documentation)

### Release

Releases are handled via the SDM itself.  Just press the release
button in Slack or the Atomist dashboard.

---

Created by [Atomist][atomist].
Need Help?  [Join our Slack team][slack].

[atomist]: https://atomist.com/ (Atomist - How Teams Deliver Software)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
