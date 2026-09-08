# Billing adapter

No Stripe. `source: manual | custom_billing`.

```ts
activateEntitlement({ bandId, moduleCode, source, planCode?, invoiceRef? })
revokeEntitlement({ bandId, moduleCode, reason? })
```

Platform admin UI calls these. A later custom invoicing system should call the same two functions — do not add a second entitlement writer.
