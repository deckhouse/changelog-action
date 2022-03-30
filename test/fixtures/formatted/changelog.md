# Changelog v3.44.555

## [MALFORMED]


 - #495 missing high impact detail
 - #510 invalid type "fix | feature"
 - #533 missing high impact detail, missing type

## Know before update


 - Grafana will be restarted.
    Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached), because direct(browse) datasources type is depreated now. And alerts don't work with direct data sources.
    Provisioning datasources from secret instead configmap. Deckhouse datasources need client certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while terminating.
 - So good.

## Features


 - **[chrony]** d12 [#120](https://github.com/ow/re/120)
 - **[cloud-provider-yandex]** d22 [#220](https://github.com/ow/re/220)
 - **[kube-dns]** widlcard domains support [#491](https://github.com/ow/re/491)
    So good.

## Fixes


 - **[chrony]** d11 [#110](https://github.com/ow/re/110)
 - **[cloud-provider-yandex]** d21 [#210](https://github.com/ow/re/210)
    Grafana will be restarted.
    Now grafana using direct (proxy) type for deckhouse datasources (main, longterm, uncached), because direct(browse) datasources type is depreated now. And alerts don't work with direct data sources.
    Provisioning datasources from secret instead configmap. Deckhouse datasources need client certificates to connect to prometheus or trickter. Old cm leave to prevent mount error while terminating.
 - **[cloud-provider-yandex]** d29 [#290](https://github.com/ow/re/290)
 - **[kube-dns]** d48 [#480](https://github.com/ow/re/480)

## Chore


 - **[upmeter]** Specify user-agent [#501](https://github.com/ow/re/501)
