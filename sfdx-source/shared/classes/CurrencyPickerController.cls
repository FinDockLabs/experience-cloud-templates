/**
 * Returns the org's active ISO currency codes for currencyPicker's auto-detect mode
 * (used when the component has no explicit allow-list configured).
 *
 * In a multi-currency org this is every active CurrencyType;
 * in a single-currency org it's just the org's default currency.
 */
public with sharing class CurrencyPickerController {
    @AuraEnabled(Cacheable=true)
    public static List<String> getActiveCurrencies() {
        if (!UserInfo.isMultiCurrencyOrganization()) {
            String defaultCurrency = UserInfo.getDefaultCurrency();
            return String.isNotBlank(defaultCurrency) ? new List<String>{
                    defaultCurrency
            } : new List<String>();
        }

        List<String> codes = new List<String>();
        for (SObject ct : Database.query(
                'SELECT IsoCode FROM CurrencyType WHERE IsActive = TRUE ORDER BY IsoCode',
                System.AccessLevel.SYSTEM_MODE)) {
            codes.add((String) ct.get('IsoCode'));
        }
        return codes;
    }
}
