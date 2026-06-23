CREATE TABLE "credit_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"run_id" text,
	"idempotency_key" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_billing" (
	"org_id" text PRIMARY KEY NOT NULL,
	"dodo_customer_id" text,
	"dodo_subscription_id" text,
	"subscription_status" text,
	"current_tier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"webhook_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
DROP INDEX "usage_event_org_run_idx";--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_run_id_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_billing" ADD CONSTRAINT "org_billing_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_org_created_idx" ON "credit_ledger" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_debit_uq" ON "credit_ledger" USING btree ("org_id","run_id") WHERE "credit_ledger"."kind" = 'debit';--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_idem_uq" ON "credit_ledger" USING btree ("idempotency_key") WHERE "credit_ledger"."idempotency_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_event_org_run_uq" ON "usage_event" USING btree ("org_id","run_id");