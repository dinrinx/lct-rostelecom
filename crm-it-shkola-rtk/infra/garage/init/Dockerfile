# Образ dxflrs/garage — без shell вообще (только бинарник /garage), поэтому
# для идемпотентного init-скрипта (layout/key/bucket) берём его бинарник
# и кладём в alpine, где shell есть.
FROM dxflrs/garage:v1.0.1 AS garage

FROM alpine:3.20
COPY --from=garage /garage /usr/local/bin/garage
COPY init.sh /init.sh
RUN chmod +x /init.sh
ENTRYPOINT ["/init.sh"]
