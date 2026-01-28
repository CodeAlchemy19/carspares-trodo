const { Client } = require("@opensearch-project/opensearch");
require("dotenv").config({ path: "../../.env" });

async function main() {
  const config = {
    node: process.env.OPENSEARCH_URL
  };
  // Only add SSL config if URL is HTTPS
  if (process.env.OPENSEARCH_URL && process.env.OPENSEARCH_URL.startsWith('https')) {
    config.ssl = { rejectUnauthorized: false };
  }
  const client = new Client(config);

  const index = "skus_v1";

  const exists = await client.indices.exists({ index });
  if (exists.body) {
    console.log("Index exists:", index);
    return;
  }

  await client.indices.create({
    index,
    body: {
      settings: {
        index: {
          number_of_shards: 3,
          number_of_replicas: 0,
          refresh_interval: "5s"
        },
        analysis: {
          analyzer: {
            text_analyzer: {
              type: "custom",
              tokenizer: "standard",
              filter: ["lowercase", "asciifolding"]
            },
            partnum_prefix: {
              type: "custom",
              tokenizer: "keyword",
              filter: ["lowercase", "asciifolding", "edge_ngram_filter"]
            }
          },
          filter: {
            edge_ngram_filter: { type: "edge_ngram", min_gram: 2, max_gram: 20 }
          }
        }
      },
      mappings: {
        properties: {
          sku_id: { type: "keyword" },
          part_id: { type: "keyword" },

          title: { type: "text", analyzer: "text_analyzer" },
          brand: { type: "keyword" },
          category_path: { type: "keyword" },

          mpn_norm: { type: "keyword" },
          ean: { type: "keyword" },

          numbers_norm: { type: "keyword" },          // exact match (fast)
          numbers_prefix: { type: "text", analyzer: "partnum_prefix" }, // prefix search (optional)

          vehicle_type_ids: { type: "keyword" },      // compatibility filter (fast)

          price: { type: "float" },
          in_stock: { type: "boolean" },
          lead_time_days: { type: "short" }
        }
      }
    }
  });

  console.log("Created index:", index);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
