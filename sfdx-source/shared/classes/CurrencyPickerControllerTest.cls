@IsTest
private class CurrencyPickerControllerTest {
    @IsTest
    static void getActiveCurrenciesReturnsCodes() {
        Test.startTest();
        List<String> currencies = CurrencyPickerController.getActiveCurrencies();
        Test.stopTest();

        Assert.isNotNull(currencies, 'currencies should never be null');
        if (!UserInfo.isMultiCurrencyOrganization()) {
            Assert.areEqual(1, currencies.size(), 'Single-currency org should return one code');
            Assert.areEqual(UserInfo.getDefaultCurrency(), currencies[0], 'Single-currency org should return the user default');
        }
    }
}
