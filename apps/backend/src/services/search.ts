import { Client } from "@opensearch-project/opensearch";
import { logger } from "../lib/logger";

class SearchService {
  protected readonly client_: Client;

  constructor(container) {
    // super(container); removed as we are not extending TransactionBaseService
    
    const osUrl = process.env.OPENSEARCH_URL || "http://localhost:9200";
    const config: any = { node: osUrl };
    
    if (osUrl.startsWith("https")) {
      config.ssl = { rejectUnauthorized: false };
    }

    this.client_ = new Client(config);
  }

  async indexDocument(indexName: string, document: any) {
    try {
      await this.client_.index({
        index: indexName,
        id: document.id,
        body: document,
        refresh: true, // Ensure immediate visibility for individual updates
      });
    } catch (error) {
      logger.error(`Failed to index document ${document.id} in ${indexName}: ${error.message}`);
      throw error;
    }
  }

  async deleteDocument(indexName: string, id: string) {
    try {
      await this.client_.delete({
        index: indexName,
        id: id,
        refresh: true,
      });
    } catch (error) {
      // Ignore 404s
      if (error.meta && error.meta.body && error.meta.body.found === false) {
        return;
      }
      logger.error(`Failed to delete document ${id} from ${indexName}: ${error.message}`);
      throw error;
    }
  }

  async search(indexName: string, query: any) {
    return await this.client_.search({
      index: indexName,
      body: query,
    });
  }

  getClient() {
    return this.client_;
  }
}

export default SearchService;
