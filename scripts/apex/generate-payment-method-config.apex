// Fetches active payment methods from the org and outputs a ready-to-use
// paymentMethodConfiguration.js config array.
//
// Run via sf CLI:
//   sf apex run -f scripts/apex/generate-payment-method-config.apex --target-org <alias>
//
// Or paste into Developer Console → Execute Anonymous → View Log → USER_DEBUG line.
//
// The `target` field is optional — if left empty, FinDock uses the default merchant account
// configured for that processor. Set it only if you need a non-default account.

// Wraps a config entry so the list can be sorted by paymentProcessor, then paymentMethod.
public class ConfigEntry implements Comparable {
    public Map<String, Object> data;
    public ConfigEntry(Map<String, Object> data) {
        this.data = data;
    }
    public Integer compareTo(Object other) {
        Map<String, Object> otherData = ((ConfigEntry) other).data;
        Integer byProcessor = ((String) data.get('paymentProcessor')).compareTo((String) otherData.get('paymentProcessor'));
        if (byProcessor != 0) return byProcessor;
        return ((String) data.get('paymentMethod')).compareTo((String) otherData.get('paymentMethod'));
    }
}

RestRequest req = new RestRequest();
RestResponse res = new RestResponse();
RestContext.request = req;
RestContext.response = res;
req.requestURI = '/services/apexrest/cpm/v2/PaymentMethods';
req.httpMethod = 'GET';
req.headers.put('verbose', 'true');
cpm.API_PaymentMethod_V2.getPaymentMethods();

Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.responseBody.toString());
List<Object> methods = (List<Object>) body.get('PaymentMethods');
if (methods == null) {
    throw new IllegalArgumentException(
        'No payment methods returned by the org. Response body: ' + res.responseBody.toString() +
        '. Make sure at least one payment method is installed and activated in FinDock for this org.'
    );
}

List<ConfigEntry> entries = new List<ConfigEntry>();

for (Object m : methods) {
    Map<String, Object> method = (Map<String, Object>) m;
    String methodName = (String) method.get('Name');
    List<Object> processors = (List<Object>) method.get('Processors');
    if (processors == null) continue;

    for (Object p : processors) {
        Map<String, Object> proc = (Map<String, Object>) p;
        String procName = (String) proc.get('Name');
        Boolean supportsRecurring = proc.get('SupportsRecurring') == true;
        List<Object> params = new List<Object>();
        List<Object> rawParams = (List<Object>) proc.get('Parameters');
        if (rawParams != null) {
            for (Object rp : rawParams) {
                Map<String, Object> param = (Map<String, Object>) rp;
                params.add(new Map<String, Object>{
                    'name'              => param.get('Name'),
                    'value'             => '',
                    'visibleToCustomer' => false,
                    'displayLabel'      => param.get('Name'),
                    'required'          => param.get('Required'),
                    'description'       => param.get('Description') != null ? param.get('Description') : ''
                });
            }
        }

        entries.add(new ConfigEntry(new Map<String, Object>{
            'paymentMethod'      => methodName,
            'paymentProcessor'   => procName,
            'target'             => '',
            'enabledOneTime'     => true,
            'enabledRecurring'   => supportsRecurring,
            'isDefaultOneTime'   => false,
            'isDefaultRecurring' => false,
            'displayLabel'       => methodName,
            'parameters'         => params.isEmpty() ? null : params,
            // Sort/default-selection helpers only — stripped before this map is serialized below.
            '_supportsRecurring' => supportsRecurring
        }));
    }
}

// Sort by paymentProcessor first, then paymentMethod, so entries for the same processor
// stay grouped together
entries.sort();

List<Object> config = new List<Object>();
for (ConfigEntry entry : entries) {
    config.add(entry.data);
}

// The first entry in the sorted list becomes the default selection.
if (!config.isEmpty()) {
    Map<String, Object> firstEntry = (Map<String, Object>) config[0];
    firstEntry.put('isDefaultOneTime', true);
    firstEntry.put('isDefaultRecurring', firstEntry.get('_supportsRecurring') == true);
}

// Drop the sort/default-selection helper before emitting — it's not a config field.
for (Object entry : config) {
    ((Map<String, Object>) entry).remove('_supportsRecurring');
}

// Single-line output with marker — extracted by generate-payment-config.mjs
System.debug('FDPAYCONFIG:' + JSON.serialize(config));
