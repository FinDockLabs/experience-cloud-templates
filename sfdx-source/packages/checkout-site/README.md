# Experience Cloud Checkout Site Template
<!-- INSTALL_LINK:START -->
<a href="https://login.salesforce.com/packaging/installPackage.apexp?p0=04tP4000001h1ebIAA" target="_blank" rel="noopener noreferrer"><img alt="Install in a production or Developer org" src="https://img.shields.io/badge/Install-Production%20or%20Developer%20org-00A1E0?style=for-the-badge"></a>
<a href="https://test.salesforce.com/packaging/installPackage.apexp?p0=04tP4000001h1ebIAA" target="_blank" rel="noopener noreferrer"><img alt="Install in a sandbox" src="https://img.shields.io/badge/Install-Sandbox-6B7A8F?style=for-the-badge"></a>

Version 0.1.0-2
<!-- INSTALL_LINK:END -->

This Experience Cloud site template serves as a starting point for building a checkout page using Experience Cloud and FinDock. The site is a simple single page that uses the [Checkout Flow](../checkout/).

The site is meant to be customized and extended to fit the specific use case and requirements of your site. For other options, see [the main Experience Cloud repository](../README.md). 

*Key features*
- Collect new one-time payments
- Set up new recurring donations
- Pay existing one-time payments
- Update existing recurring payments


## Prerequisites
- FinDock is installed and configured.
- FinDock is the source of payments data ([FinDock Standalone](https://docs.findock.com/docs/source-connectors/findock-standalone)).
- At least one payment extension is installed and configured.
- The [Checkout Flow](../checkout/) is deployed. The site's home page references a flow named `Checkout_Flow`; the template deploys without it, but the site cannot be *published* until it exists.
- Digital Experiences is enabled in the org.

## Installation
- Create a new Experience Cloud site with the *Build your own (LWR)* option and name it `Checkout Page`. The name must match exactly — the site's `DigitalExperienceConfig` resolves the site by that label.
- Press the button above to install the site template to your org.
- Customize the page in the Experience Cloud builder.
- Publish the Experience Cloud site.

The installation will ask verification to add external.findock.com as a trusted site. This site is used to host assets for the site such as icons and pictures.

> The site itself is not part of this package. `Network` and `CustomSite` are deliberately excluded in `.forceignore` because they embed the creating user's email address and the org subdomain, which are not portable between orgs. This is why the site has to be created before the template is deployed.
