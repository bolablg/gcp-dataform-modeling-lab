// Centralized declaration of external data sources. These declarations make external tables available for use in Dataform models

declare({ database: "intelytix", schema: "products_db", name: "new_york_311_service_requests"});

// Template for additional data sources: declare({ database: "your-gcp-project-id", schema: "your-bigquery-dataset", name: "the-table-name"});