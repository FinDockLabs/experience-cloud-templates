# Experience Cloud Donation Flows for NPSP
<!-- INSTALL_LINK:START -->
[![Install in a production or Developer org](https://img.shields.io/badge/Install-Production%20or%20Developer%20org-00A1E0?style=for-the-badge)](https://login.salesforce.com/packaging/installPackage.apexp?p0=04tP4000001gECTIA2)
[![Install in a sandbox](https://img.shields.io/badge/Install-Sandbox-6B7A8F?style=for-the-badge)](https://test.salesforce.com/packaging/installPackage.apexp?p0=04tP4000001gECTIA2)

Version 0.1.0-1
<!-- INSTALL_LINK:END -->

> **Compatibility:** Install only one template variant per org. See the [package compatibility notes](../../../README.md#package-compatibility). Checkout may coexist with another variant.

This template contains Flow templates to help you get started with building digital payment experiences using Experience Cloud and FinDock Payment Experiences. The flow included are designed for Salesforce Fundraising:
Donation flow: Screen flow with a multi step donation process, includes setting Gift Tributes and donor covering fees.

This template is meant to be customized and extended to fit specific use cases and requirements. For other options, see [Templates for FinDock Payment Experiences](https://github.com/FinDockLabs/payment-experiences-templates).

*Key features*
Collect one-time and recurring donations
Configurable amounts and frequencies
Collect Gift Aid from UK donors

## Prerequisites
- FinDock is installed and configured.
- FinDock for Fundraising is installed and configured.
- At least one payment extension is installed and configured.
- Digital Experiences is enabled in the org.


## Installation
1. Install the package using the link above.
2. Assign the **FinDockLabs Donation Flow Guest Access** permission set to your Experience Cloud site guest user.
3. Go to the donation Flow -> Payment Screen -> Payment Method Selection component
   - configure at least some payment methods
4. Configure the [payment intent](https://docs.findock.com/docs/july-26/payments/pay-button) (add at least a success and failure URLs and verify the mapping matches your use case).
5. Activate your flow.
6. Go to the Experience Cloud Administration -> Preferences -> enable "Allow guest users to access public APIs".
7. Add the flow to your Experience Cloud site.
