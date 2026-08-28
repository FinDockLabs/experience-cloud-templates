# Experience Cloud Checkout Flow

## Deploy
<!-- INSTALL_LINK:START -->
<a href="https://login.salesforce.com/packaging/installPackage.apexp?p0=04tP4000001gL2fIAE" target="_blank" rel="noopener noreferrer"><img alt="Install in a production or Developer org" src="https://img.shields.io/badge/Install-Production%20or%20Developer%20org-00A1E0?style=for-the-badge"></a>
<a href="https://test.salesforce.com/packaging/installPackage.apexp?p0=04tP4000001gL2fIAE" target="_blank" rel="noopener noreferrer"><img alt="Install in a sandbox" src="https://img.shields.io/badge/Install-Sandbox-6B7A8F?style=for-the-badge"></a>

Version 0.1.0-1
<!-- INSTALL_LINK:END -->

> **Compatibility:** Install only one template variant per org. See the [package compatibility notes](../../../README.md#package-compatibility). Checkout may coexist with another variant.

This template contains a Flow template to help you get started with building digital payment experiences using Experience Cloud and FinDock Payment Experiences. The Contact Flow is designed for commercial use cases such as invoices, subscriptions and recovering failed payments.

This template is meant to be customized and extended to fit specific use cases and requirements. For other options, see [Templates for FinDock Payment Experiences](https://github.com/FinDockLabs/payment-experiences-templates).

*Key features*
- Collect new one-time payments
- Set up new recurring donations
- Pay existing one-time payments
- Update existing recurring payments

## Prerequisites
- FinDock is installed and configured.
- FinDock is the source of payments data ([FinDock Standalone](https://docs.findock.com/docs/source-connectors/findock-standalone)).
- At least one payment extension is installed and configured.
- Digital Experiences is enabled in the org.


## Installation
1. Install the package using the link above.
2. Assign the **FinDockLabs Checkout Flow Guest Access** permission set to your Experience Cloud site guest user.
3. Complete the **FinDock Payer** permission set group assignment described in [Experience Cloud & Guest User Setup](https://github.com/FinDockLabs/payment-experiences-templates#experience-cloud--guest-user-setup).
4. Go to the checkout Flow -> Payment Screen -> Payment Method Selection component
   - configure at least some payment methods
5. Configure the [payment intent](https://docs.findock.com/docs/july-26/payments/pay-button) (add at least a success and failure URLs and verify the mapping matches your use case).
6. Activate your flow.
7. Go to the Experience Cloud Administration -> Preferences -> enable "Allow guest users to access public APIs".
8. Add the flow to your Experience Cloud site.
