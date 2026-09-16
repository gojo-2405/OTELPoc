# PulseDesk: OpenTelemetry on ECS EC2

PulseDesk is a clean Node.js, Express, and PostgreSQL demo that generates real, useful distributed traces. The UI calls an API that creates work items. Each creation generates:

```text
HTTP POST /api/work-items
└── workflow.create_work_item          (manual business span)
    └── PostgreSQL INSERT work_items   (automatic pg instrumentation)
```

The container exports OTLP/HTTP to a CloudWatch Agent sidecar. That agent writes the traces to X-Ray; they can then be explored in CloudWatch Application Signals, CloudWatch Traces, and X-Ray.

## Architecture

```text
Browser → ALB → ECS EC2 bridge task
                  ├─ pulsedesk-api → PostgreSQL / RDS
                  └─ CloudWatch Agent → X-Ray → CloudWatch trace UI
```

This is **ECS EC2**, not Fargate. It deliberately uses `requiresCompatibilities: ["EC2"]`, `networkMode: "bridge"`, dynamic port mapping, and a Docker link between the application and its telemetry sidecar.

## What to configure

1. Run `db/init.sql` in a PostgreSQL database. Change `DB_NAME`, `DB_USER`, and `DB_HOST` in `ecs/task-definition.json` to match it.
2. Create a Secrets Manager secret containing only the DB password. Replace the `DB_PASSWORD` secret ARN placeholder in the task definition.
3. In Parameter Store (same AWS Region), create a **String** parameter named `/ecs/pulsedesk/otel-config`. Its value must be the exact content of `ecs/cwagent-otel-config.json`.
4. Attach `ecs/task-role-policy.json` to `pulsedeskTaskRole`.
5. Attach the AWS-managed `AmazonECSTaskExecutionRolePolicy` and `ecs/execution-role-extra-policy.json` to `pulsedeskExecutionRole`. If your parameter/secret uses a customer-managed KMS key, grant that execution role `kms:Decrypt` too.
6. Build the container, push it to ECR, then replace all `<...>` placeholders in `ecs/task-definition.json`.
7. Register the task definition. Create/update an ECS **EC2** service and attach it to an Application Load Balancer target group using target type `instance` and the dynamic host port.

## Local test

```bash
copy .env.example .env
# Edit .env with a local or RDS PostgreSQL connection.
npm install
npm run dev
```

Apply `db/init.sql` first, then visit `http://localhost:3000`. In development, `npm run dev` writes spans to the terminal. In ECS, the task definition overrides the exporter endpoint so spans go to the sidecar.

## See traces in CloudWatch

1. Deploy and open the site through your ALB.
2. Create a few work items; each one triggers the manual business span and SQL spans.
3. Wait a couple of minutes.
4. In `us-east-1` (or your deployment Region), open **CloudWatch → Application Signals → Services → pulsedesk-api**. For individual trace waterfalls, use **CloudWatch → Traces** or **X-Ray → Traces**.

Start with `OTEL_TRACES_SAMPLER_ARG=1`, as supplied, so every root request is exported during validation. Change it to `0.1` after validation for a high-traffic production workload.

## Security

Never place passwords, JWT secrets, client secrets, or API keys in the ECS task definition `environment` section. Use ECS `secrets` backed by Secrets Manager or Parameter Store, scope the execution role to those specific ARNs, and rotate any credential ever pasted into chat, source control, or a task-definition revision.
