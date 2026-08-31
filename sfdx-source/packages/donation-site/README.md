# Experience Cloud Donation Site Template
<!-- INSTALL_LINK:START -->
<a href="https://login.salesforce.com/packaging/installPackage.apexp?p0=04tP4000001h1gDIAQ" target="_blank" rel="noopener noreferrer"><img alt="Install in a production or Developer org" src="https://img.shields.io/badge/Install-Production%20or%20Developer%20org-00A1E0?style=for-the-badge"></a>
<a href="https://test.salesforce.com/packaging/installPackage.apexp?p0=04tP4000001h1gDIAQ" target="_blank" rel="noopener noreferrer"><img alt="Install in a sandbox" src="https://img.shields.io/badge/Install-Sandbox-6B7A8F?style=for-the-badge"></a>

Version 0.1.0-1
<!-- INSTALL_LINK:END -->

This Experience Cloud site template serves as a starting point for building a donation page using Experience Cloud and FinDock. The site is a simple single page that uses one of the Donation Flows.

The site is meant to be customized and extended to fit the specific use case and requirements of your site. For other options, see [the main Experience Cloud repository](../README.md). 

*Key features*
- Collect new one-time payments
- Set up new recurring donations


## Prerequisites
- FinDock is installed and configured.
- At least one payment extension is installed and configured.
- Digital Experiences is enabled in the org.

## Installation
- Create a new Experience Cloud site with the *Build your own (LWR)* option and name it `Donation Page`.
- Press the button above to install the site template to your org.
- Customize the page in the Experience Cloud builder.
- Publish the Experience Cloud site.

The installation will ask verification to add external.findock.com as a trusted site. This site is used to host assets for the site such as icons and pictures.

> The site itself is not part of this package. `Network` and `CustomSite` are deliberately excluded in `.forceignore` because they embed the creating user's email address and the org subdomain, which are not portable between orgs. This is why the site has to be created before the template is deployed.
