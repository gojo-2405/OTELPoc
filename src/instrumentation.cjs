const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
const { NodeSDK } = require('@opentelemetry/sdk-node');

if (process.env.OTEL_DIAGNOSTIC_LOGS === 'true') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

// ECS injects this endpoint. It is the CloudWatch Agent sidecar, not a public AWS endpoint.
const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'pulsedesk-api',
  traceExporter: endpoint ? new OTLPTraceExporter({ url: endpoint }) : undefined,
  instrumentations: [getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs': { enabled: false }
  })]
});

sdk.start();
const shutDown = () => sdk.shutdown().catch(console.error).finally(() => process.exit(0));
process.once('SIGTERM', shutDown);
process.once('SIGINT', shutDown);
