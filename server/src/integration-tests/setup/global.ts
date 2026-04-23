/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { ElasticsearchContainer } from '@testcontainers/elasticsearch';
import { GenericContainer, Network, Wait } from 'testcontainers';
import type { StartedTestContainer, StartedNetwork } from 'testcontainers';

import { seedTestData } from './seed-data.js';

const ES_PASSWORD = 'changeme';

// Disable Ryuk sidecar — our teardown() handles container cleanup.
// This also avoids Docker Desktop "enhanced container isolation" blocks.
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

/**
 * Resolve the Docker image tag for a given component.
 *
 * Priority:
 *   1. Component-specific env var (ES_IMAGE / KIBANA_IMAGE)
 *   2. STACK_VERSION env var  (e.g. "9.4.0-SNAPSHOT")
 *   3. Default fallback
 */
const DEFAULT_STACK_VERSION = '9.0.0';

function resolveEsImage(): string {
  if (process.env.ES_IMAGE) return process.env.ES_IMAGE;
  const version = process.env.STACK_VERSION || DEFAULT_STACK_VERSION;
  return `docker.elastic.co/elasticsearch/elasticsearch:${version}`;
}

function resolveKibanaImage(): string {
  if (process.env.KIBANA_IMAGE) return process.env.KIBANA_IMAGE;
  const version = process.env.STACK_VERSION || DEFAULT_STACK_VERSION;
  return `docker.elastic.co/kibana/kibana:${version}`;
}

let network: StartedNetwork | undefined;
let esContainer: StartedTestContainer | undefined;
let kibanaContainer: StartedTestContainer | undefined;

export async function setup(): Promise<void> {
  const esImage = resolveEsImage();
  const kibanaImage = resolveKibanaImage();

  // Create a shared Docker network so Kibana can reach ES by hostname
  const net = await new Network().start();
  network = net;

  console.log(`🐳 Starting Elasticsearch: ${esImage}`);

  const esStarted = await new ElasticsearchContainer(esImage)
    .withPassword(ES_PASSWORD)
    .withNetwork(net)
    .withNetworkAliases('elasticsearch')
    .withEnvironment({
      'xpack.license.self_generated.type': 'trial',
    })
    .withStartupTimeout(120_000)
    .start();

  esContainer = esStarted;

  const esUrl = `http://${esStarted.getHost()}:${esStarted.getMappedPort(9200)}`;
  process.env.ES_NODE = esUrl;
  process.env.ES_USERNAME = 'elastic';
  process.env.ES_PASSWORD = ES_PASSWORD;
  console.log(`✅ Elasticsearch ready at ${esUrl} (security enabled)`);

  // Set kibana_system password so Kibana can connect with security enabled
  await fetch(`${esUrl}/_security/user/kibana_system/_password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`elastic:${ES_PASSWORD}`).toString('base64')}`,
    },
    body: JSON.stringify({ password: ES_PASSWORD }),
  });

  // Seed test data before starting Kibana so indices exist
  await seedTestData(esUrl, ES_PASSWORD);

  console.log(`🐳 Starting Kibana: ${kibanaImage}`);

  const kbStarted = await new GenericContainer(kibanaImage)
    .withNetwork(net)
    .withEnvironment({
      ELASTICSEARCH_HOSTS: 'http://elasticsearch:9200',
      ELASTICSEARCH_USERNAME: 'kibana_system',
      ELASTICSEARCH_PASSWORD: ES_PASSWORD,
      'server.host': '0.0.0.0',
    })
    .withExposedPorts(5601)
    .withWaitStrategy(
      Wait.forHttp('/api/status', 5601)
        .forStatusCode(200)
        .withBasicCredentials('elastic', ES_PASSWORD)
        .withStartupTimeout(180_000)
    )
    .withStartupTimeout(180_000)
    .start();

  kibanaContainer = kbStarted;

  const kibanaUrl = `http://${kbStarted.getHost()}:${kbStarted.getMappedPort(5601)}`;
  process.env.KIBANA_URL = kibanaUrl;
  console.log(`✅ Kibana ready at ${kibanaUrl}`);
}

export async function teardown(): Promise<void> {
  console.log('🧹 Tearing down containers…');
  await kibanaContainer?.stop();
  await esContainer?.stop();
  await network?.stop();
  console.log('✅ Containers stopped');
}
