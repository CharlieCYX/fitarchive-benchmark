# features/checkout — Demo Checkout (§10.3)

Owning module for the simulated payment state machine: created → pending →
paid | failed (`state-machine.ts`, pure, unit-tested) and the service-role DB
wiring (`service.ts`, server-only) writing orders / order_items / payments
with `mode='demo'`, `provider='simulated'`. No real payment credentials exist
anywhere; availability transitions available→reserved→sold (or back to
available on failure); `checkout_start` / `order_complete` events are written
via the features/analytics event service.
